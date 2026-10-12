import { app, BrowserWindow, globalShortcut, ipcMain, screen, Tray, Menu, nativeImage, dialog } from 'electron';
import path from 'path';
import { geminiService, ChatMessage } from './geminiService';
import { groqService } from './groqService';
import { openrouterService } from './openrouterService';
import { routerService } from './routerService';
import { captureScreen } from './screenshotService';
import { configService } from './storeService';

try {
  require('dotenv').config();
} catch (e) {
  // Ignored in packaged builds
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isGhostModeActive: boolean = true;
let isClickThroughActive: boolean = false;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// ─────────────────────────────────────────────────────────────
// Window Creation
// ─────────────────────────────────────────────────────────────
function createGhostWindow(): BrowserWindow {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { workArea } = primaryDisplay;

  const winWidth = 560;
  const initialHeight = 620;

  // Multi-monitor safe positioning: right side, near top
  // (right-side default avoids blocking most app content)
  const x = Math.round(workArea.x + workArea.width - winWidth - 20);
  const y = Math.round(workArea.y + 40);

  const win = new BrowserWindow({
    width: winWidth,
    height: initialHeight,
    minWidth: 340,
    minHeight: 52,
    maxWidth: 800,
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
        label: `Ghost Shield: ${isGhostModeActive ? 'ON ✓' : 'OFF ✗'}`,
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            isGhostModeActive = !isGhostModeActive;
            mainWindow.setContentProtection(isGhostModeActive);
            updateTrayContextMenu();
          }
        },
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
  }
  mainWindow.webContents.send('ghost:trigger-listen-hotkey');
}

function registerGlobalHotkeys(): void {
  globalShortcut.unregisterAll();

  // Toggle visibility: Ctrl+\ (or Cmd+\ on macOS)
  globalShortcut.register('CommandOrControl+\\', toggleWindowVisibility);

  // Capture & analyze: Ctrl+Shift+S
  globalShortcut.register('CommandOrControl+Shift+S', triggerCapture);

  // Push-to-Listen (Voice STT): Ctrl+Shift+L and F9
  try {
    globalShortcut.register('CommandOrControl+Shift+L', triggerListen);
  } catch (err) {
    console.warn('Failed to register Ctrl+Shift+L hotkey:', err);
  }
  try {
    globalShortcut.register('F9', triggerListen);
  } catch (err) {
    console.warn('Failed to register F9 hotkey:', err);
  }

  // Toggle click-through: Ctrl+Shift+X
  globalShortcut.register('CommandOrControl+Shift+X', () => {
    toggleClickThrough();
  });

  // Stealth Panic Hide: Ctrl+Shift+H
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    panicHide();
  });
}

let currentStreamAbort = false;

