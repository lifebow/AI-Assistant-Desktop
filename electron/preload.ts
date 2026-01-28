import { contextBridge, ipcRenderer } from 'electron';
import type { AppConfig } from '../src/lib/types';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Config management
    getConfig: (): Promise<AppConfig | undefined> => ipcRenderer.invoke('get-config'),
    setConfig: (config: AppConfig): Promise<boolean> => ipcRenderer.invoke('set-config', config),

    // UI actions
    openSettings: (): Promise<void> => ipcRenderer.invoke('open-settings'),
    resizeWindow: (width: number, height: number): Promise<void> => ipcRenderer.invoke('resize-window', width, height),

    // Text selection
    getSelectedText: (): Promise<string> => ipcRenderer.invoke('get-selected-text'),

    // Screenshot (will be implemented)
    captureScreen: (): Promise<string | null> => ipcRenderer.invoke('capture-screen'),

    // API calls (proxy through main process)
    executeApiCall: (messages: any[], config: any): Promise<any> =>
        ipcRenderer.invoke('execute-api-call', { messages, config }),

    fetchModels: (provider: string, apiKey: string, baseUrl?: string): Promise<string[]> =>
        ipcRenderer.invoke('fetch-models', { provider, apiKey, baseUrl }),

    // Stream handling (for streaming API responses)
    onStreamChunk: (callback: (chunk: string) => void) => {
        ipcRenderer.on('stream-chunk', (_event, chunk) => callback(chunk));
    },

    onStreamDone: (callback: () => void) => {
        ipcRenderer.on('stream-done', () => callback());
    },

    onStreamError: (callback: (error: string) => void) => {
        ipcRenderer.on('stream-error', (_event, error) => callback(error));
    },

    // Selected text from global shortcut
    onSelectedText: (callback: (text: string) => void) => {
        ipcRenderer.on('selected-text', (_event, text) => callback(text));
    },

    // New chat signal
    onNewChat: (callback: () => void) => {
        ipcRenderer.on('new-chat', () => callback());
    },

    // Trigger specific prompt from global shortcut
    onTriggerPrompt: (callback: (data: { promptId: string; text: string }) => void) => {
        const subscription = (_event: any, data: { promptId: string; text: string }) => callback(data);
        ipcRenderer.on('trigger-prompt', subscription);
        // Return cleanup function
        return () => {
            ipcRenderer.removeListener('trigger-prompt', subscription);
        };
    },
    onTriggerCrop: (callback: (data: { screenshot: string | null }) => void) => {
        const subscription = (_event: any, data: { screenshot: string | null }) => callback(data);
        ipcRenderer.on('trigger-crop', subscription);
        return () => {
            ipcRenderer.removeListener('trigger-crop', subscription);
        };
    },
    exitCropMode: (): Promise<void> => ipcRenderer.invoke('exit-crop-mode'),

    // Receive cropped image result from dedicated crop window
    onCropResult: (callback: (data: { image: string }) => void) => {
        const subscription = (_event: any, data: { image: string }) => callback(data);
        ipcRenderer.on('crop-result', subscription);
        return () => {
            ipcRenderer.removeListener('crop-result', subscription);
        };
    },

    // Platform detection
    getPlatform: () => process.platform,
    // Window controls
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),

    // Platform info
    platform: process.platform,
});

// TypeScript: Extend Window interface
declare global {
    interface Window {
        electronAPI: {
            getConfig: () => Promise<AppConfig | undefined>;
            setConfig: (config: AppConfig) => Promise<boolean>;
            openSettings: () => Promise<void>;
            resizeWindow: (width: number, height: number) => Promise<void>;
            getSelectedText: () => Promise<string>;
            captureScreen: () => Promise<string | null>;
            executeApiCall: (messages: any[], config: any) => Promise<any>;
            fetchModels: (provider: string, apiKey: string, baseUrl?: string) => Promise<string[]>;
            onStreamChunk: (callback: (chunk: string) => void) => void;
            onStreamDone: (callback: () => void) => void;
            onStreamError: (callback: (error: string) => void) => void;
            onSelectedText: (callback: (text: string) => void) => void;

            onNewChat: (callback: () => void) => void;
            onTriggerPrompt?: (callback: (data: { promptId: string; text: string }) => void) => () => void;
            onTriggerCrop?: (callback: (data: { screenshot: string | null }) => void) => () => void;
            exitCropMode: () => Promise<void>;
            onCropResult?: (callback: (data: { image: string }) => void) => () => void;
            getPlatform: () => string;
        };
    }
}
