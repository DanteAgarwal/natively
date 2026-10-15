// ---------------------------------------------------------------------------
// Provider Adapter — Google Gemini
// PRD §6.1 FR-01, FR-03, §7
// ---------------------------------------------------------------------------

import { GoogleGenAI } from '@google/genai';
import { ProviderAdapter, InvocationParams, InvocationResult, NormalizedError } from './types';
import { normalizeStandardError } from './errorNormalizer';
import { ModelRecord } from '../types';
import { modelRegistry } from '../registry';
import { configService, buildEffectiveSystemInstruction } from '../../storeService';

export class GeminiAdapter implements ProviderAdapter {
  readonly providerId = 'gemini' as const;
  private client: GoogleGenAI | null = null;
  private currentApiKey: string = '';

  private getClient(): GoogleGenAI {
    const config = configService.getConfig();
    const apiKey = (config.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();

    if (!apiKey) {
      throw new Error('No Gemini API key configured. Please add your key in Settings.');
    }

    if (!this.client || this.currentApiKey !== apiKey) {
      this.client = new GoogleGenAI({ apiKey });
      this.currentApiKey = apiKey;
    }

    return this.client;
  }

  async listModels(): Promise<ModelRecord[]> {
    // Return registered Gemini models
    return modelRegistry.getByProvider('gemini');
  }

  async healthCheck(modelId: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const client = this.getClient();
      const response = await client.models.generateContent({
        model: modelId,
        contents: 'ping',
      });
      const latencyMs = Date.now() - start;
      return { ok: !!response.text, latencyMs };
    } catch (err: any) {
      return { ok: false, latencyMs: Date.now() - start, error: err.message };
    }
  }

  async invoke(params: InvocationParams): Promise<InvocationResult> {
    const client = this.getClient();
    const start = Date.now();

    const contents: any[] = [];

    if (params.imageBase64) {
      const cleanBase64 = params.imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      contents.push({
        inlineData: {
          mimeType: 'image/png',
          data: cleanBase64,
        },
      });
    }

    if (params.history && params.history.length > 0) {
      for (const msg of params.history) {
        contents.push({
          role: msg.role === 'model' ? 'model' : 'user',
          parts: [{ text: msg.text }],
        });
      }
    }

    contents.push(params.prompt);

    const appConfig = configService.getConfig();
    const effectiveSystem = params.systemInstruction || buildEffectiveSystemInstruction(appConfig);
    const genConfig: any = {};
    if (effectiveSystem) {
      genConfig.systemInstruction = effectiveSystem;
    }
    if (params.temperature !== undefined) {
      genConfig.temperature = params.temperature;
    }

    const response = await client.models.generateContent({
      model: params.modelId,
      contents,
      config: genConfig,
    });

    const totalDurationMs = Date.now() - start;
    const text = response.text || '';

    return {
      text,
      totalDurationMs,
      usage: {
        promptTokens: (response as any).usageMetadata?.promptTokenCount,
        completionTokens: (response as any).usageMetadata?.candidatesTokenCount,
        totalTokens: (response as any).usageMetadata?.totalTokenCount,
      },
    };
  }

  async streamInvoke(params: InvocationParams): Promise<InvocationResult> {
    const client = this.getClient();
    const start = Date.now();
    let ttftRecorded = false;
    let timeToFirstTokenMs: number | undefined;

    const contents: any[] = [];
    if (params.imageBase64) {
      const cleanBase64 = params.imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      contents.push({
        inlineData: {
          mimeType: 'image/png',
          data: cleanBase64,
        },
      });
    }

    if (params.history && params.history.length > 0) {
      for (const msg of params.history) {
        contents.push({
          role: msg.role === 'model' ? 'model' : 'user',
          parts: [{ text: msg.text }],
        });
      }
    }

    contents.push(params.prompt);

    const appConfig = configService.getConfig();
    const effectiveSystem = params.systemInstruction || buildEffectiveSystemInstruction(appConfig);
    const genConfig: any = {};
    if (effectiveSystem) {
      genConfig.systemInstruction = effectiveSystem;
    }
    if (params.temperature !== undefined) {
      genConfig.temperature = params.temperature;
    }

    const responseStream = await client.models.generateContentStream({
      model: params.modelId,
      contents,
      config: genConfig,
    });

    let fullText = '';
    for await (const chunk of responseStream) {
      if (params.isAborted?.()) {
        break;
      }
      if (!ttftRecorded) {
        timeToFirstTokenMs = Date.now() - start;
        ttftRecorded = true;
      }
      const chunkText = chunk.text || '';
      fullText += chunkText;
      if (params.onChunk) {
        params.onChunk(chunkText);
      }
    }

    return {
      text: fullText,
      timeToFirstTokenMs,
      totalDurationMs: Date.now() - start,
    };
  }

  normalizeError(error: any): NormalizedError {
    return normalizeStandardError(error);
  }
}
