import { desktopCapturer, screen, BrowserWindow } from 'electron';

export interface ScreenshotResult {
  base64: string; // JPEG base64 (without data:image prefix) for Gemini API
  previewUrl: string; // Data URL for frontend preview
  width: number;
  height: number;
}

export async function captureScreen(targetWindow?: BrowserWindow | null): Promise<ScreenshotResult> {
  // If window is passed and visible, temporarily hide for 100ms to guarantee zero chance of self-capture
  let wasVisible = false;
  if (targetWindow && !targetWindow.isDestroyed() && targetWindow.isVisible()) {
    wasVisible = true;
    targetWindow.hide();
    await new Promise((r) => setTimeout(r, 120));
  }

  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    const scale = primaryDisplay.scaleFactor || 1;

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(width * scale),
        height: Math.round(height * scale),
      },
    });

    if (!sources || sources.length === 0) {
      throw new Error('No screen display found to capture.');
    }

    const nativeImage = sources[0].thumbnail;
    // Compress to 85% JPEG in memory - crisp and compact
    const jpegBuffer = nativeImage.toJPEG(85);
    const base64 = jpegBuffer.toString('base64');
    const previewUrl = `data:image/jpeg;base64,${base64}`;

    return {
      base64,
      previewUrl,
      width: Math.round(width * scale),
      height: Math.round(height * scale),
    };
  } finally {
    if (wasVisible && targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.showInactive();
    }
  }
}
