import { contextBridge, ipcRenderer } from 'electron';

export interface GhostAPI {
  // AI Operations
  sendMessage: (prompt: string, history: Array<{ role: 'user' | 'model'; text: string }>) => Promise<void>;
  captureAndAnalyze: (prompt?: string) => Promise<{ previewUrl: string }>;

  // Config & Settings
  getConfig: () => Promise<any>;
  saveConfig: (config: any) => Promise<any>;
  testApiKey: (key: string, provider?: 'gemini' | 'groq') => Promise<{ success: boolean; error?: string }>;

  // Window Controls
  toggleGhostMode: () => Promise<boolean>;
  setClickThrough: (enabled: boolean) => Promise<boolean>;
  toggleClickThrough: () => Promise<boolean>;
  exportSession: (content: string, defaultName?: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
  setWindowHeight: (height: number) => Promise<void>;
  minimizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;

  // Event Subscriptions
  onStreamChunk: (callback: (chunk: string) => void) => () => void;
  onStreamEnd: (callback: () => void) => () => void;
  onStreamError: (callback: (error: string) => void) => () => void;
  onScreenshotCaptured: (callback: (data: { previewUrl: string; prompt: string }) => void) => () => void;
  onTriggerCapture: (callback: () => void) => () => void;
  onClickThroughToggled: (callback: (enabled: boolean) => void) => () => void;
  onPanicHide: (callback: () => void) => () => void;
}

const api: GhostAPI = {
  sendMessage: (prompt, history) => ipcRenderer.invoke('ghost:chat', { prompt, history }),
  captureAndAnalyze: (prompt) => ipcRenderer.invoke('ghost:capture-and-analyze', { prompt }),

  getConfig: () => ipcRenderer.invoke('ghost:get-config'),
  saveConfig: (config) => ipcRenderer.invoke('ghost:save-config', config),
  testApiKey: (key, provider) => ipcRenderer.invoke('ghost:test-api-key', { apiKey: key, provider }),

  toggleGhostMode: () => ipcRenderer.invoke('ghost:toggle-ghost-mode'),
  setClickThrough: (enabled: boolean) => ipcRenderer.invoke('ghost:set-click-through', enabled),
  toggleClickThrough: () => ipcRenderer.invoke('ghost:toggle-click-through'),
  exportSession: (content: string, defaultName?: string) => ipcRenderer.invoke('ghost:export-session', { content, defaultName }),
  setWindowHeight: (height) => ipcRenderer.invoke('ghost:set-window-height', height),
  minimizeWindow: () => ipcRenderer.invoke('ghost:minimize'),
  closeWindow: () => ipcRenderer.invoke('ghost:close'),

  onStreamChunk: (callback) => {
    const handler = (_event: any, chunk: string) => callback(chunk);
    ipcRenderer.on('ghost:stream-chunk', handler);
    return () => ipcRenderer.removeListener('ghost:stream-chunk', handler);
  },

  onStreamEnd: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('ghost:stream-end', handler);
    return () => ipcRenderer.removeListener('ghost:stream-end', handler);
  },

  onStreamError: (callback) => {
    const handler = (_event: any, error: string) => callback(error);
    ipcRenderer.on('ghost:stream-error', handler);
    return () => ipcRenderer.removeListener('ghost:stream-error', handler);
  },

  onScreenshotCaptured: (callback) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('ghost:screenshot-captured', handler);
    return () => ipcRenderer.removeListener('ghost:screenshot-captured', handler);
  },

  onTriggerCapture: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('ghost:trigger-capture-hotkey', handler);
    return () => ipcRenderer.removeListener('ghost:trigger-capture-hotkey', handler);
  },

  onClickThroughToggled: (callback) => {
    const handler = (_event: any, enabled: boolean) => callback(enabled);
    ipcRenderer.on('ghost:click-through-toggled', handler);
    return () => ipcRenderer.removeListener('ghost:click-through-toggled', handler);
  },

  onPanicHide: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('ghost:panic-hide', handler);
    return () => ipcRenderer.removeListener('ghost:panic-hide', handler);
  }
};

contextBridge.exposeInMainWorld('ghostAPI', api);

declare global {
  interface Window {
    ghostAPI: GhostAPI;
  }
}
