import { desktopCapturer, screen, BrowserWindow } from 'electron';

export interface ScreenshotResult {
  base64: string; // JPEG base64 (without data:image prefix) for Gemini API
  previewUrl: string; // Data URL for frontend preview
  width: number;
  height: number;
}

export async function captureScreen(targetWindow?: BrowserWindow | null): Promise<ScreenshotResult> {
  // If window is passed and visible, temporarily hide for 120ms to guarantee zero chance of self-capture
  let wasVisible = false;
  let targetDisplay = screen.getPrimaryDisplay();

  if (targetWindow && !targetWindow.isDestroyed()) {
    try {
      targetDisplay = screen.getDisplayMatching(targetWindow.getBounds());
    } catch {
      targetDisplay = screen.getPrimaryDisplay();
    }

    if (targetWindow.isVisible()) {
      wasVisible = true;
      targetWindow.hide();
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  try {
    const { width, height } = targetDisplay.size;
    const scale = targetDisplay.scaleFactor || 1;
    const captureWidth = Math.round(width * scale);
    const captureHeight = Math.round(height * scale);

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: captureWidth,
        height: captureHeight,
      },
    });

    if (!sources || sources.length === 0) {
      throw new Error('No screen display found to capture.');
    }

    // Match source to the monitor where window is located
    const matchedSource = sources.find((s) => s.display_id === targetDisplay.id.toString()) || sources[0];
    const nativeImage = matchedSource.thumbnail;

    // Compress to 85% JPEG in memory - crisp and compact
    const jpegBuffer = nativeImage.toJPEG(85);
    const base64 = jpegBuffer.toString('base64');
    const previewUrl = `data:image/jpeg;base64,${base64}`;

    return {
      base64,
      previewUrl,
      width: captureWidth,
      height: captureHeight,
    };
  } finally {
    if (wasVisible && targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.show();
      targetWindow.setAlwaysOnTop(true, 'screen-saver', 3);
    }
  }
}
