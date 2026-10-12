import { GoogleGenAI } from '@google/genai';
import { configService } from './storeService';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export const ACTIVE_GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
];

export class GeminiService {
  private client: GoogleGenAI | null = null;
  private currentApiKey: string = '';

  private getClient(): GoogleGenAI {
    const config = configService.getConfig();
    const apiKey = (config.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();

    if (!apiKey) {
      throw new Error('No Gemini API key configured. Please open Settings and add your free key from https://aistudio.google.com/app/apikey');
    }

    // Re-create client only if key changed
    if (!this.client || this.currentApiKey !== apiKey) {
      this.client = new GoogleGenAI({ apiKey });
      this.currentApiKey = apiKey;
    }

    return this.client;
  }

  /**
   * Stream a text or multimodal (vision) prompt to Gemini.
   * Calls `onChunk` for each streamed text token.
   * Automatically falls back across active Gemini models if the selected model is throttled or fails.
   */
  public async streamGenerate(params: {
    prompt: string;
    imageBase64?: string;
    history?: ChatMessage[];
    onChunk: (chunk: string) => void;
    isAborted?: () => boolean;
  }): Promise<string> {
    const { prompt, imageBase64, history = [], onChunk, isAborted } = params;
    const ai = this.getClient();
    const config = configService.getConfig();

    let requestedModel = config.model || 'gemini-3.8-flash';
    const obsoleteGemini = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-2.5-pro',
      'gemini-2.5-flash-lite',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-3-flash-preview',
    ];
    if (obsoleteGemini.includes(requestedModel)) {
      requestedModel = 'gemini-3.8-flash';
    }

    // Build ordered list of candidate models for fault-tolerant execution
    const candidateModels = [
      requestedModel,
      ...ACTIVE_GEMINI_MODELS.filter((m) => m !== requestedModel),
    ];

    const systemInstruction = config.systemInstruction?.trim() ||
      'You are an expert AI assistant embedded in a private, invisible overlay. Provide concise, clear, and direct answers. When analyzing screenshots, identify problems and provide immediate solutions. Format responses with markdown for readability.';

    // Prune history to last 12 messages to keep requests fast and resilient
    const prunedHistory = history.slice(-12);
    const contents: any[] = [];
    for (const msg of prunedHistory) {
      contents.push({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.text }],
      });
    }

    // Build current user message
    const currentParts: any[] = [];
    if (imageBase64) {
      currentParts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBase64,
        },
      });
    }
    currentParts.push({ text: prompt });
    contents.push({ role: 'user', parts: currentParts });

    const getGenConfigForModel = (modelName: string) => {
      const genConfig: any = {
        systemInstruction,
        temperature: config.temperature ?? 0.7,
      };

      if (modelName.includes('3.8') || modelName.includes('3.7')) {
        genConfig.thinkingConfig = {
          thinkingLevel: 'low',
        };
      } else if (modelName.includes('3.5-flash-lite')) {
        genConfig.thinkingConfig = {
          thinkingLevel: 'minimal',
        };
      } else if (modelName.includes('2.5')) {
        genConfig.thinkingConfig = {
          thinkingBudget: 0,
        };
      }

      return genConfig;
    };

    let lastError: any = null;
    let attempt = 0;

    for (const currentModel of candidateModels) {
      if (isAborted && isAborted()) {
        return '';
      }
      attempt++;

      try {
        if (attempt > 1) {
          onChunk(`\n\n> 🛡️ *Gemini fault tolerance: Switching to healthy model \`${currentModel}\`...*\n\n`);
        }

        const genConfig = getGenConfigForModel(currentModel);

        const responseStream = await ai.models.generateContentStream({
          model: currentModel,
          contents,
          config: genConfig,
        });

        let fullText = '';
        for await (const chunk of responseStream) {
          if (isAborted && isAborted()) {
            break;
          }
          const text = chunk.text || '';
          if (text) {
            fullText += text;
            onChunk(text);
          }
        }

        return fullText;
      } catch (err: any) {
        lastError = err;
        const message: string = err?.message || String(err);

        // Permanent credential or content policy stops
        if (message.includes('API_KEY_INVALID') || message.includes('API key not valid')) {
          throw new Error('Invalid Gemini API Key. Please verify your key in Settings.');
        }
        if (message.includes('SAFETY')) {
          throw new Error('Content blocked by Gemini safety filters. Try rephrasing your request.');
        }

        if (isAborted && isAborted()) {
          return '';
        }

        console.warn(`[GeminiService] Model ${currentModel} encountered error:`, message);

        // Check if recoverable by moving to the next model in the fallback chain
        const isRecoverable =
          message.includes('404') ||
          message.includes('NOT_FOUND') ||
          message.includes('not found') ||
          message.includes('no longer available') ||
          message.includes('RESOURCE_EXHAUSTED') ||
          message.includes('quota') ||
          message.includes('429') ||
          message.includes('500') ||
          message.includes('502') ||
          message.includes('503') ||
          message.includes('overloaded');

        if (!isRecoverable) {
          break;
        }
        // Otherwise try next model in candidateModels
      }
    }

    const finalMsg = lastError?.message || 'All Gemini models failed';
    if (finalMsg.includes('RESOURCE_EXHAUSTED') || finalMsg.includes('quota') || finalMsg.includes('429')) {
      throw new Error('Gemini API quota exceeded across available models. Please wait or check your Google AI Studio plan.');
    }
    if (finalMsg.includes('fetch') || finalMsg.includes('network') || finalMsg.toLowerCase().includes('enotfound')) {
      throw new Error('Network error: Cannot reach Gemini API. Check your internet connection.');
    }

    throw new Error(`Gemini Error: ${finalMsg}`);
  }

  /**
   * Test if an API key is valid by making a minimal request across fault-tolerant models.
   */
  public async testApiKey(apiKey: string): Promise<{ success: boolean; error?: string }> {
    const testModels = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.7-flash'];
    let lastError = 'Unknown error';

    try {
      const testAi = new GoogleGenAI({ apiKey });

      for (const model of testModels) {
        try {
          await testAi.models.generateContent({
            model,
            contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
            config: { maxOutputTokens: 5 },
          });
          return { success: true };
        } catch (err: any) {
          const message = err?.message || 'Unknown error';
          lastError = message;

          if (message.includes('API_KEY_INVALID') || message.includes('API key not valid')) {
            return { success: false, error: 'Invalid API key' };
          }
          if (message.includes('fetch') || message.toLowerCase().includes('enotfound')) {
            return { success: false, error: 'Network error — check your internet connection' };
          }
          // If 404 or quota on this specific model, try the next one
        }
      }

      return { success: false, error: lastError };
    } catch (err: any) {
      return { success: false, error: err?.message || lastError };
    }
  }

  /**
   * Transcribe audio buffer (WebM / WAV / MP3) using Gemini Flash Lite.
   * Free tier multimodal audio transcription.
   */
  public async transcribeAudio(audioBuffer: Buffer, mimeType: string = 'audio/webm'): Promise<string> {
    const ai = this.getClient();
    const audioBase64 = audioBuffer.toString('base64');
    const models = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'];
    let lastError: any = null;

    for (const model of models) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: audioBase64,
                  },
                },
                {
                  text: 'Transcribe the spoken audio verbatim. Output ONLY the plain transcribed words with zero commentary, formatting, quotation marks, or explanations.',
                },
              ],
            },
          ],
        });
        return response.text?.trim() || '';
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini Audio] Model ${model} failed:`, err?.message || err);
      }
    }

    throw lastError || new Error('Gemini audio transcription failed.');
  }
}

export const geminiService = new GeminiService();
