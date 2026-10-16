// ---------------------------------------------------------------------------
// Provider Adapter — OpenRouter
// PRD §6.1 FR-01, FR-03, §7.1
// ---------------------------------------------------------------------------

import OpenAI from 'openai';
import { ProviderAdapter, InvocationParams, InvocationResult, NormalizedError } from './types';
import { normalizeStandardError } from './errorNormalizer';
import { ModelRecord } from '../types';
import { modelRegistry } from '../registry';
import { configService, buildEffectiveSystemInstruction } from '../../storeService';

export class OpenRouterAdapter implements ProviderAdapter {
  readonly providerId = 'openrouter' as const;
  private client: OpenAI | null = null;
  private currentApiKey: string = '';

  private getClient(): OpenAI {
    const config = configService.getConfig();
    const apiKey = (config.openrouterApiKey || process.env.OPENROUTER_API_KEY || '').trim();

    if (!apiKey) {
      throw new Error('No OpenRouter API key configured. Please add your key in Settings.');
    }

    if (!this.client || this.currentApiKey !== apiKey) {
      this.client = new OpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        timeout: 15_000,
        defaultHeaders: {
          'HTTP-Referer': 'https://github.com/evinjohnn/natively-cluely-ai-assistant',
          'X-Title': 'Natively Ghost Copilot',
        },
      });
      this.currentApiKey = apiKey;
    }

    return this.client;
  }

  async listModels(): Promise<ModelRecord[]> {
    return modelRegistry.getByProvider('openrouter');
  }

  async healthCheck(modelId: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const client = this.getClient();
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
