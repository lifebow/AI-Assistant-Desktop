/**
 * Auto-updater module for AI Assistant
 */

import electronUpdater from 'electron-updater';
import { dialog, BrowserWindow, ipcMain } from 'electron';

const { autoUpdater } = electronUpdater;

export function setupAutoUpdater(getMainWindow: () => BrowserWindow | null) {
    // Configure logging
    autoUpdater.logger = console;

    // Check for updates immediately on startup (only in production)
    if (process.env.NODE_ENV !== 'development') {
        autoUpdater.checkForUpdatesAndNotify();
    }

    // Update available
    autoUpdater.on('update-available', (_info) => {
        const mainWindow = getMainWindow();
        if (mainWindow) {
            mainWindow.webContents.send('update-available');
        }

        // Optional: Show dialog
        /*
        dialog.showMessageBox({
          type: 'info',
          title: 'Found Updates',
          message: 'Found updates, do you want update now?',
          buttons: ['Sure', 'No']
        }).then((buttonIndex) => {
          if (buttonIndex.response === 0) {
            autoUpdater.downloadUpdate();
          }
        });
        */
    });

    // Update downloaded
    autoUpdater.on('update-downloaded', (_info: any) => {
        const mainWindow = getMainWindow();
        if (mainWindow) {
            mainWindow.webContents.send('update-downloaded');
        }

        dialog.showMessageBox({
            type: 'info',
            title: 'Install Update',
            message: 'Update downloaded. Restart the application to apply the updates.',
            buttons: ['Restart Now', 'Later']
        }).then((result) => {
            if (result.response === 0) {
                autoUpdater.quitAndInstall(false, true);
            }
        });
    });

    // Error handling
    autoUpdater.on('error', (err: any) => {
        console.error('Auto-updater error:', err);
    });

    // IPC handlers for manual checks
    ipcMain.handle('check-for-updates', () => {
        if (process.env.NODE_ENV === 'development') {
            return { updateAvailable: false, message: 'Skipped in dev mode' };
        }
        return autoUpdater.checkForUpdates();
    });

    ipcMain.handle('quit-and-install', () => {
        autoUpdater.quitAndInstall();
    });
}
