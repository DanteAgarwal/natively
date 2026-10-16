import { app, BrowserWindow, globalShortcut, ipcMain, screen, Tray, Menu, nativeImage, dialog } from 'electron';
import path from 'path';
import { geminiService, ChatMessage } from './geminiService';
import { groqService } from './groqService';
import { openrouterService } from './openrouterService';
import { routerService } from './routerService';
import { captureScreen } from './screenshotService';
import { configService } from './storeService';
import { nativeAudioService } from './nativeAudioService';
import {
  modelRegistry,
  capabilityResolver,
  fallbackOrchestrator,
  circuitBreakerManager,
  quotaTracker,
  diagnostics,
  healthCheckManager,
  modelCatalogSync,
  modelRegistryStore,
  providerRegistry,
  ProviderId,
} from './models';

try {
  require('dotenv').config();
} catch (e) {
  // Ignored in packaged builds
}

// ─────────────────────────────────────────────────────────────
// Process-Level Crash Guards
// ─────────────────────────────────────────────────────────────
process.on('uncaughtException', (error) => {
  console.error('[Ghost Copilot] Uncaught exception:', error);
  // Keep running — the overlay should never crash silently
});

process.on('unhandledRejection', (reason) => {
  console.error('[Ghost Copilot] Unhandled promise rejection:', reason);
});

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isGhostModeActive: boolean = true;
let isClickThroughActive: boolean = false;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// ─────────────────────────────────────────────────────────────
// Stealth Enforcement Guard & Heartbeat Watchdog
// ─────────────────────────────────────────────────────────────
let stealthHeartbeatTimer: NodeJS.Timeout | null = null;

/**
 * 🛡️ Ultra-Stealth Enforcement Guard:
 * Permanently re-asserts WDA_EXCLUDEFROMCAPTURE (setContentProtection),
 * screen-saver tier alwaysOnTop, and skipTaskbar against Windows DWM surface recreation.
 */
function enforceStealthProtection(win?: BrowserWindow | null): void {
  const target = win || mainWindow;
  if (!target || target.isDestroyed()) return;
  try {
    target.setContentProtection(true);
    target.setAlwaysOnTop(true, 'screen-saver', 3);
    target.setSkipTaskbar(true);
  } catch (err) {
    // Non-fatal if OS window handle is temporarily transitioning
  }
}

function startStealthHeartbeat(): void {
  if (stealthHeartbeatTimer) clearInterval(stealthHeartbeatTimer);
  stealthHeartbeatTimer = setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      enforceStealthProtection(mainWindow);
    }
  }, 1000);
}

function stopStealthHeartbeat(): void {
  if (stealthHeartbeatTimer) {
    clearInterval(stealthHeartbeatTimer);
    stealthHeartbeatTimer = null;
  }
}

