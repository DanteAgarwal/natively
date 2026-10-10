import Groq from 'groq-sdk';
import { configService } from './storeService';
import { ChatMessage } from './geminiService';

export class GroqService {
  private getClient(apiKey?: string): Groq {
    const key = apiKey || configService.getConfig().groqApiKey || process.env.GROQ_API_KEY;
    if (!key?.trim()) {
      throw new Error('Groq API Key is not configured. Please add your key in Settings.');
    }
    return new Groq({ apiKey: key.trim() });
  }

  public async streamGenerate(params: {
    prompt: string;
    imageBase64?: string;
    history?: ChatMessage[];
    onChunk: (chunk: string) => void;
  }): Promise<string> {
    const { prompt, imageBase64, history = [], onChunk } = params;
    const client = this.getClient();
    const config = configService.getConfig();

    // Groq vision models: llama-3.2-11b-vision-preview or llama-3.2-90b-vision-preview
    // Text models: llama-3.3-70b-versatile, deepseek-r1-distill-llama-70b, llama-3.1-8b-instant
    const model = imageBase64
      ? 'llama-3.2-11b-vision-preview'
      : (config.groqModel || 'llama-3.3-70b-versatile');

    const systemInstruction = config.systemInstruction?.trim() ||
      'You are an expert AI assistant embedded in a private, invisible overlay. Provide concise, clear, and direct answers.';

    const messages: any[] = [
      { role: 'system', content: systemInstruction }
    ];

    // Build chat history
    for (const msg of history) {
      messages.push({
        role: msg.role === 'model' ? 'assistant' : 'user',
        content: msg.text,
      });
    }

    // Build current prompt
    if (imageBase64) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
            },
          },
        ],
      });
    } else {
      messages.push({
        role: 'user',
        content: prompt,
      });
    }

    try {
      const stream = await client.chat.completions.create({
        model,
        messages,
        temperature: config.temperature ?? 0.7,
        stream: true,
      });

      let fullText = '';
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || '';
        if (text) {
          fullText += text;
          onChunk(text);
        }
      }

      return fullText;
    } catch (err: any) {
      const message: string = err?.message || String(err);
      if (message.includes('401') || message.includes('Invalid API Key') || message.includes('unauthorized')) {
        throw new Error('Invalid Groq API Key. Please verify your key in Settings.');
      }
      if (message.includes('429') || message.includes('rate_limit_exceeded')) {
        throw new Error('Groq rate limit reached. Please wait a moment.');
      }
      throw new Error(`Groq Error: ${message}`);
    }
  }

  public async testApiKey(apiKey: string): Promise<{ success: boolean; error?: string }> {
    try {
      const client = new Groq({ apiKey: apiKey.trim() });
      await client.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 5,
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to verify Groq key' };
    }
  }
}

export const groqService = new GroqService();
