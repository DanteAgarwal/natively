import { app, BrowserWindow, globalShortcut, ipcMain, screen, Tray, Menu, nativeImage, dialog } from 'electron';
import path from 'path';
import { geminiService, ChatMessage } from './geminiService';
import { groqService } from './groqService';
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
      win.loadFile(path.join(__dirname, '../dist/index.html')).catch((e) => {
        console.error('Could not load app from either dev server or dist:', e);
      });
    });
    // Open DevTools detached (does NOT appear in screen share either)
    // win.webContents.openDevTools({ mode: 'detach' });
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

function registerGlobalHotkeys(): void {
  globalShortcut.unregisterAll();

  // Toggle visibility: Ctrl+\ (or Cmd+\ on macOS)
  globalShortcut.register('CommandOrControl+\\', toggleWindowVisibility);

  // Capture & analyze: Ctrl+Shift+S
  globalShortcut.register('CommandOrControl+Shift+S', triggerCapture);

  // Toggle click-through: Ctrl+Shift+X
  globalShortcut.register('CommandOrControl+Shift+X', () => {
    toggleClickThrough();
  });

  // Stealth Panic Hide: Ctrl+Shift+H
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    panicHide();
  });
}

// ─────────────────────────────────────────────────────────────
// Unified AI Dispatcher (Gemini & Groq with Auto-Fallback)
// ─────────────────────────────────────────────────────────────
async function streamAiResponse(params: {
  prompt: string;
  imageBase64?: string;
  history?: ChatMessage[];
  onChunk: (chunk: string) => void;
}): Promise<string> {
  const config = configService.getConfig();
  const primaryProvider = config.provider || 'gemini';

  const runProvider = async (provider: 'gemini' | 'groq') => {
    if (provider === 'groq') {
      return await groqService.streamGenerate(params);
    } else {
      return await geminiService.streamGenerate(params);
    }
  };

  try {
    return await runProvider(primaryProvider);
  } catch (primaryErr: any) {
    if (config.autoFallback) {
      const fallbackProvider = primaryProvider === 'gemini' ? 'groq' : 'gemini';
      const fallbackKey = fallbackProvider === 'gemini' ? config.geminiApiKey : config.groqApiKey;

      if (fallbackKey?.trim()) {
        const errorSummary = primaryErr?.message || 'Provider failed';
        params.onChunk(`\n\n> ⚠️ *${primaryProvider.toUpperCase()} error: ${errorSummary}. Auto-falling back to ${fallbackProvider.toUpperCase()}...*\n\n`);
        return await runProvider(fallbackProvider);
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

    try {
      await streamAiResponse({
        prompt,
        history,
        onChunk: (chunk) => {
          if (!webContents.isDestroyed()) webContents.send('ghost:stream-chunk', chunk);
        },
      });
      if (!webContents.isDestroyed()) webContents.send('ghost:stream-end');
    } catch (err: any) {
      if (!webContents.isDestroyed()) {
        webContents.send('ghost:stream-error', err?.message || 'Chat generation failed');
      }
    }
  });

  // ── 2. Screen Capture + Vision Analysis ──
  ipcMain.handle('ghost:capture-and-analyze', async (event, { prompt }: { prompt?: string }) => {
    const webContents = event.sender;
    const finalPrompt = prompt?.trim() ||
      'Analyze this screen carefully. If there is a question, coding problem, error, or task — provide the direct, correct answer or solution. Be concise and structured.';

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
          if (!webContents.isDestroyed()) webContents.send('ghost:stream-chunk', chunk);
        },
      });

      if (!webContents.isDestroyed()) webContents.send('ghost:stream-end');

      return { previewUrl: screenshot.previewUrl };
    } catch (err: any) {
      const message = err?.message || 'Screen capture or analysis failed';
      if (!webContents.isDestroyed()) {
        webContents.send('ghost:stream-error', message);
      }
      // Don't rethrow — error already handled via IPC
    }
  });

  // ── 3. Settings & Config ──
  ipcMain.handle('ghost:get-config', () => {
    return configService.getConfig();
  });

  ipcMain.handle('ghost:save-config', (_event, newConfig) => {
    return configService.setConfig(newConfig);
  });

  ipcMain.handle('ghost:test-api-key', async (_event, payload: string | { apiKey: string; provider?: 'gemini' | 'groq' }) => {
    const apiKey = typeof payload === 'string' ? payload : payload?.apiKey;
    const provider = typeof payload === 'object' ? payload?.provider : 'gemini';
    if (!apiKey?.trim()) return { success: false, error: 'No API key provided' };
    if (provider === 'groq') {
      return groqService.testApiKey(apiKey.trim());
    }
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

    mainWindow = createGhostWindow();
    createTray();
    registerGlobalHotkeys();
    setupIpcHandlers();

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