// ─────────────────────────────────────────────────────────────
// Window Creation
// ─────────────────────────────────────────────────────────────
function createGhostWindow(): BrowserWindow {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { workArea } = primaryDisplay;

  const winWidth = 660;
  const initialHeight = 740;

  // Multi-monitor safe positioning: right side, near top
  // (right-side default avoids blocking most app content)
  const x = Math.round(workArea.x + workArea.width - winWidth - 24);
  const y = Math.round(workArea.y + 32);

  const win = new BrowserWindow({
    width: winWidth,
    height: initialHeight,
    minWidth: 380,
    minHeight: 52,
    maxWidth: 1100,
    x,
    y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: true,
    backgroundColor: '#00000000',
    // Prevents the window from appearing in the taskbar alt-tab on Windows
    type: 'toolbar',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  // 🛡️ CRITICAL: Exclude window from ALL screen capture tools
  // On Windows: SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)
  // On macOS: WDA_EXCLUDEFROMCAPTURE (Monterey 12.0+)
  // This is at the OS level — no software can bypass it
  win.setContentProtection(true);

  // Keep always on top even above fullscreen apps (level 3 = screen-saver level)
  win.setAlwaysOnTop(true, 'screen-saver', 3);

  // Exclude from taskbar & Alt-Tab switcher
  win.setSkipTaskbar(true);

  // 🛡️ Event-Driven Shield Re-Assertion:
  // Hook into all window lifecycle events so that any DWM surface recreation,
  // restore from minimize, resize, or focus change immediately re-applies content protection
  win.on('show', () => enforceStealthProtection(win));
  win.on('restore', () => enforceStealthProtection(win));
  win.on('resize', () => enforceStealthProtection(win));
  win.on('focus', () => enforceStealthProtection(win));
  win.on('moved', () => enforceStealthProtection(win));

  if (isDev) {
    win.loadURL('http://localhost:5180').catch(() => {
      console.warn('[Ghost Copilot] Dev server at http://localhost:5180 not reachable. Attempting fallback to dist/index.html...');
      win.loadFile(path.join(__dirname, '../dist/index.html')).catch(() => {
        const fallbackHtml = `
          <!DOCTYPE html>
          <html>
            <head><meta charset="UTF-8"><title>Ghost Copilot</title></head>
            <body style="background:#18181b;color:#e4e4e7;font-family:Segoe UI,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;box-sizing:border-box;text-align:center;">
              <div style="background:#27272a;border:1px solid #3f3f46;border-radius:12px;padding:24px;max-width:420px;box-shadow:0 16px 40px rgba(0,0,0,0.6);">
                <div style="font-size:32px;margin-bottom:8px;">⚡</div>
                <h3 style="margin:0 0 8px;color:#f87171;">Vite Dev Server Offline</h3>
                <p style="font-size:12px;line-height:1.5;color:#a1a1aa;margin:0 0 16px;">
                  Could not connect to <code>http://localhost:5180</code> and no built <code>dist/index.html</code> was found.
                </p>
                <div style="background:#18181b;padding:10px;border-radius:8px;font-size:12px;color:#38bdf8;font-family:Consolas,monospace;margin-bottom:16px;">
                  npm start
                </div>
                <p style="font-size:11px;color:#71717a;margin:0 0 16px;">
                  Running <code>npm start</code> starts both Vite and Electron together automatically.
                </p>
                <button onclick="location.reload()" style="background:#3b82f6;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;">
                  Retry
                </button>
              </div>
            </body>
          </html>
        `;
        win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fallbackHtml)}`);
      });
    });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html')).catch((e) => {
      console.error('Failed to load dist/index.html:', e);
    });
  }

  win.on('closed', () => {
    mainWindow = null;
  });

  return win;
}

// ─────────────────────────────────────────────────────────────
// System Tray
// ─────────────────────────────────────────────────────────────
let updateTrayContextMenu: () => void = () => {};

function createTray(): void {
  const emptyIcon = nativeImage.createEmpty();

  try {
    tray = new Tray(emptyIcon);
  } catch {
    return;
  }

  updateTrayContextMenu = () => {
    if (!tray) return;
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Ghost AI Copilot',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: mainWindow?.isVisible() ? 'Hide Window' : 'Show Window',
        accelerator: 'CmdOrCtrl+\\',
        click: () => toggleWindowVisibility(),
      },
      {
        label: 'Capture & Analyze Screen',
        accelerator: 'CmdOrCtrl+Shift+S',
        click: () => triggerCapture(),
      },
      {
        label: 'Push-to-Listen (Voice)',
        accelerator: 'F9 / CmdOrCtrl+Shift+L',
        click: () => triggerListen(),
      },
      {
        label: `Click-Through: ${isClickThroughActive ? 'ON (Pass-through)' : 'OFF'}`,
        accelerator: 'CmdOrCtrl+Shift+X',
        click: () => toggleClickThrough(),
      },
      { type: 'separator' },
      {
        label: 'Ghost Shield: LOCKED ON (Permanent Stealth ✓)',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Quit Ghost AI',
        click: () => app.quit(),
      },
    ]);
    tray.setContextMenu(contextMenu);
  };

  tray.setToolTip('Ghost AI Copilot — Invisible Screen Share Overlay');
  updateTrayContextMenu();

  tray.on('click', () => toggleWindowVisibility());
}

// ─────────────────────────────────────────────────────────────
// Hotkeys & Window Actions
// ─────────────────────────────────────────────────────────────
function toggleWindowVisibility(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
    enforceStealthProtection(mainWindow);
  }
}

function setClickThrough(enabled: boolean): boolean {
  if (!mainWindow || mainWindow.isDestroyed()) return isClickThroughActive;
  isClickThroughActive = enabled;
  if (isClickThroughActive) {
    // Pass clicks straight through to IDE/browser behind
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
  } else {
    // Normal interaction with overlay
    mainWindow.setIgnoreMouseEvents(false);
  }
  mainWindow.webContents.send('ghost:click-through-toggled', isClickThroughActive);
  updateTrayContextMenu();
  return isClickThroughActive;
}

function toggleClickThrough(): boolean {
  return setClickThrough(!isClickThroughActive);
}

function panicHide(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.hide();
  mainWindow.webContents.send('ghost:panic-hide');
}

function triggerCapture(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!mainWindow.isVisible()) {
    mainWindow.show();
    mainWindow.focus();
    enforceStealthProtection(mainWindow);
  }
  // Small delay so the window can come to front first
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ghost:trigger-capture-hotkey');
    }
  }, 100);
}

function triggerListen(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!mainWindow.isVisible()) {
    mainWindow.show();
    mainWindow.focus();
    enforceStealthProtection(mainWindow);
  }
  mainWindow.webContents.send('ghost:trigger-listen-hotkey');
}

function toggleWindowSize(): boolean {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  const [currentWidth] = mainWindow.getSize();
  const currentDisplay = screen.getDisplayMatching(mainWindow.getBounds()) || screen.getPrimaryDisplay();
  const isExpanded = currentWidth >= 740;
  const targetWidth = isExpanded ? 640 : 800;
  const targetHeight = isExpanded ? 720 : Math.min(880, Math.round(currentDisplay.workArea.height * 0.92));
  mainWindow.setSize(targetWidth, targetHeight, true);
  enforceStealthProtection(mainWindow);
  mainWindow.webContents.send('ghost:window-size-toggled', !isExpanded);
  return !isExpanded;
}

function registerGlobalHotkeys(): void {
  try {
    globalShortcut.unregisterAll();
  } catch (err) {
    console.warn('[Hotkeys] Failed to unregister existing shortcuts:', err);
  }

  const safeRegister = (accelerator: string, callback: () => void, label?: string): void => {
    try {
      globalShortcut.register(accelerator, callback);
      if (!globalShortcut.isRegistered(accelerator)) {
        console.warn(`[Hotkeys] Failed to register ${label || accelerator}: already in use by another application.`);
      }
    } catch (err) {
      console.warn(`[Hotkeys] Failed to register ${label || accelerator}:`, err);
    }
  };

  // 1. Toggle visibility: Ctrl+\ (or Cmd+\ on macOS)
  safeRegister('CommandOrControl+\\', toggleWindowVisibility, 'Toggle Visibility (Ctrl+\\)');

  // 2. Screen Capture: Alt+S (Primary) & Ctrl+Shift+S (Secondary)
  safeRegister('Alt+S', triggerCapture, 'Screen Capture (Alt+S)');
  safeRegister('CommandOrControl+Shift+S', triggerCapture, 'Screen Capture (Ctrl+Shift+S)');

  // 3. Voice STT Push-to-Talk: F9 (Primary) & Alt+L / Ctrl+Shift+L (Secondary)
  safeRegister('F9', triggerListen, 'Voice STT (F9)');
  safeRegister('Alt+L', triggerListen, 'Voice STT (Alt+L)');
  safeRegister('CommandOrControl+Shift+L', triggerListen, 'Voice STT (Ctrl+Shift+L)');

  // 4. Meeting Audio Toggle: Alt+M & Ctrl+Shift+M
  const sendMeetingHotkey = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ghost:trigger-meeting-hotkey');
    }
  };
  safeRegister('Alt+M', sendMeetingHotkey, 'Meeting Audio (Alt+M)');
  safeRegister('CommandOrControl+Shift+M', sendMeetingHotkey, 'Meeting Audio (Ctrl+Shift+M)');

  // 5. Stealth Panic Hide: Ctrl+Shift+H
  safeRegister('CommandOrControl+Shift+H', () => panicHide(), 'Panic Hide (Ctrl+Shift+H)');

  // 6. Click-Through Toggle: Ctrl+Shift+X
  safeRegister('CommandOrControl+Shift+X', () => toggleClickThrough(), 'Click-Through Toggle');

  // 7. Toggle Overlay Size: Ctrl+Shift+B
  safeRegister('CommandOrControl+Shift+B', () => toggleWindowSize(), 'Window Size Toggle');

  // 8. Meeting Intelligence Global Actions (Works inside Zoom / Meet / Code editors)
  const sendWhatToAnswer = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ghost:trigger-what-to-answer');
    }
  };
  safeRegister('Alt+W', sendWhatToAnswer, 'What To Answer (Alt+W)');
  safeRegister('CommandOrControl+Shift+W', sendWhatToAnswer, 'What To Answer (Ctrl+Shift+W)');

  const sendRecap = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ghost:trigger-recap');
    }
  };
  safeRegister('Alt+R', sendRecap, 'Recap Meeting (Alt+R)');
  safeRegister('CommandOrControl+Shift+R', sendRecap, 'Recap Meeting (Ctrl+Shift+R)');

  const sendFollowUp = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ghost:trigger-follow-up');
    }
  };
  safeRegister('Alt+F', sendFollowUp, 'Follow-Up Questions (Alt+F)');
  safeRegister('CommandOrControl+Shift+F', sendFollowUp, 'Follow-Up Questions (Ctrl+Shift+F)');

  const sendShorten = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ghost:trigger-shorten');
    }
  };
  safeRegister('Alt+K', sendShorten, 'Shorten Response (Alt+K)');
  safeRegister('CommandOrControl+Shift+K', sendShorten, 'Shorten Response (Ctrl+Shift+K)');

  safeRegister('CommandOrControl+Shift+Y', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ghost:trigger-copy-response');
    }
  }, 'Copy Last Response Action');
}

let currentStreamAbort = false;

// ─────────────────────────────────────────────────────────────
// Unified AI Dispatcher & Model Router (PRD Phases 1–3)
// ─────────────────────────────────────────────────────────────
async function streamAiResponse(params: {
  prompt: string;
  imageBase64?: string;
  history?: ChatMessage[];
  onChunk: (chunk: string) => void;
}): Promise<string> {
  let config: ReturnType<typeof configService.getConfig>;
  try {
    config = configService.getConfig();
  } catch (configErr: any) {
    throw new Error(`Failed to load configuration: ${configErr?.message || 'Unknown error'}. Please check Settings.`);
  }

  const primaryProvider = (config.provider || 'gemini') as ProviderId;
  let preferences;
  try {
    preferences = modelRegistryStore.getPreferences();
  } catch {
    preferences = { billingMode: 'FREE_ONLY' as const, privacyMode: 'STANDARD' as const, hardCaps: { maxFallbackAttempts: 2 } };
  }

  // 1. Resolve request intent, modality constraints & task profile (PRD §6.3, §8.1)
  let routingRequest;
  try {
    routingRequest = capabilityResolver.resolveRequest({
      prompt: params.prompt,
      imageBase64: params.imageBase64,
      billingMode: preferences.billingMode,
      privacyMode: preferences.privacyMode,
      preferredProviderId: primaryProvider,
      preferredModelId: config.model,
    });
  } catch (resolveErr: any) {
    throw new Error(`Failed to resolve AI routing: ${resolveErr?.message || 'Unknown error'}`);
  }

  // 2. Dispatch via FallbackOrchestrator with circuit breaking & quota tracking (PRD §6.5)
  const result = await fallbackOrchestrator.execute(
    routingRequest,
    {
      prompt: params.prompt,
      imageBase64: params.imageBase64,
      history: params.history,
      onChunk: params.onChunk,
      isAborted: () => currentStreamAbort,
    },
    {
      maxProviderSwitches: config.autoFallback ? (preferences.hardCaps.maxFallbackAttempts ?? 2) : 0,
    },
  );

  return result.text;
}

// ─────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────
function setupIpcHandlers(): void {
  // ── 1. Text-to-Text Chat (Streaming) ──
  ipcMain.handle('ghost:chat', async (event, { prompt, history }: { prompt: string; history?: ChatMessage[] }) => {
    const webContents = event.sender;
    if (!prompt?.trim()) {
      webContents.send('ghost:stream-error', 'Empty prompt received.');
      return;
    }

    currentStreamAbort = false;

    try {
      await streamAiResponse({
        prompt,
        history,
        onChunk: (chunk) => {
          if (!webContents.isDestroyed() && !currentStreamAbort) webContents.send('ghost:stream-chunk', chunk);
        },
      });
      if (!webContents.isDestroyed()) webContents.send('ghost:stream-end');
    } catch (err: any) {
      if (!webContents.isDestroyed() && !currentStreamAbort) {
        webContents.send('ghost:stream-error', err?.message || 'Chat generation failed');
      }
    }
  });

  // ── 2. Screen Capture + Vision Analysis ──
  ipcMain.handle('ghost:capture-and-analyze', async (event, { prompt }: { prompt?: string }) => {
    const webContents = event.sender;
    const finalPrompt = prompt?.trim() ||
      'Analyze this screen carefully. If there is a question, coding problem, error, or task — provide the direct, correct answer or solution. Be concise and structured.';

    currentStreamAbort = false;

    try {
      // Hide window briefly, capture, then restore
      const screenshot = await captureScreen(mainWindow);

      // Send preview thumbnail to renderer first
      if (!webContents.isDestroyed()) {
        webContents.send('ghost:screenshot-captured', {
          previewUrl: screenshot.previewUrl,
          prompt: finalPrompt,
        });
      }

      // Stream the vision analysis response
      await streamAiResponse({
        prompt: finalPrompt,
        imageBase64: screenshot.base64,
        onChunk: (chunk) => {
          if (!webContents.isDestroyed() && !currentStreamAbort) webContents.send('ghost:stream-chunk', chunk);
        },
      });

      if (!webContents.isDestroyed()) webContents.send('ghost:stream-end');

      return { previewUrl: screenshot.previewUrl };
    } catch (err: any) {
      const message = err?.message || 'Screen capture or analysis failed';
      if (!webContents.isDestroyed() && !currentStreamAbort) {
        webContents.send('ghost:stream-error', message);
      }
      // Don't rethrow — error already handled via IPC
    }
  });

  // ── 2.5 Stop Stream Abort ──
  ipcMain.handle('ghost:stop-stream', () => {
    currentStreamAbort = true;
    return true;
  });

  // ── 2.8 Push-to-Listen Audio Speech-to-Text ──
  ipcMain.handle('ghost:transcribe-audio', async (_event, { audioBase64, mimeType }: { audioBase64: string; mimeType?: string }) => {
    if (!audioBase64?.trim()) {
      return { success: false, text: '', error: 'No audio captured' };
    }

    try {
      const buffer = Buffer.from(audioBase64, 'base64');
      const config = configService.getConfig();
      const hasGroqKey = !!(config.groqApiKey || process.env.GROQ_API_KEY)?.trim();
      const hasGeminiKey = !!(config.geminiApiKey || process.env.GEMINI_API_KEY)?.trim();

      let transcribedText = '';
      let engine = '';

      if (hasGroqKey) {
        try {
          transcribedText = await groqService.transcribeAudio(buffer, mimeType || 'audio/webm');
          engine = 'groq-whisper';
        } catch (groqErr: any) {
          console.warn('[Voice] Groq Whisper failed, trying Gemini if available:', groqErr?.message || groqErr);
          if (hasGeminiKey) {
            transcribedText = await geminiService.transcribeAudio(buffer, mimeType || 'audio/webm');
            engine = 'gemini-speech';
          } else {
            throw groqErr;
          }
        }
      } else if (hasGeminiKey) {
        transcribedText = await geminiService.transcribeAudio(buffer, mimeType || 'audio/webm');
        engine = 'gemini-speech';
      } else {
        throw new Error('Please configure a free Groq API key or Gemini API key in Settings to use Push-to-Listen voice transcription.');
      }

      if (transcribedText) {
        nativeAudioService.addTranscriptItem({
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          speaker: 'user',
          text: transcribedText,
          timestamp: Date.now(),
        });
      }

      return { success: true, text: transcribedText, engine };
    } catch (err: any) {
      console.error('[Voice] Transcription error:', err);
      return { success: false, text: '', error: err?.message || 'Speech-to-text transcription failed.' };
    }
  });

  // ── 2.9 Real-Time Meeting & System Audio (Rust WASAPI / ScreenCaptureKit) ──
  try {
    nativeAudioService.onTranscript((item) => {
      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ghost:meeting-transcript', item);
        }
      } catch (err) {
        console.warn('[NativeAudio] Failed to send transcript to renderer:', err);
      }
    });

    nativeAudioService.onStatus((status) => {
      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ghost:meeting-status', status);
        }
      } catch (err) {
        console.warn('[NativeAudio] Failed to send status to renderer:', err);
      }
    });
  } catch (err) {
    console.warn('[NativeAudio] Failed to register audio event listeners:', err);
  }

  ipcMain.handle('ghost:start-meeting-audio', (_event, { deviceId }: { deviceId?: string } = {}) => {
    try {
      const cleanDeviceId = (deviceId && deviceId !== 'default' && deviceId.trim()) ? deviceId.trim() : undefined;
      return nativeAudioService.startSystemCapture(cleanDeviceId);
    } catch (err: any) {
      console.error('[IPC] start-meeting-audio error:', err);
      return { success: false, error: err?.message || 'Failed to start meeting audio' };
    }
  });

  ipcMain.handle('ghost:stop-meeting-audio', () => {
    try {
      return nativeAudioService.stopSystemCapture();
    } catch (err: any) {
      console.error('[IPC] stop-meeting-audio error:', err);
      return { success: false, error: err?.message || 'Failed to stop meeting audio' };
    }
  });

  ipcMain.handle('ghost:get-audio-devices', () => {
    try {
      return nativeAudioService.getAudioDevices();
    } catch (err: any) {
      console.error('[IPC] get-audio-devices error:', err);
      return { inputs: [], outputs: [] };
    }
  });

  ipcMain.handle('ghost:get-rolling-transcript', () => {
    try {
      return nativeAudioService.getRollingTranscript();
    } catch (err: any) {
      console.error('[IPC] get-rolling-transcript error:', err);
      return [];
    }
  });

  ipcMain.handle('ghost:clear-rolling-transcript', () => {
    try {
      nativeAudioService.clearTranscript();
      return true;
    } catch (err: any) {
      console.error('[IPC] clear-rolling-transcript error:', err);
      return false;
    }
  });

  // ── 3. Settings & Config ──
  ipcMain.handle('ghost:get-config', () => {
    try {
      return configService.getConfig();
    } catch (err: any) {
      console.error('[IPC] get-config error:', err);
      return {};
    }
  });

  ipcMain.handle('ghost:save-config', (_event, newConfig) => {
    try {
      return configService.setConfig(newConfig);
    } catch (err: any) {
      console.error('[IPC] save-config error:', err);
      return { error: err?.message || 'Failed to save config' };
    }
  });

  ipcMain.handle('ghost:test-api-key', async (_event, payload: string | { apiKey: string; provider?: 'gemini' | 'groq' | 'openrouter' | 'router'; baseUrl?: string; model?: string }) => {
    const apiKey = typeof payload === 'string' ? payload : payload?.apiKey;
    const provider = typeof payload === 'object' ? payload?.provider : 'gemini';
    const baseUrl = typeof payload === 'object' ? payload?.baseUrl : undefined;
    const model = typeof payload === 'object' ? payload?.model : undefined;

    if (provider === 'groq') {
      if (!apiKey?.trim()) return { success: false, error: 'No Groq API key provided' };
      return groqService.testApiKey(apiKey.trim());
    } else if (provider === 'openrouter') {
      if (!apiKey?.trim()) return { success: false, error: 'No OpenRouter API key provided' };
      return openrouterService.testApiKey(apiKey.trim());
    } else if (provider === 'router') {
      return routerService.testEndpoint({ baseUrl, apiKey, model });
    }
    if (!apiKey?.trim()) return { success: false, error: 'No Gemini API key provided' };
    return geminiService.testApiKey(apiKey.trim());
  });

  // ── 4. Ghost Shield Permanent Lock ──
  ipcMain.handle('ghost:toggle-ghost-mode', () => {
    // 🛡️ Permanently locked ON during interviews to eliminate any accidental leak risk
    if (mainWindow && !mainWindow.isDestroyed()) {
      isGhostModeActive = true;
      enforceStealthProtection(mainWindow);
    }
    return true; // Always locked ON
  });

  // ── 5. Dynamic Window Height Resizing ──
  ipcMain.handle('ghost:set-window-height', (_event, height: number) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const [currentWidth] = mainWindow.getSize();
    const currentDisplay = screen.getDisplayMatching(mainWindow.getBounds()) || screen.getPrimaryDisplay();
    const maxHeight = Math.round(currentDisplay.workArea.height * 0.95);
    const targetHeight = Math.min(Math.max(height, 52), maxHeight);
    mainWindow.setSize(currentWidth, targetHeight, true);
    enforceStealthProtection(mainWindow);
  });

  ipcMain.handle('ghost:toggle-window-size', () => {
    return toggleWindowSize();
  });

  // ── 6. Click-Through Mode ──
  ipcMain.handle('ghost:set-click-through', (_event, enabled: boolean) => {
    return setClickThrough(enabled);
  });

  ipcMain.handle('ghost:toggle-click-through', () => {
    return toggleClickThrough();
  });

  ipcMain.handle('ghost:set-ignore-mouse-events', (_event, ignore: boolean, options?: { forward?: boolean }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setIgnoreMouseEvents(ignore, options);
    }
  });

  // ── 7. Session Export (Markdown/Text) ──
  ipcMain.handle('ghost:export-session', async (_event, { content, defaultName }: { content: string; defaultName?: string }) => {
    if (!mainWindow || mainWindow.isDestroyed()) return { success: false, error: 'Window not available' };

    const result = await (dialog.showSaveDialog(mainWindow, {
      title: 'Export Ghost AI Session',
      defaultPath: defaultName || `ghost-session-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.md`,
      filters: [
        { name: 'Markdown Document (*.md)', extensions: ['md'] },
        { name: 'Text Document (*.txt)', extensions: ['txt'] },
        { name: 'All Files (*.*)', extensions: ['*'] }
      ]
    }) as any);

    if (!result || result.canceled || !result.filePath) return { success: false, canceled: true };
    const filePath = result.filePath as string;

    try {
      const fs = await import('fs/promises');
      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true, filePath };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to save session' };
    }
  });

  // ── 8. Model Registry & Intelligent Router (PRD §6.8, §6.9) ──
  ipcMain.handle('ghost:get-models', () => {
    try {
      return modelRegistry.getAll();
    } catch (err: any) {
      console.error('[IPC] get-models error:', err);
      return [];
    }
  });

  ipcMain.handle('ghost:get-diagnostics', () => {
    try {
      return {
        metrics: diagnostics.getMetrics(),
        recentTraces: diagnostics.getTraces(50),
      };
    } catch (err: any) {
      console.error('[IPC] get-diagnostics error:', err);
      return { metrics: {}, recentTraces: [] };
    }
  });

  ipcMain.handle('ghost:get-quotas', () => {
    try {
      return quotaTracker.getAllSnapshots();
    } catch (err: any) {
      console.error('[IPC] get-quotas error:', err);
      return [];
    }
  });

  ipcMain.handle('ghost:get-circuits', () => {
    try {
      return circuitBreakerManager.getAllSnapshots();
    } catch (err: any) {
      console.error('[IPC] get-circuits error:', err);
      return [];
    }
  });

  ipcMain.handle('ghost:refresh-catalogs', async () => {
    const results: any[] = [];
    try {
      const orAdapter = providerRegistry.getAdapter('openrouter');
      const orModels = await orAdapter.listModels();
      results.push(modelCatalogSync.processDiscoveredModels('openrouter', orModels));
    } catch (e: any) {
      console.warn('[CatalogSync] OpenRouter refresh failed:', e?.message || e);
    }
    return results;
  });

  ipcMain.handle('ghost:test-model', async (_event, { providerId, modelId }: { providerId: string; modelId: string }) => {
    try {
      const adapter = providerRegistry.getAdapter(providerId as any);
      const result = await adapter.healthCheck(modelId);
      healthCheckManager.recordProbeResult(providerId as any, modelId, {
        ok: result.ok,
        latencyMs: result.latencyMs,
        testedCapability: 'basic_ping',
        error: result.error,
        timestamp: Date.now(),
      });
      return result;
    } catch (err: any) {
      return { ok: false, latencyMs: 0, error: err?.message || 'Probe failed' };
    }
  });

  ipcMain.handle('ghost:get-model-preferences', () => {
    try {
      return modelRegistryStore.getPreferences();
    } catch (err: any) {
      console.error('[IPC] get-model-preferences error:', err);
      return {};
    }
  });

  ipcMain.handle('ghost:update-model-preferences', (_event, patch: any) => {
    try {
      return modelRegistryStore.updatePreferences(patch);
    } catch (err: any) {
      console.error('[IPC] update-model-preferences error:', err);
      return {};
    }
  });

  ipcMain.handle('ghost:reset-circuits', () => {
    try {
      circuitBreakerManager.resetAll();
      return true;
    } catch (err: any) {
      console.error('[IPC] reset-circuits error:', err);
      return false;
    }
  });

  ipcMain.handle('ghost:get-health-telemetry', () => {
    try {
      return healthCheckManager.getAllTelemetry();
    } catch (err: any) {
      console.error('[IPC] get-health-telemetry error:', err);
      return [];
    }
  });

  ipcMain.handle('ghost:run-health-probes', async () => {
    const models = modelRegistry.getAll();
    const results: any[] = [];
    for (const m of models) {
      if (m.health === 'down' || m.status === 'disabled') continue;
      try {
        const adapter = providerRegistry.getAdapter(m.providerId);
        const res = await adapter.healthCheck(m.modelId);
        healthCheckManager.recordProbeResult(m.providerId, m.modelId, {
          ok: res.ok,
          latencyMs: res.latencyMs,
          testedCapability: 'basic_ping',
          error: res.error,
          timestamp: Date.now(),
        });
        results.push({ providerId: m.providerId, modelId: m.modelId, ...res });
      } catch (err: any) {
        healthCheckManager.recordProbeResult(m.providerId, m.modelId, {
          ok: false,
          latencyMs: 0,
          testedCapability: 'basic_ping',
          error: err?.message || 'Probe error',
          timestamp: Date.now(),
        });
        results.push({ providerId: m.providerId, modelId: m.modelId, ok: false, latencyMs: 0, error: err?.message });
      }
    }
    return results;
  });


  // ── 8. Window Controls ──
  ipcMain.handle('ghost:minimize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
  });

  ipcMain.handle('ghost:close', () => {
    app.quit();
  });
}

// ─────────────────────────────────────────────────────────────
// App Lifecycle
// ─────────────────────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running — bring it to front
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    try {
      // Suppress the default app menu (reduces footprint)
      Menu.setApplicationMenu(null);

      setupIpcHandlers();
      mainWindow = createGhostWindow();
      createTray();
      registerGlobalHotkeys();
      startStealthHeartbeat();
    } catch (err) {
      console.error('[Ghost Copilot] Critical initialization error:', err);
    }

    app.on('activate', () => {
      try {
        if (BrowserWindow.getAllWindows().length === 0) {
          mainWindow = createGhostWindow();
          startStealthHeartbeat();
        }
      } catch (err) {
        console.error('[Ghost Copilot] Activate error:', err);
      }
    });
  }).catch((err) => {
    console.error('[Ghost Copilot] App ready failed:', err);
  });

  app.on('will-quit', () => {
    try {
      stopStealthHeartbeat();
      globalShortcut.unregisterAll();
    } catch (err) {
      console.error('[Ghost Copilot] Cleanup error on will-quit:', err);
    }
  });

  app.on('window-all-closed', () => {
    try {
      stopStealthHeartbeat();
    } catch (err) {
      // Non-fatal
    }
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
