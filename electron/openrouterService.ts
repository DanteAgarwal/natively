import OpenAI from 'openai';
import { configService } from './storeService';
import { ChatMessage } from './geminiService';

export interface OpenRouterModelInfo {
  id: string;
  name: string;
  description: string;
  contextWindow: number;
  badge?: string;
  supportsVision?: boolean;
}

export const ACTIVE_OPENROUTER_MODELS: OpenRouterModelInfo[] = [
  {
    id: 'openrouter/free',
    name: 'OpenRouter Free Auto-Router',
    description: 'Smart Free Router — Automatically selects the best available free model with zero downtime 🔀',
    contextWindow: 131072,
    badge: 'Auto-Route',
    supportsVision: true,
  },
  {
    id: 'google/gemini-2.0-flash-exp:free',
    name: 'Gemini 2.0 Flash Experimental (Free)',
    description: 'Multimodal Vision & Ultra-Fast Inference — 1M Context Window 👁️⚡',
    contextWindow: 1048576,
    badge: 'Vision & Fast',
    supportsVision: true,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Llama 3.3 70B Instruct (Free)',
    description: 'Meta Flagship 70B — Deep Reasoning, Problem Solving & Complex Coding (128k context) ⚡',
    contextWindow: 131072,
    badge: 'Flagship 70B',
  },
  {
    id: 'deepseek/deepseek-r1:free',
    name: 'DeepSeek R1 (Free)',
    description: 'State-of-the-Art Open Reasoning Model — Math, Logic & Chain-of-Thought (64k context) 🧠',
    contextWindow: 65536,
    badge: 'Reasoning',
  },
  {
    id: 'qwen/qwen-2.5-coder-32b-instruct:free',
    name: 'Qwen 2.5 Coder 32B (Free)',
    description: 'Coding Specialist — Syntax Analysis, Debugging & Architecture (32k context) 💻',
    contextWindow: 32768,
    badge: 'Coding',
  },
  {
    id: 'mistralai/mistral-7b-instruct:free',
    name: 'Mistral 7B Instruct (Free)',
    description: 'Ultra-Fast Lightweight Model — Low Latency & High Efficiency 🚀',
    contextWindow: 32768,
    badge: 'Speed',
  },
  {
    id: 'deepseek/deepseek-chat:free',
    name: 'DeepSeek V3 Chat (Free)',
    description: 'High-Performance General Chat & Conversational Assistant (64k context) 🌐',
    contextWindow: 65536,
    badge: 'Chat',
  },
  {
    id: 'google/gemini-2.0-pro-exp-02-05:free',
    name: 'Gemini 2.0 Pro Experimental (Free)',
    description: 'Heavyweight Research & Pro Reasoning with Multimodal Support 🔬',
    contextWindow: 1048576,
    badge: 'Pro Vision',
    supportsVision: true,
  },
];

const DEFAULT_OPENROUTER_FALLBACK_CHAIN = [
  'openrouter/free',
  'google/gemini-2.0-flash-exp:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'deepseek/deepseek-r1:free',
  'qwen/qwen-2.5-coder-32b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
  'deepseek/deepseek-chat:free',
];