// ─────────────────────────────────────────────────────────────
// Unified AI Dispatcher (Gemini, Groq, OpenRouter & Universal Router with Auto-Fallback)
// ─────────────────────────────────────────────────────────────
async function streamAiResponse(params: {
  prompt: string;
  imageBase64?: string;
  history?: ChatMessage[];
  onChunk: (chunk: string) => void;
}): Promise<string> {
  const config = configService.getConfig();
  const primaryProvider = config.provider || 'gemini';

  const streamParams = {
    ...params,
    isAborted: () => currentStreamAbort,
  };

  // Screen capture & vision handling:
  // If Groq is primary (pure text inference) and an image is attached, route vision to OpenRouter or Gemini
  if (params.imageBase64 && primaryProvider === 'groq') {
    const geminiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;
    const openrouterKey = config.openrouterApiKey || process.env.OPENROUTER_API_KEY;

    if (geminiKey?.trim()) {
      params.onChunk(`> ℹ️ *Groq is active for text. Routing screen capture to Gemini Vision...*\n\n`);
      return await geminiService.streamGenerate(streamParams);
    } else if (openrouterKey?.trim()) {
      params.onChunk(`> ℹ️ *Groq is active for text. Routing screen capture to OpenRouter Free Vision...*\n\n`);
      return await openrouterService.streamGenerate(streamParams);
    } else {
      throw new Error(
        'Groq currently does not support screen/image analysis. ' +
        'Please add a free OpenRouter key or Gemini key in Settings to enable screen vision analysis.'
      );
    }
  }

  const runProvider = async (provider: 'gemini' | 'groq' | 'openrouter' | 'router') => {
    if (provider === 'groq') {
      return await groqService.streamGenerate(streamParams);
    } else if (provider === 'openrouter') {
      return await openrouterService.streamGenerate(streamParams);
    } else if (provider === 'router') {
      return await routerService.streamGenerate(streamParams);
    } else {
      return await geminiService.streamGenerate(streamParams);
    }
  };

  try {
    return await runProvider(primaryProvider);
  } catch (primaryErr: any) {
    if (currentStreamAbort) {
      return '';
    }
    if (config.autoFallback) {
      // Find candidate fallback providers that have valid credentials or are zero-key
      const fallbackOptions: Array<'gemini' | 'groq' | 'openrouter' | 'router'> = [
        'openrouter',
        'gemini',
        'groq',
        'router',
      ].filter((p) => p !== primaryProvider) as any;

      for (const fallbackProvider of fallbackOptions) {
        const hasKey =
          fallbackProvider === 'gemini'
            ? !!config.geminiApiKey?.trim()
            : fallbackProvider === 'groq'
            ? !!config.groqApiKey?.trim()
            : fallbackProvider === 'openrouter'
            ? !!config.openrouterApiKey?.trim()
            : (config.routerPreset === 'pollinations' || !!config.routerBaseUrl?.trim());

        if (hasKey) {
          const errorSummary = primaryErr?.message || 'Primary provider failed';
          params.onChunk(`\n\n> ⚠️ *${primaryProvider.toUpperCase()} error: ${errorSummary}. Auto-falling back to ${fallbackProvider.toUpperCase()}...*\n\n`);
          try {
            return await runProvider(fallbackProvider);
          } catch (fallbackErr) {
            console.warn(`[Dispatcher] Fallback provider ${fallbackProvider} also failed:`, fallbackErr);
            // Continue to next fallback in list
          }
        }
      }
    }
    throw primaryErr;
  }
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

      if (hasGroqKey) {
        try {
          const text = await groqService.transcribeAudio(buffer, mimeType || 'audio/webm');
          return { success: true, text, engine: 'groq-whisper' };
        } catch (groqErr: any) {
          console.warn('[Voice] Groq Whisper failed, trying Gemini if available:', groqErr?.message || groqErr);
          if (hasGeminiKey) {
            const text = await geminiService.transcribeAudio(buffer, mimeType || 'audio/webm');
            return { success: true, text, engine: 'gemini-speech' };
          }
          throw groqErr;
        }
      } else if (hasGeminiKey) {
        const text = await geminiService.transcribeAudio(buffer, mimeType || 'audio/webm');
        return { success: true, text, engine: 'gemini-speech' };
      } else {
        throw new Error('Please configure a free Groq API key or Gemini API key in Settings to use Push-to-Listen voice transcription.');
      }
    } catch (err: any) {
      console.error('[Voice] Transcription error:', err);
      return { success: false, text: '', error: err?.message || 'Speech-to-text transcription failed.' };
    }
  });

  // ── 3. Settings & Config ──
  ipcMain.handle('ghost:get-config', () => {
    return configService.getConfig();
  });

  ipcMain.handle('ghost:save-config', (_event, newConfig) => {
    return configService.setConfig(newConfig);
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

  // ── 4. Ghost Shield Toggle ──
  ipcMain.handle('ghost:toggle-ghost-mode', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return isGhostModeActive;
    isGhostModeActive = !isGhostModeActive;
    mainWindow.setContentProtection(isGhostModeActive);
    return isGhostModeActive;
  });

  // ── 5. Dynamic Window Height Resizing ──
  ipcMain.handle('ghost:set-window-height', (_event, height: number) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const [currentWidth] = mainWindow.getSize();
    const primaryDisplay = screen.getPrimaryDisplay();
    const maxHeight = Math.round(primaryDisplay.workArea.height * 0.95);
    const targetHeight = Math.min(Math.max(height, 52), maxHeight);
    mainWindow.setSize(currentWidth, targetHeight, true);
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
    // Suppress the default app menu (reduces footprint)
    Menu.setApplicationMenu(null);

    setupIpcHandlers();
    mainWindow = createGhostWindow();
    createTray();
    registerGlobalHotkeys();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createGhostWindow();
      }
    });
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
