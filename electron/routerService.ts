import OpenAI from 'openai';
import { configService, buildEffectiveSystemInstruction } from './storeService';
import { ChatMessage } from './geminiService';

export interface RouterPreset {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  defaultModel: string;
  requiresKey: boolean;
  keyPlaceholder?: string;
  keyUrl?: string;
}

export const ROUTER_PRESETS: RouterPreset[] = [
  {
    id: 'pollinations',
    name: 'Pollinations AI (100% Free — No Key Required! 🎁)',
    description: 'Instant zero-configuration public free router. No API key, signup, or credit card needed.',
    baseUrl: 'https://text.pollinations.ai/openai',
    defaultModel: 'openai',
    requiresKey: false,
    keyPlaceholder: 'No API key needed (Public Free Gateway)',
  },
  {
    id: 'cerebras',
    name: 'Cerebras Cloud (Ultra-Fast 2,000 tok/s Free Tier ⚡)',
    description: 'World fastest inference engine. Generous daily free tokens.',
    baseUrl: 'https://api.cerebras.ai/v1',
    defaultModel: 'llama-3.3-70b',
    requiresKey: true,
    keyPlaceholder: 'csk-...',
    keyUrl: 'https://cloud.cerebras.ai',
  },
  {
    id: 'ollama',
    name: 'Ollama (Local Offline — 100% Free 💻)',
    description: 'Runs private models completely offline on your computer with zero token usage.',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2',
    requiresKey: false,
    keyPlaceholder: 'ollama (not required)',
    keyUrl: 'https://ollama.com',
  },
  {
    id: 'deepinfra',
    name: 'DeepInfra (Free Tier Models 🌐)',
    description: 'Fast open-weights model router with free usage credits.',
    baseUrl: 'https://api.deepinfra.com/v1/openai',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct',
    requiresKey: true,
    keyPlaceholder: 'Bearer token from deepinfra.com',
    keyUrl: 'https://deepinfra.com',
  },
  {
    id: 'custom',
    name: 'Custom OpenAI-Compatible Router (LiteLLM, vLLM, etc.) 🔀',
    description: 'Connect any custom LLM router, reverse proxy, or API gateway.',
    baseUrl: 'http://localhost:4000/v1',
    defaultModel: 'gpt-4o-mini',
    requiresKey: false,
    keyPlaceholder: 'API Key (if required by your router)',
  },
];

function normalizeBaseUrl(url?: string): string {
  let trimmed = (url || '').trim().replace(/\/+$/, '');
  if (!trimmed) return 'https://text.pollinations.ai/openai';
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `http://${trimmed}`;
  }
  return trimmed;
}

export class RouterService {
  private getClient(baseUrlOverride?: string, apiKeyOverride?: string): { client: OpenAI; baseUrl: string } {
    const config = configService.getConfig();
    const baseUrl = normalizeBaseUrl(baseUrlOverride || config.routerBaseUrl);

    const rawKey = apiKeyOverride ?? config.routerApiKey ?? process.env.ROUTER_API_KEY;
    const key = (rawKey || '').trim().replace(/^["']|["']$/g, '') || 'dummy-key-for-free-router';

    const client = new OpenAI({
      apiKey: key,
      baseURL: baseUrl,
      timeout: 15_000, // 15s connection timeout to prevent hanging on unreachable endpoints
      maxRetries: 1,
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/evinjohnn/natively-cluely-ai-assistant',
        'X-Title': 'Natively Ghost Copilot',
      },
    });

    return { client, baseUrl };
  }

  public async streamGenerate(params: {
    prompt: string;
    imageBase64?: string;
    history?: ChatMessage[];
    onChunk: (chunk: string) => void;
    isAborted?: () => boolean;
  }): Promise<string> {
    const { prompt, imageBase64, history = [], onChunk, isAborted } = params;
    const { client } = this.getClient();
    const config = configService.getConfig();

    const targetModel = config.routerModel?.trim() || 'openai';
    const systemInstruction = buildEffectiveSystemInstruction(config);

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemInstruction },
    ];

    // Prune history to last 12 messages
    const prunedHistory = history.slice(-12);
    for (const msg of prunedHistory) {
      messages.push({
        role: msg.role === 'model' ? 'assistant' : 'user',
        content: msg.text,
      });
    }

    if (imageBase64) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
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
        model: targetModel,
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
      if (isAborted && isAborted()) {
        return '';
      }
      const msg = err?.message || String(err);
      if (imageBase64 && (msg.includes('image') || msg.includes('vision') || msg.includes('unsupported') || msg.includes('400'))) {
        throw new Error(
          `This router endpoint/model (${targetModel}) does not support image analysis. ` +
          `Try switching to OpenRouter ("google/gemini-2.0-flash-exp:free") or Google Gemini for screen vision.`
        );
      }
      if (/econnrefused/i.test(msg)) {
        throw new Error(`Cannot reach router at ${client.baseURL}. Check that your router or local server is running.`);
      }
      if (/timeout|timed out/i.test(msg)) {
        throw new Error(`Router request timed out after 15s. The endpoint is unresponsive.`);
      }
      throw new Error(`Router Error (${config.routerPreset || 'custom'}): ${msg}`);
    }
  }

  public async testEndpoint(params?: {
    baseUrl?: string;
    apiKey?: string;
    model?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const config = configService.getConfig();
    const baseUrl = normalizeBaseUrl(params?.baseUrl || config.routerBaseUrl);
    const apiKey = (params?.apiKey ?? config.routerApiKey ?? '').trim() || 'dummy-key';
    const model = (params?.model || config.routerModel || 'openai').trim();

    try {
      const client = new OpenAI({
        apiKey,
        baseURL: baseUrl,
        timeout: 8_000, // 8s fast timeout for connection tests
        maxRetries: 0,
        defaultHeaders: {
          'HTTP-Referer': 'https://github.com/evinjohnn/natively-cluely-ai-assistant',
          'X-Title': 'Natively Ghost Copilot',
        },
      });

      await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 3,
      });

      return { success: true };
    } catch (err: any) {
      const raw = err?.message || String(err);
      let error = raw;
      if (/econnrefused/i.test(raw)) {
        error = `Connection refused at ${baseUrl}. Ensure your server is running.`;
      } else if (/enotfound/i.test(raw)) {
        error = `Host not found for ${baseUrl}. Please check the URL.`;
      } else if (/timeout|timed out/i.test(raw)) {
        error = `Connection timed out after 8s at ${baseUrl}.`;
      } else if (err?.status === 401 || /unauthorized|401/i.test(raw)) {
        error = `Authentication failed (401). Please check your API key.`;
      } else if (err?.status === 404 || /not found|404/i.test(raw)) {
        error = `Endpoint returned 404 Not Found at ${baseUrl}. Check path (e.g. append '/v1').`;
      } else if (err?.status === 429 || /rate limit|429/i.test(raw)) {
        error = `Rate limit exceeded (429) on ${model}.`;
      }
      return { success: false, error };
    }
  }
}

export const routerService = new RouterService();
