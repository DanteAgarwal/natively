/**
 * DeepgramStreamingSTT - WebSocket-based streaming Speech-to-Text using Deepgram Nova-2
 *
 * Implements the same EventEmitter interface as GoogleSTT:
 *   Events: 'transcript' ({ text, isFinal, confidence }), 'error' (Error)
 *   Methods: start(), stop(), write(chunk), setSampleRate(), setAudioChannelCount()
 *
 * Sends raw PCM (linear16, 16-bit LE) over WebSocket — NO WAV header.
 * Receives interim and final transcription results in real time.
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { ENGLISH_VARIANTS } from '../config/languages';

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;
const KEEPALIVE_INTERVAL_MS = 3000;

// Deepgram expects a steady stream of audio.
// Our native layer may suppress silent frames for bandwidth, which can create timing gaps.
// To keep Deepgram reliably detecting/segmenting audio, inject short silence frames when
// no audio has been sent recently.
const AUDIO_SILENCE_FRAME_MS = 20; // must match native-module FRAME_MS (20ms at 16kHz)
const AUDIO_SILENCE_INJECT_THRESHOLD_MS = 40; // if we haven't sent audio in this long, inject silence
const AUDIO_SILENCE_INJECT_INTERVAL_MS = 20; // check at frame cadence

export class DeepgramStreamingSTT extends EventEmitter {
    private apiKey: string;
    private ws: WebSocket | null = null;
    private isActive = false;
    private shouldReconnect = false;
    private lastTranscript = '';

    private sampleRate = 16000;
    private numChannels = 1;
    private language = 'en'; // Temporarily English

    private reconnectAttempts = 0;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private keepAliveTimer: NodeJS.Timeout | null = null;
    private audioKeepAliveTimer: NodeJS.Timeout | null = null;
    private lastAudioSendAt = 0; // ms timestamp
    private silenceFrame: Buffer | null = null;

    constructor(apiKey: string, language?: string) {
        super();
        this.apiKey = apiKey;
        if (language) {
            this.language = language;
        }
        console.log(`[DeepgramStreaming] Initialized with language: ${this.language}`);
    }

    // =========================================================================
    // Configuration (match GoogleSTT / RestSTT interface)
    // =========================================================================

    public setSampleRate(rate: number): void {
        this.sampleRate = rate;
        this.silenceFrame = null; // rebuild on next use
        console.log(`[DeepgramStreaming] Sample rate set to ${rate}`);
    }

    public setAudioChannelCount(count: number): void {
        this.numChannels = count;
        this.silenceFrame = null; // rebuild on next use
        console.log(`[DeepgramStreaming] Channel count set to ${count}`);
    }

    /** Set recognition language — uses Deepgram language codes */
    public setRecognitionLanguage(key: string): void {
        const config = ENGLISH_VARIANTS[key];
        if (config && config.deepgramCode) {
            this.language = config.deepgramCode;
        } else {
            // Allow raw language codes too (e.g. 'pl', 'en', 'de')
            this.language = key;
        }
        console.log(`[DeepgramStreaming] Language set to: ${this.language}`);

        // If currently connected, reconnect with new language
        if (this.isActive) {
            console.log(`[DeepgramStreaming] Reconnecting with new language...`);
            this.stop();
            this.start();
        }
    }

    /** No-op — no Google credentials needed */
    public setCredentials(_path: string): void { }

    // =========================================================================
    // Lifecycle
    // =========================================================================

    public start(): void {
        if (this.isActive) return;
        this.shouldReconnect = true;
        this.reconnectAttempts = 0;
        this.connect();
    }

    public stop(): void {
        this.shouldReconnect = false;
        this.clearTimers();

        if (this.ws) {
            try {
                // Send Deepgram's graceful close message
                if (this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({ type: 'CloseStream' }));
                }
            } catch {
                // Ignore send errors during shutdown
            }
            this.ws.close();
            this.ws = null;
        }

        this.isActive = false;
        console.log('[DeepgramStreaming] Stopped');
    }

    // =========================================================================
    // Audio Data
    // =========================================================================

    /**
     * Write raw PCM audio data (linear16, 16-bit LE).
     * Do NOT include a WAV header — Deepgram WebSocket expects raw PCM.
     */
    public write(chunk: Buffer): void {
        if (!this.isActive || !this.ws) return;

        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(chunk);
            this.lastAudioSendAt = Date.now();
        }
    }

    // =========================================================================
    // WebSocket Connection
    // =========================================================================

    private connect(): void {
        const url =
            `wss://api.deepgram.com/v1/listen` +
            `?model=nova-2` +
            `&language=${this.language}` +
            `&encoding=linear16` +
            `&sample_rate=${this.sampleRate}` +
            `&channels=${this.numChannels}` +
            `&smart_format=true` +
            `&endpointing=300` +
            `&interim_results=true`;

        console.log(`[DeepgramStreaming] Connecting (rate=${this.sampleRate}, ch=${this.numChannels}, lang=${this.language})...`);

        this.ws = new WebSocket(url, {
            headers: {
                Authorization: `Token ${this.apiKey}`,
            },
        });

        this.ws.on('open', () => {
            this.isActive = true;
            this.reconnectAttempts = 0;
            this.lastAudioSendAt = Date.now();
            console.log('[DeepgramStreaming] Connected');

            // Start keep-alive pings
            this.startKeepAlive();

            // Ensure Deepgram receives continuous audio timing even if the native layer suppresses silence.
            this.startAudioKeepAlive();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
            try {
                const msgStr = data.toString();
                
                // Add debug logging to see what deepgram says
                if (!msgStr.includes('KeepAlive')) {
                     console.log(`[DeepgramStreaming] Received Message: ${msgStr}`);
                }
                
                const msg = JSON.parse(msgStr);

                // Deepgram response structure:
                // { type: "Results", channel: { alternatives: [{ transcript, confidence }] }, is_final }
                if (msg.type !== 'Results') return;

                const transcript = msg.channel?.alternatives?.[0]?.transcript || '';
                const isFinal = msg.is_final || msg.speech_final || false;

                if (transcript) {
                    this.lastTranscript = transcript;
                }

                // If it's final but transcript is empty (due to endpointing payload), use the last known transcript
                const finalText = transcript || (isFinal ? this.lastTranscript : '');

                if (!finalText) return;
                
                this.emit('transcript', {
                    text: finalText,
                    isFinal: isFinal,
                    confidence: msg.channel?.alternatives?.[0]?.confidence ?? 1.0,
                });

                if (isFinal) {
                    this.lastTranscript = '';
                }
            } catch (err) {
                console.error('[DeepgramStreaming] Parse error:', err);
            }
        });

        this.ws.on('error', (err: Error) => {
            console.error('[DeepgramStreaming] WebSocket error:', err.message);
            this.emit('error', err);
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
            this.isActive = false;
            this.clearKeepAlive();
            this.clearAudioKeepAlive();
            console.log(`[DeepgramStreaming] Closed (code=${code}, reason=${reason.toString()})`);

            // Auto-reconnect on unexpected close
            if (this.shouldReconnect && code !== 1000) {
                this.scheduleReconnect();
            }
        });
    }

    // =========================================================================
    // Reconnection
    // =========================================================================

    private scheduleReconnect(): void {
        if (!this.shouldReconnect) return;

        const delay = Math.min(
            RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts),
            RECONNECT_MAX_DELAY_MS
        );
        this.reconnectAttempts++;

        console.log(`[DeepgramStreaming] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`);

        this.reconnectTimer = setTimeout(() => {
            if (this.shouldReconnect) {
                this.connect();
            }
        }, delay);
    }

    // =========================================================================
    // Keep-alive
    // =========================================================================

    private startKeepAlive(): void {
        this.clearKeepAlive();
        this.keepAliveTimer = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                try {
                    // Send a KeepAlive message specific to Deepgram
                    this.ws.send(JSON.stringify({ type: 'KeepAlive' }));
                } catch {
                    // Ignore errors
                }
            }
        }, KEEPALIVE_INTERVAL_MS);
    }

    private startAudioKeepAlive(): void {
        this.clearAudioKeepAlive();
        this.audioKeepAliveTimer = setInterval(() => {
            if (!this.isActive || this.ws?.readyState !== WebSocket.OPEN) return;

            const now = Date.now();
            if (now - this.lastAudioSendAt < AUDIO_SILENCE_INJECT_THRESHOLD_MS) return;

            // Inject a short silence frame to maintain audio timing.
            // This is critical when upstream audio suppresses silent frames.
            if (!this.silenceFrame) {
                const samplesPerFrame = Math.round((this.sampleRate * AUDIO_SILENCE_FRAME_MS) / 1000);
                const bytesPerSample = 2; // linear16
                const totalBytes = samplesPerFrame * this.numChannels * bytesPerSample;
                this.silenceFrame = Buffer.alloc(totalBytes, 0);
            }

            try {
                this.ws.send(this.silenceFrame);
                this.lastAudioSendAt = now;
            } catch {
                // ignore
            }
        }, AUDIO_SILENCE_INJECT_INTERVAL_MS);
    }

    private clearAudioKeepAlive(): void {
        if (this.audioKeepAliveTimer) {
            clearInterval(this.audioKeepAliveTimer);
            this.audioKeepAliveTimer = null;
        }
    }

    private clearKeepAlive(): void {
        if (this.keepAliveTimer) {
            clearInterval(this.keepAliveTimer);
            this.keepAliveTimer = null;
        }
    }

    private clearTimers(): void {
        this.clearKeepAlive();
        this.clearAudioKeepAlive();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
}
