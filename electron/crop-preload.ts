import { contextBridge, ipcRenderer } from 'electron';

// Expose crop-specific methods to the crop overlay window
contextBridge.exposeInMainWorld('electronAPI', {
    // Receive screenshot from main process
    onCropScreenshot: (callback: (event: any, data: { screenshot: string }) => void) => {
        ipcRenderer.on('crop-screenshot', callback);
    },

    // Complete crop with the cropped image
    cropComplete: (croppedImageDataUrl: string): void => {
        ipcRenderer.send('crop-complete', { image: croppedImageDataUrl });
    },

    // Cancel crop
    cropCancel: (): void => {
        ipcRenderer.send('crop-cancel');
    },

    // Notify main process that renderer is ready to receive data
    cropReady: (): void => {
        ipcRenderer.send('crop-ready');
    },
});

// Note: Window.electronAPI types are defined in the main preload.ts
// This file only exposes crop-specific methods which are a subset
