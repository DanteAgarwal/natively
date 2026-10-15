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

  private buildContents(params: InvocationParams): any[] {
    const contents: any[] = [];

    if (params.history && params.history.length > 0) {
      for (const msg of params.history.slice(-12)) {
        contents.push({
          role: msg.role === 'model' ? 'model' : 'user',
          parts: [{ text: msg.text }],
        });
      }
    }

    const currentParts: any[] = [];
    if (params.imageBase64) {
      const cleanBase64 = params.imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      let mimeType = 'image/png';
      if (params.imageBase64.startsWith('data:image/jpeg') || params.imageBase64.startsWith('data:image/jpg')) {
        mimeType = 'image/jpeg';
      } else if (params.imageBase64.startsWith('data:image/webp')) {
        mimeType = 'image/webp';
      }
      currentParts.push({
        inlineData: {
          mimeType,
          data: cleanBase64,
        },
      });
    }

    currentParts.push({ text: params.prompt });
    contents.push({ role: 'user', parts: currentParts });

    return contents;
  }

  private buildGenConfig(params: InvocationParams, allowThinking: boolean = true): any {
    const appConfig = configService.getConfig();
    const effectiveSystem = params.systemInstruction || buildEffectiveSystemInstruction(appConfig);
    const genConfig: any = {};
    if (effectiveSystem) {
      genConfig.systemInstruction = effectiveSystem;
    }
    if (params.temperature !== undefined) {
      genConfig.temperature = params.temperature;
    }
    if (allowThinking && (params.modelId.includes('3.8') || params.modelId.includes('3.7'))) {
      genConfig.thinkingConfig = {
        thinkingBudget: 1024,
      };
    }
    return genConfig;
  }

  async invoke(params: InvocationParams): Promise<InvocationResult> {
    const client = this.getClient();
    const start = Date.now();
    const contents = this.buildContents(params);
    let genConfig = this.buildGenConfig(params, true);

    let response: any;
    try {
      response = await client.models.generateContent({
        model: params.modelId,
        contents,
        config: genConfig,
      });
    } catch (err: any) {
      if (genConfig.thinkingConfig && (err?.message?.includes('thinkingConfig') || err?.status === 400)) {
        genConfig = this.buildGenConfig(params, false);
        response = await client.models.generateContent({
          model: params.modelId,
          contents,
          config: genConfig,
        });
      } else {
        throw err;
      }
    }

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

    const contents = this.buildContents(params);
    let genConfig = this.buildGenConfig(params, true);

    let responseStream: any;
    try {
      responseStream = await client.models.generateContentStream({
        model: params.modelId,
        contents,
        config: genConfig,
      });
    } catch (err: any) {
      if (genConfig.thinkingConfig && (err?.message?.includes('thinkingConfig') || err?.status === 400)) {
        genConfig = this.buildGenConfig(params, false);
        responseStream = await client.models.generateContentStream({
          model: params.modelId,
          contents,
          config: genConfig,
        });
      } else {
        throw err;
      }
    }

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
