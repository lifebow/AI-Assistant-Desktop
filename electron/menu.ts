/**
 * Application Menu for Electron Desktop App
 */

import { app, Menu, shell, BrowserWindow, dialog } from 'electron';

interface MenuOptions {
    onNewChat: () => void;
    onSettings: () => void;
    onAbout: () => void;
}

export function createAppMenu(options: MenuOptions): Menu {
    const isMac = process.platform === 'darwin';

    const template: Electron.MenuItemConstructorOptions[] = [
        // App menu (macOS only)
        ...(isMac ? [{
            label: app.name,
            submenu: [
                { role: 'about' as const },
                { type: 'separator' as const },
                {
                    label: 'Settings...',
                    accelerator: 'Command+,',
                    click: options.onSettings
                },
                { type: 'separator' as const },
                { role: 'services' as const },
                { type: 'separator' as const },
                { role: 'hide' as const },
                { role: 'hideOthers' as const },
                { role: 'unhide' as const },
                { type: 'separator' as const },
                { role: 'quit' as const }
            ]
        }] : []),

        // File menu
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Chat',
                    accelerator: 'CmdOrCtrl+N',
                    click: options.onNewChat
                },
                { type: 'separator' as const },
                {
                    label: 'Settings...',
                    accelerator: isMac ? undefined : 'Ctrl+,',
                    click: options.onSettings,
                    visible: !isMac
                },
                ...(isMac ? [] : [
                    { type: 'separator' as const },
                    { role: 'quit' as const }
                ])
            ]
        },

        // Edit menu
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' as const },
                { role: 'redo' as const },
                { type: 'separator' as const },
                { role: 'cut' as const },
                { role: 'copy' as const },
                { role: 'paste' as const },
                ...(isMac ? [
                    { role: 'pasteAndMatchStyle' as const },
                    { role: 'delete' as const },
                    { role: 'selectAll' as const }
                ] : [
                    { role: 'delete' as const },
                    { type: 'separator' as const },
                    { role: 'selectAll' as const }
                ])
            ]
        },

        // View menu
        {
            label: 'View',
            submenu: [
                { role: 'reload' as const },
                { role: 'forceReload' as const },
                { role: 'toggleDevTools' as const },
                { type: 'separator' as const },
                { role: 'resetZoom' as const },
                { role: 'zoomIn' as const },
                { role: 'zoomOut' as const },
                { type: 'separator' as const },
                { role: 'togglefullscreen' as const }
            ]
        },

        // Window menu
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' as const },
                { role: 'zoom' as const },
                ...(isMac ? [
                    { type: 'separator' as const },
                    { role: 'front' as const },
                    { type: 'separator' as const },
                    { role: 'window' as const }
                ] : [
                    { role: 'close' as const }
                ])
            ]
        },

        // Help menu
        {
            role: 'help' as const,
            submenu: [
                {
                    label: 'Documentation',
                    click: async () => {
                        await shell.openExternal('https://github.com/user/ai-assistant#readme');
                    }
                },
                { type: 'separator' as const },
                {
                    label: 'About AI Assistant',
                    click: options.onAbout
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    return menu;
}

/**
 * Create and show an About dialog
 */
export function showAboutDialog() {
    dialog.showMessageBox({
        type: 'info',
        title: 'About AI Assistant',
        message: 'AI Assistant',
        detail: `Version: ${app.getVersion()}\n\nA cross-platform AI assistant desktop application.\n\nBuilt with Electron, React, and TypeScript.`,
        buttons: ['OK']
    });
}
