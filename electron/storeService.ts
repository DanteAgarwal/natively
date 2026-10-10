import Store from 'electron-store';
import { app } from 'electron';

export interface AppConfig {
  provider: 'gemini' | 'groq';
  geminiApiKey: string;
  groqApiKey: string;
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
    // Auto-migrate deprecated models
    if (savedModel === 'gemini-2.5-flash') {
      savedModel = 'gemini-3.8-flash';
      this.store.set('model', savedModel);
    }

    return {
      provider: (this.store.get('provider') as any) || DEFAULT_CONFIG.provider,
      geminiApiKey: this.store.get('geminiApiKey') || process.env.GEMINI_API_KEY || '',
      groqApiKey: this.store.get('groqApiKey') || process.env.GROQ_API_KEY || '',
      systemInstruction: this.store.get('systemInstruction') || DEFAULT_CONFIG.systemInstruction,
      model: savedModel,
      groqModel: this.store.get('groqModel') || DEFAULT_CONFIG.groqModel,
      temperature: this.store.get('temperature') ?? DEFAULT_CONFIG.temperature,
      autoFallback: this.store.get('autoFallback') ?? DEFAULT_CONFIG.autoFallback,
    };
  }

  public setConfig(newConfig: Partial<AppConfig>): AppConfig {
    if (newConfig.provider !== undefined) this.store.set('provider', newConfig.provider);
    if (newConfig.geminiApiKey !== undefined) this.store.set('geminiApiKey', newConfig.geminiApiKey.trim());
    if (newConfig.groqApiKey !== undefined) this.store.set('groqApiKey', newConfig.groqApiKey.trim());
    if (newConfig.systemInstruction !== undefined) this.store.set('systemInstruction', newConfig.systemInstruction);
    if (newConfig.model !== undefined) this.store.set('model', newConfig.model);
    if (newConfig.groqModel !== undefined) this.store.set('groqModel', newConfig.groqModel);
    if (newConfig.temperature !== undefined) this.store.set('temperature', newConfig.temperature);
    if (newConfig.autoFallback !== undefined) this.store.set('autoFallback', newConfig.autoFallback);
    return this.getConfig();
  }
}

export const configService = new ConfigService();
