import Groq from 'groq-sdk';
import { configService } from './storeService';
import { ChatMessage } from './geminiService';

export interface GroqModelInfo {
  id: string;
  name: string;
  description: string;
  contextWindow: number;
  badge?: string;
}

export const ACTIVE_GROQ_MODELS: GroqModelInfo[] = [
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B Versatile',
    description: 'Meta Flagship — Top Intelligence, Reasoning & Coding (128k context, ~280 tok/s) ⚡',
    contextWindow: 131072,
    badge: 'Recommended',
  },
  {
    id: 'deepseek-r1-distill-qwen-32b',
    name: 'DeepSeek R1 Distill Qwen 32B',
    description: 'High-Speed Math & Logic Reasoning (128k context, ~320 tok/s) 🚀',
    contextWindow: 131072,
    badge: 'Reasoning',
  },
  {
    id: 'qwen-2.5-coder-32b',
    name: 'Qwen 2.5 Coder 32B',
    description: 'Specialized Code Synthesis, Architecture & Debugging (32k context, ~350 tok/s) 💻',
    contextWindow: 32768,
    badge: 'Coding',
  },
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT-OSS 120B',
    description: 'High-Capacity Open Weights Reasoning Model (64k context) 🌐',
    contextWindow: 65536,
  },
  {
    id: 'openai/gpt-oss-20b',
    name: 'GPT-OSS 20B',
    description: 'Ultra-Fast Lightweight Model (~400 tok/s) ⚡',
    contextWindow: 65536,
    badge: 'Speed',
  },
];

const DEFAULT_FALLBACK_CHAIN = [
  'llama-3.3-70b-versatile',
  'deepseek-r1-distill-qwen-32b',
  'qwen-2.5-coder-32b',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
];

