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
    contextWindow: 200000,
    badge: 'Auto-Route',
    supportsVision: true,
  },
  {
    id: 'google/gemma-4-31b-it:free',
    name: 'Google Gemma 4 31B (Free)',
    description: 'Google Multimodal Vision & Reasoning — 262k Context Window 👁️⚡',
    contextWindow: 262144,
    badge: 'Vision & Pro',
    supportsVision: true,
  },
  {
    id: 'google/gemma-4-26b-a4b-it:free',
    name: 'Google Gemma 4 26B A4B (Free)',
    description: 'Ultra-Fast Multimodal Vision & Direct Synthesis — 262k Context Window 👁️🚀',
    contextWindow: 262144,
    badge: 'Vision & Fast',
    supportsVision: true,
  },
  {
    id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    name: 'NVIDIA Nemotron 3 Nano Omni (Free)',
    description: 'Multimodal Vision & High-Speed Reasoning — 256k Context Window 👁️🧠',
    contextWindow: 256000,
    badge: 'Vision & Reasoning',
    supportsVision: true,
  },
  {
    id: 'nvidia/nemotron-3.5-lightning:free',
    name: 'NVIDIA Nemotron 3.5 Lightning (Free)',
    description: 'Ultra-Fast Inference Engine — 1 Million Context Window ⚡',
    contextWindow: 1000000,
    badge: '1M Context',
  },
  {
    id: 'nvidia/nemotron-3-super-120b-a12b:free',
    name: 'NVIDIA Nemotron 3 Super (Free)',
    description: 'Large Reasoning Model for Logic, Analysis & Architecture (262k context) 🔬',
    contextWindow: 262144,
    badge: '120B Reasoning',
  },
  {
    id: 'cohere/north-mini-code:free',
    name: 'Cohere North Mini Code (Free)',
    description: 'Coding Specialist — Syntax Analysis, Debugging & Refactoring (256k context) 💻',
    contextWindow: 256000,
    badge: 'Coding',
  },
  {
    id: 'google/gemini-2.0-flash-exp:free',
    name: 'Gemini 2.0 Flash Experimental (Free Legacy)',
    description: 'Multimodal Vision Legacy Reference 👁️',
    contextWindow: 1048576,
    badge: 'Legacy Vision',
    supportsVision: true,
  },
];

const DEFAULT_OPENROUTER_FALLBACK_CHAIN = [
  'openrouter/free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'nvidia/nemotron-3.5-lightning:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'cohere/north-mini-code:free',
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
        visionModelOverride = 'google/gemma-4-31b-it:free';
        onChunk(`> 👁️ *OpenRouter Vision: Analyzing screen with \`google/gemma-4-31b-it:free\`...*\n\n`);
      }
    }

    const primaryTargetModel = visionModelOverride || requestedModel;

    // Build ordered fallback chain (filter for vision-capable models when analyzing screenshots)
    let candidateModels: string[];
    if (imageBase64) {
      const visionModels = ACTIVE_OPENROUTER_MODELS.filter((m) => m.supportsVision).map((m) => m.id);
      candidateModels = [
        primaryTargetModel,
        ...visionModels.filter((m) => m !== primaryTargetModel),
      ];
    } else {
      candidateModels = [
        primaryTargetModel,
        ...DEFAULT_OPENROUTER_FALLBACK_CHAIN.filter((m) => m !== primaryTargetModel),
      ];
    }

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

        // Immediate stop for invalid credentials or non-existent user
        if (
          message.includes('401') ||
          message.includes('Invalid API Key') ||
          message.includes('unauthorized') ||
          message.includes('User not found') ||
          message.includes('Payment Required') ||
          message.includes('insufficient_credits')
        ) {
          throw new Error('Invalid OpenRouter API Key. Please verify your key (starts with "sk-or-v1-") in Settings.');
        }

        if (isAborted && isAborted()) {
          return '';
        }

        console.warn(`[OpenRouterService] Model ${currentModel} encountered error:`, message);

        // All transient upstream errors (e.g. Nvidia worker limits, ResourceExhausted, 429, 503)
        // gracefully continue loop to attempt the next healthy free model in candidateModels.
      }
    }

    const finalMsg = lastError?.message || 'All OpenRouter free models failed';
    if (finalMsg.includes('ResourceExhausted') || finalMsg.includes('request limit') || finalMsg.includes('429')) {
      throw new Error(`OpenRouter free tier temporary capacity limit reached (${finalMsg}). Please wait a moment or switch to Gemini/Groq.`);
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
