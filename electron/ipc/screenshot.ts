/**
 * Screenshot IPC handlers
 */

import { ipcMain, desktopCapturer, screen, BrowserWindow } from 'electron';

export function registerScreenshotHandlers() {
    ipcMain.handle('capture-screen', async () => {
        try {
            const displays = screen.getAllDisplays();
            // For now, just capture the primary display or the one with cursor
            // To keep it simple, we'll ask for all sources and pick the first screen

            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: 1920, height: 1080 } // Adjust resolution as needed
            });

            const primarySource = sources[0]; // Usually the main screen

            if (primarySource) {
                return primarySource.thumbnail.toDataURL(); // Returns base64 image
            }

            return null;
        } catch (error) {
            console.error('Failed to capture screen:', error);
            return null;
        }
    });
}
