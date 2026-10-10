/// <reference types="vite/client" />

export interface GhostAPI {
  sendMessage: (prompt: string, history: Array<{ role: 'user' | 'model'; text: string }>) => Promise<void>;
  captureAndAnalyze: (prompt?: string) => Promise<{ previewUrl: string }>;
  getConfig: () => Promise<any>;
  saveConfig: (config: any) => Promise<any>;
  testApiKey: (key: string, provider?: 'gemini' | 'groq') => Promise<{ success: boolean; error?: string }>;
  toggleGhostMode: () => Promise<boolean>;
  setClickThrough: (enabled: boolean) => Promise<boolean>;
  toggleClickThrough: () => Promise<boolean>;
  exportSession: (content: string, defaultName?: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
  setWindowHeight: (height: number) => Promise<void>;
  minimizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  onStreamChunk: (callback: (chunk: string) => void) => () => void;
  onStreamEnd: (callback: () => void) => () => void;
  onStreamError: (callback: (error: string) => void) => () => void;
  onScreenshotCaptured: (callback: (data: { previewUrl: string; prompt: string }) => void) => () => void;
  onTriggerCapture: (callback: () => void) => () => void;
  onClickThroughToggled: (callback: (enabled: boolean) => void) => () => void;
  onPanicHide: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    ghostAPI: GhostAPI;
    electronAPI?: any;
  }
}
