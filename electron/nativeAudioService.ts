import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { groqService } from './groqService';
import { geminiService } from './geminiService';
import { configService } from './storeService';

export interface AudioDeviceInfo {
  id: string;
  name: string;
}

export interface TranscriptItem {
  id: string;
  speaker: 'meeting' | 'user';
  text: string;
  timestamp: number;
}

// ── 44-Byte RIFF WAV Header Generator for 16kHz Mono 16-bit PCM ──
function pcmToWav(
  pcmData: Buffer,
  sampleRate: number = 16000,
  numChannels: number = 1,
  bitsPerSample: number = 16
): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmData.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmData]);
}

class NativeAudioService {
  private nativeModule: any = null;
  private systemCaptureInstance: any = null;
  private isCapturingSystem: boolean = false;

  // Audio Chunk Buffering & Speech Segmentation
  private pcmChunks: Buffer[] = [];
  private totalBytesBuffered: number = 0;
  private silenceTimer: NodeJS.Timeout | null = null;
  private isTranscribingChunk: boolean = false;

  // Rolling Transcript History (last 50 items)
  private transcriptHistory: TranscriptItem[] = [];
  private onTranscriptListeners: Array<(item: TranscriptItem) => void> = [];
  private onStatusListeners: Array<(status: { isCapturing: boolean; error?: string }) => void> = [];

  constructor() {
    this.loadNativeModule();
  }

  private loadNativeModule(): void {
    const appPath = typeof app !== 'undefined' && app?.getAppPath ? app.getAppPath() : '';
    const candidates = [
      path.join(__dirname, '../native-module'),
      path.join(__dirname, '../../native-module'),
      ...(appPath ? [path.join(appPath, 'native-module')] : []),
      path.join(process.resourcesPath || '', 'native-module'),
      'natively-audio',
    ];

    for (const candidate of candidates) {
      try {
        if (typeof candidate === 'string' && candidate.startsWith('path')) continue;
        if (candidate !== 'natively-audio' && !fs.existsSync(candidate)) continue;
        this.nativeModule = require(candidate);
        if (this.nativeModule && this.nativeModule.SystemAudioCapture) {
          console.log('[NativeAudio] Successfully loaded Rust native module from:', candidate);
          return;
        }
      } catch (err: any) {
        // Continue searching
      }
    }

    console.warn('[NativeAudio] Could not load Rust native-module from standard paths.');
  }

  public isAvailable(): boolean {
    return !!(this.nativeModule && this.nativeModule.SystemAudioCapture);
  }

  public getAudioDevices(): { inputs: AudioDeviceInfo[]; outputs: AudioDeviceInfo[] } {
    if (!this.nativeModule) {
      return { inputs: [], outputs: [] };
    }
    try {
      const inputs = this.nativeModule.getInputDevices ? this.nativeModule.getInputDevices() : [];
      const outputs = this.nativeModule.getOutputDevices ? this.nativeModule.getOutputDevices() : [];
      return { inputs, outputs };
    } catch (err) {
      console.error('[NativeAudio] Failed to get audio devices:', err);
      return { inputs: [], outputs: [] };
    }
  }

  public isCapturing(): boolean {
    return this.isCapturingSystem;
  }

  /**
   * Start capturing system/meeting audio (incoming speaker sound via WASAPI / ScreenCaptureKit)
   */
  public startSystemCapture(deviceId?: string): { success: boolean; error?: string } {
    if (this.isCapturingSystem) {
      return { success: true };
    }

    if (!this.nativeModule || !this.nativeModule.SystemAudioCapture) {
      this.loadNativeModule();
      if (!this.nativeModule?.SystemAudioCapture) {
        return {
          success: false,
          error: 'Rust native audio module is not loaded. Please build the native module.',
        };
      }
    }

    try {
      const cleanDeviceId = (deviceId && deviceId !== 'default' && deviceId.trim()) ? deviceId.trim() : null;
      this.systemCaptureInstance = new this.nativeModule.SystemAudioCapture(cleanDeviceId);
      this.pcmChunks = [];
      this.totalBytesBuffered = 0;

      this.systemCaptureInstance.start((pcmBuffer: Buffer) => {
        try {
          if (!pcmBuffer || pcmBuffer.length === 0) return;
          this.handleIncomingPcm(pcmBuffer);
        } catch (err) {
          console.warn('[NativeAudio] Error processing audio buffer:', err);
        }
      });

      this.isCapturingSystem = true;
      this.notifyStatus({ isCapturing: true });
      console.log('[NativeAudio] System audio loopback capture started.');
      return { success: true };
    } catch (err: any) {
      console.error('[NativeAudio] Failed to start system audio capture:', err);
      this.notifyStatus({ isCapturing: false, error: err?.message || 'Failed to start capture' });
      return { success: false, error: err?.message || 'Failed to start audio capture' };
    }
  }

