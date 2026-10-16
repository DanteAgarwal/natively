// ---------------------------------------------------------------------------
// Provider Adapter — Ollama (Local & Offline)
// PRD §6.1 FR-01, §7, §10 SEC-04, §14 Phase 2
//
// Connects to local Ollama runtime. Operates offline with zero external network
// egress and zero token cost (LOCAL_ZERO_METER).
// ---------------------------------------------------------------------------

import OpenAI from 'openai';
import { ProviderAdapter, InvocationParams, InvocationResult, NormalizedError } from './types';
import { normalizeStandardError } from './errorNormalizer';
import { ModelRecord } from '../types';
import { modelRegistry } from '../registry';
import { configService, buildEffectiveSystemInstruction } from '../../storeService';

export class OllamaAdapter implements ProviderAdapter {
  readonly providerId = 'ollama' as const;
  private client: OpenAI | null = null;
  private currentBaseUrl: string = '';

  private getClient(): OpenAI {
    const config = configService.getConfig();
    const baseUrl = (config.routerBaseUrl || 'http://localhost:11434/v1').replace(/\/+$/, '');

    if (!this.client || this.currentBaseUrl !== baseUrl) {
      this.client = new OpenAI({
        apiKey: 'ollama', // Ollama doesn't require keys
        baseURL: baseUrl,
        timeout: 15_000,
      });
      this.currentBaseUrl = baseUrl;
    }

    return this.client;
  }

  async listModels(): Promise<ModelRecord[]> {
    return modelRegistry.getByProvider('ollama');
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
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: `Ollama is unreachable on ${this.currentBaseUrl || 'http://localhost:11434/v1'}. Is Ollama running? (${err.message})`,
      };
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
    const err = normalizeStandardError(error);
    if (err.errorClass === 'NETWORK_ERROR') {
      err.message = `Cannot connect to local Ollama service. Ensure Ollama is running locally: ${err.message}`;
    }
    return err;
  }
}
