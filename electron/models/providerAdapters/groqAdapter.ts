// ---------------------------------------------------------------------------
// Provider Adapter — Groq
// PRD §6.1 FR-01, FR-03, §6.7 FR-34, FR-35, §7
// ---------------------------------------------------------------------------

import Groq from 'groq-sdk';
import { ProviderAdapter, InvocationParams, InvocationResult, NormalizedError } from './types';
import { normalizeStandardError } from './errorNormalizer';
import { ModelRecord } from '../types';
import { modelRegistry } from '../registry';
import { configService, buildEffectiveSystemInstruction } from '../../storeService';

export class GroqAdapter implements ProviderAdapter {
  readonly providerId = 'groq' as const;
  private client: Groq | null = null;
  private currentApiKey: string = '';

  private getClient(): Groq {
    const config = configService.getConfig();
    const apiKey = (config.groqApiKey || process.env.GROQ_API_KEY || '').trim();

    if (!apiKey) {
      throw new Error('No Groq API key configured. Please add your key in Settings.');
    }

    if (!this.client || this.currentApiKey !== apiKey) {
      this.client = new Groq({ apiKey });
      this.currentApiKey = apiKey;
    }

    return this.client;
  }

  async listModels(): Promise<ModelRecord[]> {
    return modelRegistry.getByProvider('groq');
  }

  async healthCheck(modelId: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const client = this.getClient();
      // If Whisper model, health check by pinging models endpoint
      if (modelId.includes('whisper')) {
        await client.models.retrieve(modelId);
        return { ok: true, latencyMs: Date.now() - start };
      }

      const res = await client.chat.completions.create({
        model: modelId,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
      });
      return { ok: !!res.choices[0]?.message?.content, latencyMs: Date.now() - start };
    } catch (err: any) {
      return { ok: false, latencyMs: Date.now() - start, error: err.message };
    }
  }

  async invoke(params: InvocationParams): Promise<InvocationResult> {
    const client = this.getClient();
    const start = Date.now();

    const messages: any[] = [];
    const effectiveSystem = params.systemInstruction || buildEffectiveSystemInstruction(configService.getConfig());
    if (effectiveSystem) {
      messages.push({ role: 'system', content: effectiveSystem });
    }

    if (params.history && params.history.length > 0) {
      for (const msg of params.history) {
        messages.push({
          role: msg.role === 'model' ? 'assistant' : 'user',
          content: msg.text,
        });
      }
    }

    if (params.imageBase64) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: params.prompt },
          {
            type: 'image_url',
            image_url: { url: params.imageBase64 },
          },
        ],
      });
    } else {
      messages.push({ role: 'user', content: params.prompt });
    }

    const completion = await client.chat.completions.create({
      model: params.modelId,
      messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens,
    });

    const totalDurationMs = Date.now() - start;
    const text = completion.choices[0]?.message?.content || '';

    return {
      text,
      totalDurationMs,
      usage: {
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens,
      },
    };
  }

  async streamInvoke(params: InvocationParams): Promise<InvocationResult> {
    const client = this.getClient();
    const start = Date.now();
    let ttftRecorded = false;
    let timeToFirstTokenMs: number | undefined;

    const messages: any[] = [];
    const effectiveSystem = params.systemInstruction || buildEffectiveSystemInstruction(configService.getConfig());
    if (effectiveSystem) {
      messages.push({ role: 'system', content: effectiveSystem });
    }

    if (params.history && params.history.length > 0) {
      for (const msg of params.history) {
        messages.push({
          role: msg.role === 'model' ? 'assistant' : 'user',
          content: msg.text,
        });
      }
    }

    if (params.imageBase64) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: params.prompt },
          {
            type: 'image_url',
            image_url: { url: params.imageBase64 },
          },
        ],
      });
    } else {
      messages.push({ role: 'user', content: params.prompt });
    }

    const stream = await client.chat.completions.create({
      model: params.modelId,
      messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens,
      stream: true,
    });

    let fullText = '';
    for await (const chunk of stream) {
      if (params.isAborted?.()) {
        break;
      }
      if (!ttftRecorded) {
        timeToFirstTokenMs = Date.now() - start;
        ttftRecorded = true;
      }
      const chunkText = chunk.choices[0]?.delta?.content || '';
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
