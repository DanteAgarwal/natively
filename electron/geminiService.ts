import { GoogleGenAI } from '@google/genai';
import { configService } from './storeService';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

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
   */
  public async streamGenerate(params: {
    prompt: string;
    imageBase64?: string;
    history?: ChatMessage[];
    onChunk: (chunk: string) => void;
  }): Promise<string> {
    const { prompt, imageBase64, history = [], onChunk } = params;
    const ai = this.getClient();
    const config = configService.getConfig();
    let model = config.model || 'gemini-3.8-flash';
    if (model === 'gemini-2.5-flash') {
      model = 'gemini-3.8-flash';
    }
    const systemInstruction = config.systemInstruction?.trim() ||
      'You are an expert AI assistant embedded in a private, invisible overlay. Provide concise, clear, and direct answers. When analyzing screenshots, identify problems and provide immediate solutions. Format responses with markdown for readability.';

    // Build history contents
    const contents: any[] = [];
    for (const msg of history) {
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

    try {
      const responseStream = await ai.models.generateContentStream({
        model,
        contents,
        config: {
          systemInstruction,
          temperature: config.temperature ?? 0.7,
        },
      });

      let fullText = '';
      for await (const chunk of responseStream) {
        const text = chunk.text || '';
        if (text) {
          fullText += text;
          onChunk(text);
        }
      }

      return fullText;
    } catch (err: any) {
      const message: string = err?.message || String(err);

      if (message.includes('API_KEY_INVALID') || message.includes('API key not valid')) {
        throw new Error('Invalid Gemini API Key. Please verify your key in Settings.');
      }
      if (message.includes('RESOURCE_EXHAUSTED') || message.includes('quota')) {
        throw new Error('Gemini API quota exceeded. Please wait or upgrade your plan.');
      }
      if (message.includes('SAFETY')) {
        throw new Error('Content blocked by Gemini safety filters. Try rephrasing your request.');
      }
      if (message.includes('fetch') || message.includes('network') || message.toLowerCase().includes('enotfound')) {
        throw new Error('Network error: Cannot reach Gemini API. Check your internet connection.');
      }

      throw new Error(`Gemini Error: ${message}`);
    }
  }

  /**
   * Test if an API key is valid by making a minimal request.
   */
  public async testApiKey(apiKey: string): Promise<{ success: boolean; error?: string }> {
    try {
      const testAi = new GoogleGenAI({ apiKey });
      await testAi.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
        config: { maxOutputTokens: 5 },
      });
      return { success: true };
    } catch (err: any) {
      const message = err?.message || 'Unknown error';
      if (message.includes('API_KEY_INVALID') || message.includes('API key not valid')) {
        return { success: false, error: 'Invalid API key' };
      }
      if (message.includes('fetch') || message.toLowerCase().includes('enotfound')) {
        return { success: false, error: 'Network error — check your internet connection' };
      }
      return { success: false, error: message };
    }
  }
}

export const geminiService = new GeminiService();