export class OpenRouterService {
  private getClient(apiKey?: string): OpenAI {
    const rawKey = apiKey || configService.getConfig().openrouterApiKey || process.env.OPENROUTER_API_KEY;
    const key = (rawKey || '').trim().replace(/^["']|["']$/g, '');
    if (!key) {
      throw new Error('OpenRouter API Key is not configured. Please add your key in Settings or set OPENROUTER_API_KEY in .env.');
    }
    return new OpenAI({
      apiKey: key,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/evinjohnn/natively-cluely-ai-assistant',
        'X-Title': 'Natively Ghost Copilot',
      },
    });
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

    let requestedModel = config.openrouterModel || 'openrouter/free';

    // If image is attached, prefer a free model that supports vision natively
    let visionModelOverride: string | null = null;
    if (imageBase64) {
      const selectedModelInfo = ACTIVE_OPENROUTER_MODELS.find((m) => m.id === requestedModel);
      if (!selectedModelInfo?.supportsVision && requestedModel !== 'openrouter/free') {
        visionModelOverride = 'google/gemini-2.0-flash-exp:free';
        onChunk(`> 👁️ *OpenRouter Vision: Analyzing screen with \`google/gemini-2.0-flash-exp:free\`...*\n\n`);
      }
    }

    const primaryTargetModel = visionModelOverride || requestedModel;

    // Build ordered fallback chain
    const candidateModels = [
      primaryTargetModel,
      ...DEFAULT_OPENROUTER_FALLBACK_CHAIN.filter((m) => m !== primaryTargetModel),
    ];

    const systemInstruction = config.systemInstruction?.trim() ||
      'You are an expert AI assistant embedded in a private, invisible overlay. Provide concise, clear, and direct answers.';

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemInstruction },
    ];

    // Prune history to last 12 messages for token efficiency
    const prunedHistory = history.slice(-12);
    for (const msg of prunedHistory) {
      messages.push({
        role: msg.role === 'model' ? 'assistant' : 'user',
        content: msg.text,
      });
    }

    // Format prompt with optional vision attachment
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

    let lastError: any = null;
    let attempt = 0;

    for (const currentModel of candidateModels) {
      if (isAborted && isAborted()) {
        return '';
      }
      attempt++;

      try {
        if (attempt > 1) {
          onChunk(`\n\n> 🛡️ *OpenRouter free tier fault tolerance: Switching to healthy free model \`${currentModel}\`...*\n\n`);
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
        if (message.includes('401') || message.includes('Invalid API Key') || message.includes('unauthorized') || message.includes('User not found')) {
          throw new Error('Invalid OpenRouter API Key. Please verify your key (starts with "sk-or-v1-") in Settings.');
        }

        if (isAborted && isAborted()) {
          return '';
        }

        console.warn(`[OpenRouterService] Model ${currentModel} encountered error:`, message);

        const isRecoverable =
          message.includes('404') ||
          message.includes('not exist') ||
          message.includes('model_not_found') ||
          message.includes('429') ||
          message.includes('rate limit') ||
          message.includes('rate-limit') ||
          message.includes('quota') ||
          message.includes('500') ||
          message.includes('502') ||
          message.includes('503') ||
          message.includes('overloaded');

        if (!isRecoverable) {
          break;
        }
      }
    }

    const finalMsg = lastError?.message || 'All OpenRouter free models failed';
    if (finalMsg.includes('429')) {
      throw new Error('OpenRouter free tier rate limit reached. Please wait a moment or switch to Gemini/Groq.');
    }
    throw new Error(`OpenRouter Error: ${finalMsg}`);
  }

  public async testApiKey(apiKey: string): Promise<{ success: boolean; error?: string }> {
    const cleanedKey = (apiKey || '').trim().replace(/^["']|["']$/g, '');
    if (!cleanedKey) {
      return { success: false, error: 'No API key provided.' };
    }
    try {
      const client = new OpenAI({
        apiKey: cleanedKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'https://github.com/evinjohnn/natively-cluely-ai-assistant',
          'X-Title': 'Natively Ghost Copilot',
        },
      });

      // Quick test using openrouter/free
      try {
        await client.chat.completions.create({
          model: 'openrouter/free',
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 3,
        });
        return { success: true };
      } catch (callErr: any) {
        const callMsg = callErr?.message || String(callErr);
        if (callMsg.includes('401') || callMsg.includes('Unauthorized') || callMsg.includes('User not found')) {
          return { success: false, error: '401 Unauthorized: Invalid OpenRouter API key.' };
        }
        // Fall back to listing models to verify auth without consuming token rate limit
        await client.models.list();
        return { success: true };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to authenticate with OpenRouter.' };
    }
  }
}

export const openrouterService = new OpenRouterService();
