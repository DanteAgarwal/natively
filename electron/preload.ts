import { contextBridge, ipcRenderer } from 'electron';

export interface GhostAPI {
  // AI Operations
  sendMessage: (prompt: string, history: Array<{ role: 'user' | 'model'; text: string }>) => Promise<void>;
  captureAndAnalyze: (prompt?: string) => Promise<{ previewUrl: string }>;
  transcribeAudio: (params: { audioBase64: string; mimeType?: string }) => Promise<{ success: boolean; text: string; engine?: string; error?: string }>;
  stopStream: () => Promise<boolean>;

  // Config & Settings
  getConfig: () => Promise<any>;
  saveConfig: (config: any) => Promise<any>;
  testApiKey: (key: string, provider?: 'gemini' | 'groq' | 'openrouter' | 'router', options?: { baseUrl?: string; model?: string }) => Promise<{ success: boolean; error?: string }>;

  // Model Registry & Diagnostics (PRD §6.8, §6.9)
  getModels: () => Promise<any[]>;
  getModelDiagnostics: () => Promise<any>;
  getQuotas: () => Promise<any[]>;
  getCircuits: () => Promise<any[]>;
  refreshCatalogs: () => Promise<any[]>;
  testModel: (providerId: string, modelId: string) => Promise<{ ok: boolean; latencyMs: number; error?: string }>;
  getModelPreferences: () => Promise<any>;
  updateModelPreferences: (preferences: any) => Promise<any>;

  // Meeting Audio (Rust Native Module - Speaker / System Audio)
  startMeetingAudio: (deviceId?: string) => Promise<{ success: boolean; error?: string }>;
  stopMeetingAudio: () => Promise<{ success: boolean; error?: string }>;
  getAudioDevices: () => Promise<{ inputs: Array<{ id: string; name: string }>; outputs: Array<{ id: string; name: string }> }>;
  getRollingTranscript: () => Promise<Array<{ id: string; speaker: 'meeting' | 'user'; text: string; timestamp: number }>>;
  clearRollingTranscript: () => Promise<void>;
  onMeetingTranscript: (callback: (item: { id: string; speaker: 'meeting' | 'user'; text: string; timestamp: number }) => void) => () => void;
  onMeetingStatus: (callback: (status: { isCapturing: boolean; error?: string }) => void) => () => void;

  // Window Controls
  toggleGhostMode: () => Promise<boolean>;
  setClickThrough: (enabled: boolean) => Promise<boolean>;
  toggleClickThrough: () => Promise<boolean>;
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward?: boolean }) => Promise<void>;
  exportSession: (content: string, defaultName?: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
  setWindowHeight: (height: number) => Promise<void>;
  toggleWindowSize: () => Promise<boolean>;
  minimizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;

  // Event Subscriptions
  onStreamChunk: (callback: (chunk: string) => void) => () => void;
  onStreamEnd: (callback: () => void) => () => void;
  onStreamError: (callback: (error: string) => void) => () => void;
  onScreenshotCaptured: (callback: (data: { previewUrl: string; prompt: string }) => void) => () => void;
  onTriggerCapture: (callback: () => void) => () => void;
  onTriggerListen: (callback: () => void) => () => void;
  onTriggerMeeting: (callback: () => void) => () => void;
  onWindowSizeToggled: (callback: (isExpanded: boolean) => void) => () => void;
  onClickThroughToggled: (callback: (enabled: boolean) => void) => () => void;
  onPanicHide: (callback: () => void) => () => void;
}

const api: GhostAPI = {
  sendMessage: (prompt, history) => ipcRenderer.invoke('ghost:chat', { prompt, history }),
  captureAndAnalyze: (prompt) => ipcRenderer.invoke('ghost:capture-and-analyze', { prompt }),
  transcribeAudio: (params) => ipcRenderer.invoke('ghost:transcribe-audio', params),
  stopStream: () => ipcRenderer.invoke('ghost:stop-stream'),

  getConfig: () => ipcRenderer.invoke('ghost:get-config'),
  saveConfig: (config) => ipcRenderer.invoke('ghost:save-config', config),
  testApiKey: (key, provider, options) => ipcRenderer.invoke('ghost:test-api-key', { apiKey: key, provider, baseUrl: options?.baseUrl, model: options?.model }),

  // Model Registry & Diagnostics
  getModels: () => ipcRenderer.invoke('ghost:get-models'),
  getModelDiagnostics: () => ipcRenderer.invoke('ghost:get-diagnostics'),
  getQuotas: () => ipcRenderer.invoke('ghost:get-quotas'),
  getCircuits: () => ipcRenderer.invoke('ghost:get-circuits'),
  refreshCatalogs: () => ipcRenderer.invoke('ghost:refresh-catalogs'),
  testModel: (providerId, modelId) => ipcRenderer.invoke('ghost:test-model', { providerId, modelId }),
  getModelPreferences: () => ipcRenderer.invoke('ghost:get-model-preferences'),
  updateModelPreferences: (preferences) => ipcRenderer.invoke('ghost:update-model-preferences', preferences),

  // Meeting Audio
  startMeetingAudio: (deviceId) => ipcRenderer.invoke('ghost:start-meeting-audio', { deviceId }),
  stopMeetingAudio: () => ipcRenderer.invoke('ghost:stop-meeting-audio'),
  getAudioDevices: () => ipcRenderer.invoke('ghost:get-audio-devices'),
  getRollingTranscript: () => ipcRenderer.invoke('ghost:get-rolling-transcript'),
  clearRollingTranscript: () => ipcRenderer.invoke('ghost:clear-rolling-transcript'),

  toggleGhostMode: () => ipcRenderer.invoke('ghost:toggle-ghost-mode'),
  setClickThrough: (enabled: boolean) => ipcRenderer.invoke('ghost:set-click-through', enabled),
  toggleClickThrough: () => ipcRenderer.invoke('ghost:toggle-click-through'),
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward?: boolean }) => ipcRenderer.invoke('ghost:set-ignore-mouse-events', ignore, options),
  exportSession: (content: string, defaultName?: string) => ipcRenderer.invoke('ghost:export-session', { content, defaultName }),
  setWindowHeight: (height) => ipcRenderer.invoke('ghost:set-window-height', height),
  toggleWindowSize: () => ipcRenderer.invoke('ghost:toggle-window-size'),
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

  onTriggerListen: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('ghost:trigger-listen-hotkey', handler);
    return () => ipcRenderer.removeListener('ghost:trigger-listen-hotkey', handler);
  },

  onTriggerMeeting: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('ghost:trigger-meeting-hotkey', handler);
    return () => ipcRenderer.removeListener('ghost:trigger-meeting-hotkey', handler);
  },

  onWindowSizeToggled: (callback) => {
    const handler = (_event: any, isExpanded: boolean) => callback(isExpanded);
    ipcRenderer.on('ghost:window-size-toggled', handler);
    return () => ipcRenderer.removeListener('ghost:window-size-toggled', handler);
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
  },

  onMeetingTranscript: (callback) => {
    const handler = (_event: any, item: any) => callback(item);
    ipcRenderer.on('ghost:meeting-transcript', handler);
    return () => ipcRenderer.removeListener('ghost:meeting-transcript', handler);
  },

  onMeetingStatus: (callback) => {
    const handler = (_event: any, status: any) => callback(status);
    ipcRenderer.on('ghost:meeting-status', handler);
    return () => ipcRenderer.removeListener('ghost:meeting-status', handler);
  }
};

contextBridge.exposeInMainWorld('ghostAPI', api);

declare global {
  interface Window {
    ghostAPI: GhostAPI;
  }
}
