/// <reference types="vite/client" />

export interface GhostAPI {
  sendMessage: (prompt: string, history: Array<{ role: 'user' | 'model'; text: string }>) => Promise<void>;
  captureAndAnalyze: (prompt?: string) => Promise<{ previewUrl: string }>;
  transcribeAudio: (params: { audioBase64: string; mimeType?: string }) => Promise<{ success: boolean; text: string; engine?: string; error?: string }>;
  stopStream: () => Promise<boolean>;
  getConfig: () => Promise<any>;
  saveConfig: (config: any) => Promise<any>;
  testApiKey: (key: string, provider?: 'gemini' | 'groq' | 'openrouter' | 'router', options?: { baseUrl?: string; model?: string }) => Promise<{ success: boolean; error?: string }>;
  // Model Registry & Diagnostics (PRD §6.8, §6.9)
  getModels?: () => Promise<any[]>;
  getModelDiagnostics?: () => Promise<any>;
  getQuotas?: () => Promise<any[]>;
  getCircuits?: () => Promise<any[]>;
  refreshCatalogs?: () => Promise<any[]>;
  testModel?: (providerId: string, modelId: string) => Promise<{ ok: boolean; latencyMs: number; error?: string }>;
  getModelPreferences?: () => Promise<any>;
  updateModelPreferences?: (preferences: any) => Promise<any>;
  resetCircuits?: () => Promise<boolean>;
  getHealthTelemetry?: () => Promise<any[]>;
  runHealthProbes?: () => Promise<any[]>;
  // Meeting Audio (Rust Native Module - Speaker / System Audio)
  startMeetingAudio: (deviceId?: string) => Promise<{ success: boolean; error?: string }>;
  stopMeetingAudio: () => Promise<{ success: boolean; error?: string }>;
  getAudioDevices: () => Promise<{ inputs: Array<{ id: string; name: string }>; outputs: Array<{ id: string; name: string }> }>;
  getRollingTranscript: () => Promise<Array<{ id: string; speaker: 'meeting' | 'user'; text: string; timestamp: number }>>;
  clearRollingTranscript: () => Promise<void>;
  onMeetingTranscript: (callback: (item: { id: string; speaker: 'meeting' | 'user'; text: string; timestamp: number }) => void) => () => void;
  onMeetingStatus: (callback: (status: { isCapturing: boolean; error?: string }) => void) => () => void;

  toggleGhostMode: () => Promise<boolean>;
  setClickThrough: (enabled: boolean) => Promise<boolean>;
  toggleClickThrough: () => Promise<boolean>;
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward?: boolean }) => Promise<void>;
  exportSession: (content: string, defaultName?: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
  setWindowHeight: (height: number) => Promise<void>;
  toggleWindowSize?: () => Promise<boolean>;
  minimizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  onStreamChunk: (callback: (chunk: string) => void) => () => void;
  onStreamEnd: (callback: () => void) => () => void;
  onStreamError: (callback: (error: string) => void) => () => void;
  onScreenshotCaptured: (callback: (data: { previewUrl: string; prompt: string }) => void) => () => void;
  onTriggerCapture: (callback: () => void) => () => void;
  onTriggerListen: (callback: () => void) => () => void;
  onTriggerMeeting?: (callback: () => void) => () => void;
  onTriggerWhatToAnswer?: (callback: () => void) => () => void;
  onTriggerRecap?: (callback: () => void) => () => void;
  onTriggerFollowUp?: (callback: () => void) => () => void;
  onTriggerShorten?: (callback: () => void) => () => void;
  onTriggerCopyResponse?: (callback: () => void) => () => void;
  onWindowSizeToggled?: (callback: (isExpanded: boolean) => void) => () => void;
  onClickThroughToggled: (callback: (enabled: boolean) => void) => () => void;
  onPanicHide: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    ghostAPI: GhostAPI;
    electronAPI?: any;
  }
}
