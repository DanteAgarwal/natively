import { UserProfileContext } from './profile';

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  screenshotPreview?: string;
  isError?: boolean;
}

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
  selectedAudioOutputDevice?: string;
  userProfileContext?: UserProfileContext;
}

export type ActiveTab = 'chat' | 'capture';
export type AssistantMode = 'general' | 'interview' | 'coding' | 'meeting';

export const ASSISTANT_MODES: Array<{ id: AssistantMode; label: string; icon: string; prompt: string }> = [
  { id: 'general', label: 'General', icon: '⚡', prompt: 'Provide a concise, direct, accurate answer without unnecessary filler.' },
  { id: 'interview', label: 'Interview', icon: '💼', prompt: 'Structure your response using the STAR method (Situation, Task, Action, Result) or crisp conversational bullet points that are natural to speak aloud in an interview.' },
  { id: 'coding', label: 'LeetCode / Code', icon: '💻', prompt: 'Identify the problem, provide optimal Time & Space Complexity, give concise intuition, and output clean, fully correct, idiomatic code.' },
  { id: 'meeting', label: 'Meeting Notes', icon: '📝', prompt: 'Extract executive summary, key decisions, action items, and objections handling in structured bullets.' },
];

export const QUICK_PROMPTS = [
  { label: 'Solve', icon: '🎯', prompt: 'Analyze this screen. If there is a question, problem, or code error, provide the immediate correct solution. Be concise and direct.' },
  { label: 'Explain', icon: '💡', prompt: 'Explain what is on this screen in simple terms. Break it down step by step.' },
  { label: 'Debug Code', icon: '🐛', prompt: 'Find and fix any bugs or errors in the code shown on screen. Show corrected code with brief explanations.' },
  { label: 'Summarize', icon: '📝', prompt: 'Summarize the key information on this screen in bullet points.' },
];
