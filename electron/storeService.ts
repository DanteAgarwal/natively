import Store from 'electron-store';
import { app } from 'electron';

export interface AppConfig {
  provider: 'gemini' | 'groq' | 'openrouter' | 'router';
  geminiApiKey: string;
  groqApiKey: string;
  openrouterApiKey: string;
  openrouterModel: string;
  routerPreset: string;
  routerBaseUrl: string;
  routerApiKey: string;
  routerModel: string;
  systemInstruction: string;
  model: string;
  groqModel: string;
  temperature: number;
  autoFallback: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
  provider: 'gemini',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  groqApiKey: process.env.GROQ_API_KEY || '',
  openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openrouterModel: 'openrouter/free',
  routerPreset: 'pollinations',
  routerBaseUrl: process.env.ROUTER_BASE_URL || 'https://text.pollinations.ai/openai',
  routerApiKey: process.env.ROUTER_API_KEY || '',
  routerModel: process.env.ROUTER_MODEL || 'openai',
  systemInstruction: 'You are an expert AI assistant. Provide concise, clear, and direct answers. When code is requested, provide clean and correct code with brief explanation. Do not include unnecessary filler words.',
  model: 'gemini-3.8-flash',
  groqModel: 'llama-3.3-70b-versatile',
  temperature: 0.7,
  autoFallback: true,
};

class ConfigService {
  private store: Store<AppConfig>;

  constructor() {
    this.store = new Store<AppConfig>({
      name: 'ghost-copilot-config',
      defaults: DEFAULT_CONFIG
    });
  }

  public getConfig(): AppConfig {
    let savedModel = this.store.get('model') || DEFAULT_CONFIG.model;
    // Auto-migrate retired or restricted model names to official active gemini-3.8-flash
    const obsoleteGemini = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-2.5-pro',
      'gemini-2.5-flash-lite',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-3-flash-preview',
    ];
    if (obsoleteGemini.includes(savedModel)) {
      savedModel = 'gemini-3.8-flash';
      this.store.set('model', savedModel);
    }

    let savedGroqModel = this.store.get('groqModel') || DEFAULT_CONFIG.groqModel;
    const obsoleteGroq = ['llama-3.2-11b-vision-preview', 'llama-3.1-8b-instant', 'deepseek-r1-distill-llama-70b'];
    if (obsoleteGroq.includes(savedGroqModel)) {
      savedGroqModel = 'llama-3.3-70b-versatile';
      this.store.set('groqModel', savedGroqModel);
    }

    const cleanKey = (val?: string) => (val || '').trim().replace(/^["']|["']$/g, '');

    const envGemini = process.env.GEMINI_API_KEY || (process.env as any)['GEMINI_API_KEY '];
    const envGroq = process.env.GROQ_API_KEY || (process.env as any)['GROQ_API_KEY '];
    const envOpenRouter = process.env.OPENROUTER_API_KEY || (process.env as any)['OPENROUTER_API_KEY '];
    const envRouterKey = process.env.ROUTER_API_KEY || (process.env as any)['ROUTER_API_KEY '];
    const envRouterUrl = process.env.ROUTER_BASE_URL || (process.env as any)['ROUTER_BASE_URL '];
    const envRouterModel = process.env.ROUTER_MODEL || (process.env as any)['ROUTER_MODEL '];

    return {
      provider: (this.store.get('provider') as any) || DEFAULT_CONFIG.provider,
      geminiApiKey: cleanKey(this.store.get('geminiApiKey')) || cleanKey(envGemini) || '',
      groqApiKey: cleanKey(this.store.get('groqApiKey')) || cleanKey(envGroq) || '',
      openrouterApiKey: cleanKey(this.store.get('openrouterApiKey')) || cleanKey(envOpenRouter) || '',
      openrouterModel: this.store.get('openrouterModel') || DEFAULT_CONFIG.openrouterModel,
      routerPreset: this.store.get('routerPreset') || DEFAULT_CONFIG.routerPreset,
      routerBaseUrl: this.store.get('routerBaseUrl') || cleanKey(envRouterUrl) || DEFAULT_CONFIG.routerBaseUrl,
      routerApiKey: cleanKey(this.store.get('routerApiKey')) || cleanKey(envRouterKey) || '',
      routerModel: this.store.get('routerModel') || cleanKey(envRouterModel) || DEFAULT_CONFIG.routerModel,
      systemInstruction: this.store.get('systemInstruction') || DEFAULT_CONFIG.systemInstruction,
      model: savedModel,
      groqModel: savedGroqModel,
      temperature: this.store.get('temperature') ?? DEFAULT_CONFIG.temperature,
      autoFallback: this.store.get('autoFallback') ?? DEFAULT_CONFIG.autoFallback,
    };
  }

  public setConfig(newConfig: Partial<AppConfig>): AppConfig {
    const cleanKey = (val?: string) => (val || '').trim().replace(/^["']|["']$/g, '');

    if (newConfig.provider !== undefined) this.store.set('provider', newConfig.provider);
    if (newConfig.geminiApiKey !== undefined) this.store.set('geminiApiKey', cleanKey(newConfig.geminiApiKey));
    if (newConfig.groqApiKey !== undefined) this.store.set('groqApiKey', cleanKey(newConfig.groqApiKey));
    if (newConfig.openrouterApiKey !== undefined) this.store.set('openrouterApiKey', cleanKey(newConfig.openrouterApiKey));
    if (newConfig.openrouterModel !== undefined) this.store.set('openrouterModel', newConfig.openrouterModel);
    if (newConfig.routerPreset !== undefined) this.store.set('routerPreset', newConfig.routerPreset);
    if (newConfig.routerBaseUrl !== undefined) this.store.set('routerBaseUrl', newConfig.routerBaseUrl);
    if (newConfig.routerApiKey !== undefined) this.store.set('routerApiKey', cleanKey(newConfig.routerApiKey));
    if (newConfig.routerModel !== undefined) this.store.set('routerModel', newConfig.routerModel);
    if (newConfig.systemInstruction !== undefined) this.store.set('systemInstruction', newConfig.systemInstruction);
    if (newConfig.model !== undefined) this.store.set('model', newConfig.model);
    if (newConfig.groqModel !== undefined) this.store.set('groqModel', newConfig.groqModel);
    if (newConfig.temperature !== undefined) this.store.set('temperature', newConfig.temperature);
    if (newConfig.autoFallback !== undefined) this.store.set('autoFallback', newConfig.autoFallback);
    return this.getConfig();
  }
}

export const configService = new ConfigService();