  /**
   * Stop system/meeting audio capture
   */
  public stopSystemCapture(): { success: boolean; error?: string } {
    if (!this.isCapturingSystem) {
      return { success: true };
    }

    try {
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }

      // Flush remaining speech buffer
      if (this.totalBytesBuffered > 16000 * 2 * 0.5) {
        this.flushSpeechBuffer();
      }

      if (this.systemCaptureInstance) {
        this.systemCaptureInstance.stop();
        this.systemCaptureInstance = null;
      }

      this.isCapturingSystem = false;
      this.notifyStatus({ isCapturing: false });
      console.log('[NativeAudio] System audio loopback capture stopped.');
      return { success: true };
    } catch (err: any) {
      console.error('[NativeAudio] Error stopping audio capture:', err);
      this.isCapturingSystem = false;
      return { success: false, error: err?.message };
    }
  }

  /**
   * Receives 16kHz 16-bit mono PCM chunks from the Rust DSP thread.
   */
  private handleIncomingPcm(chunk: Buffer): void {
    this.pcmChunks.push(chunk);
    this.totalBytesBuffered += chunk.length;

    // Reset silence timer
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }

    // Maximum speech chunk duration: ~4 seconds of audio (16,000 samples/sec * 2 bytes/sample * 4 = 128,000 bytes)
    const MAX_SPEECH_BYTES = 16000 * 2 * 4;

    if (this.totalBytesBuffered >= MAX_SPEECH_BYTES) {
      this.flushSpeechBuffer();
    } else {
      // If no speech frames arrive for 750ms, the speaker paused -> transcribe chunk
      this.silenceTimer = setTimeout(() => {
        this.flushSpeechBuffer();
      }, 750);
    }
  }

  /**
   * Flushes the buffered speech and dispatches for transcription.
   */
  private async flushSpeechBuffer(): Promise<void> {
    if (this.totalBytesBuffered === 0 || this.isTranscribingChunk) return;

    // Minimum audio length to transcribe: 0.6 seconds (16,000 * 2 * 0.6 = 19,200 bytes)
    const MIN_SPEECH_BYTES = 19200;
    if (this.totalBytesBuffered < MIN_SPEECH_BYTES) {
      this.pcmChunks = [];
      this.totalBytesBuffered = 0;
      return;
    }

    const currentPcm = Buffer.concat(this.pcmChunks);
    this.pcmChunks = [];
    this.totalBytesBuffered = 0;

    // Calculate Root-Mean-Square (RMS) signal energy to detect silence
    let sumSquares = 0;
    const sampleCount = Math.floor(currentPcm.length / 2);
    for (let i = 0; i < currentPcm.length - 1; i += 2) {
      const sample = currentPcm.readInt16LE(i);
      sumSquares += sample * sample;
    }
    const rms = Math.sqrt(sumSquares / (sampleCount || 1));

    // If audio is below audible speech threshold (RMS < 250), it is silence: skip transcription
    if (rms < 250) {
      return;
    }

    const wavBuffer = pcmToWav(currentPcm, 16000, 1, 16);

    this.isTranscribingChunk = true;
    try {
      const config = configService.getConfig();
      const hasGroq = !!(config.groqApiKey || process.env.GROQ_API_KEY)?.trim();
      const hasGemini = !!(config.geminiApiKey || process.env.GEMINI_API_KEY)?.trim();

      let text = '';
      if (hasGroq) {
        text = await groqService.transcribeAudio(wavBuffer, 'audio/wav');
      } else if (hasGemini) {
        text = await geminiService.transcribeAudio(wavBuffer, 'audio/wav');
      }

      const cleanedText = (text || '').trim();
      // Ignore hallucinated whisper artifacts on silence
      const hallucinations = [
        'thank you',
        'thanks for watching',
        'subscribe',
        'subtitles by',
        'you',
        '.',
        'bye',
      ];
      if (
        cleanedText &&
        cleanedText.length > 2 &&
        !hallucinations.includes(cleanedText.toLowerCase())
      ) {
        const item: TranscriptItem = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          speaker: 'meeting',
          text: cleanedText,
          timestamp: Date.now(),
        };

        this.addTranscriptItem(item);
      }
    } catch (err: any) {
      console.warn('[NativeAudio] Speech transcription warning:', err?.message || err);
    } finally {
      this.isTranscribingChunk = false;
    }
  }

  public addTranscriptItem(item: TranscriptItem): void {
    this.transcriptHistory.push(item);
    if (this.transcriptHistory.length > 50) {
      this.transcriptHistory.shift();
    }

    for (const listener of this.onTranscriptListeners) {
      try {
        listener(item);
      } catch (e) {
        // Ignore listener error
      }
    }
  }

  public getRollingTranscript(): TranscriptItem[] {
    return [...this.transcriptHistory];
  }

  public clearTranscript(): void {
    this.transcriptHistory = [];
  }

  public onTranscript(listener: (item: TranscriptItem) => void): () => void {
    this.onTranscriptListeners.push(listener);
    return () => {
      this.onTranscriptListeners = this.onTranscriptListeners.filter((l) => l !== listener);
    };
  }

  public onStatus(listener: (status: { isCapturing: boolean; error?: string }) => void): () => void {
    this.onStatusListeners.push(listener);
    return () => {
      this.onStatusListeners = this.onStatusListeners.filter((l) => l !== listener);
    };
  }

  private notifyStatus(status: { isCapturing: boolean; error?: string }): void {
    for (const listener of this.onStatusListeners) {
      try {
        listener(status);
      } catch (e) {
        // Ignore listener error
      }
    }
  }
}

export const nativeAudioService = new NativeAudioService();