export class GroqService {
  private getClient(apiKey?: string): Groq {
    const rawKey = apiKey || configService.getConfig().groqApiKey || process.env.GROQ_API_KEY;
    const key = (rawKey || '').trim().replace(/^["']|["']$/g, '');
    if (!key) {
      throw new Error('Groq API Key is not configured. Please add your key in Settings or set GROQ_API_KEY in .env.');
    }
    return new Groq({ apiKey: key });
  }

  public async streamGenerate(params: {
    prompt: string;
    imageBase64?: string;
    history?: ChatMessage[];
    onChunk: (chunk: string) => void;
    isAborted?: () => boolean;
  }): Promise<string> {
    const { prompt, imageBase64, history = [], onChunk, isAborted } = params;
    const client = this.getClient();
    const config = configService.getConfig();

    let requestedModel = config.groqModel || 'llama-3.3-70b-versatile';
    if (['llama-3.1-8b-instant', 'llama-3.2-11b-vision-preview', 'deepseek-r1-distill-llama-70b'].includes(requestedModel)) {
      requestedModel = 'llama-3.3-70b-versatile';
    }
    
    // Build ordered list of candidate models for fault-tolerant execution
    const candidateModels = [
      requestedModel,
      ...DEFAULT_FALLBACK_CHAIN.filter((m) => m !== requestedModel),
    ];

    const systemInstruction = config.systemInstruction?.trim() ||
      'You are an expert AI assistant embedded in a private, invisible overlay. Provide concise, clear, and direct answers.';

    const messages: any[] = [
      { role: 'system', content: systemInstruction }
    ];

    // Prune history to last 12 messages to prevent exceeding Groq Free Tier TPM (Tokens Per Minute) limit
    const prunedHistory = history.slice(-12);
    for (const msg of prunedHistory) {
      messages.push({
        role: msg.role === 'model' ? 'assistant' : 'user',
        content: msg.text,
      });
    }

    // Handle user prompt (Groq is text-only: format image context gracefully if present)
    if (imageBase64) {
      messages.push({
        role: 'user',
        content: `[Screenshot context provided. Note: Groq runs text inference.]\n\n${prompt}`,
      });
    } else {
      messages.push({
        role: 'user',
        content: prompt,
      });
    }

    let lastError: any = null;
    let attempt = 0;

    for (const currentModel of candidateModels) {
      if (isAborted && isAborted()) {
        return '';
      }
      attempt++;

      try {
        if (attempt > 1) {
          onChunk(`\n\n> 🛡️ *Groq fault tolerance: Switching to healthy model \`${currentModel}\`...*\n\n`);
        }

        const stream = await client.chat.completions.create({
          model: currentModel,
          messages,
          temperature: config.temperature ?? 0.7,
          stream: true,
        });

        let fullText = '';
        for await (const chunk of stream) {
          if (isAborted && isAborted()) {
            break;
          }
          const text = chunk.choices[0]?.delta?.content || '';
          if (text) {
            fullText += text;
            onChunk(text);
          }
        }

        return fullText;
      } catch (err: any) {
        lastError = err;
        const message: string = err?.message || String(err);

        // Immediate stop for invalid credentials
        if (message.includes('401') || message.includes('Invalid API Key') || message.includes('unauthorized')) {
          throw new Error('Invalid Groq API Key. Please verify your key (starts with "gsk_") in Settings.');
        }

        if (isAborted && isAborted()) {
          return '';
        }

        console.warn(`[GroqService] Model ${currentModel} encountered error:`, message);

        // Check if recoverable by moving to the next model in the fallback chain
        const isRecoverable =
          message.includes('404') ||
          message.includes('not exist') ||
          message.includes('model_not_found') ||
          message.includes('decommissioned') ||
          message.includes('429') ||
          message.includes('rate_limit') ||
          message.includes('500') ||
          message.includes('502') ||
          message.includes('503') ||
          message.includes('overloaded');

        if (!isRecoverable) {
          break;
        }
        // Otherwise continue loop to next candidate model
      }
    }

    const finalMsg = lastError?.message || 'All Groq models failed';
    if (finalMsg.includes('429')) {
      throw new Error('Groq rate limit reached across available models. Please wait a moment or switch to Gemini.');
    }
    throw new Error(`Groq Error: ${finalMsg}`);
  }

  public async testApiKey(apiKey: string): Promise<{ success: boolean; error?: string }> {
    const cleanedKey = (apiKey || '').trim().replace(/^["']|["']$/g, '');
    if (!cleanedKey) {
      return { success: false, error: 'No API key provided.' };
    }
    if (!cleanedKey.startsWith('gsk_')) {
      return {
        success: false,
        error: 'Invalid key format. Groq API keys must begin with "gsk_".',
      };
    }
    try {
      const client = new Groq({ apiKey: cleanedKey });

      // Step 1: Try models.list() to verify authentication without consuming generation quotas
      try {
        await client.models.list();
        return { success: true };
      } catch (listErr: any) {
        const listMsg: string = listErr?.message || String(listErr);
        if (listMsg.includes('401') || listMsg.includes('Invalid API Key') || listMsg.includes('unauthorized')) {
          return { success: false, error: '401 Unauthorized: Invalid Groq API key.' };
        }
      }

      // Step 2: Fault-tolerant verification with active test models
      const testModels = ['llama-3.3-70b-versatile', 'openai/gpt-oss-20b', 'qwen-2.5-coder-32b'];
      let lastErrorMessage = '';

      for (const model of testModels) {
        try {
          await client.chat.completions.create({
            model,
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 5,
          });
          return { success: true };
        } catch (err: any) {
          lastErrorMessage = err?.message || String(err);
          if (lastErrorMessage.includes('401') || lastErrorMessage.includes('Invalid API Key') || lastErrorMessage.includes('unauthorized')) {
            return { success: false, error: '401 Unauthorized: Invalid Groq API key.' };
          }
        }
      }

      return { success: false, error: lastErrorMessage || 'Failed to verify Groq key.' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to connect to Groq.' };
    }
  }

  /**
   * Transcribe audio buffer (WebM / WAV) using Groq Whisper.
   * Uses whisper-large-v3-turbo (ultra-fast ~200ms, free tier) with fallback to whisper-large-v3.
   */
  public async transcribeAudio(audioBuffer: Buffer, mimeType: string = 'audio/webm'): Promise<string> {
    const client = this.getClient();
    const file = await Groq.toFile(audioBuffer, 'recording.webm', { type: mimeType });

    const whisperModels = ['whisper-large-v3-turbo', 'whisper-large-v3'];
    let lastErr: any = null;

    for (const model of whisperModels) {
      try {
        const response = await client.audio.transcriptions.create({
          file,
          model,
          response_format: 'json',
        });
        return response.text?.trim() || '';
      } catch (err: any) {
        lastErr = err;
        console.warn(`[Groq Whisper] Model ${model} failed:`, err?.message || err);
      }
    }

    throw lastErr || new Error('Groq speech transcription failed.');
  }
}

export const groqService = new GroqService();
