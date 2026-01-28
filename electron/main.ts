import { app, BrowserWindow, globalShortcut, ipcMain, Menu, Tray, nativeImage, dialog, desktopCapturer, screen } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store';
import * as fs from 'fs';
import type { AppConfig } from '../src/lib/types';
import { captureSelectedText, checkAccessibilityPermission, requestAccessibilityPermission } from './text-capture';
import { createAppMenu, showAboutDialog } from './menu';
import { registerApiHandlers } from './ipc/api';
import { setupAutoUpdater } from './updater';
import { registerScreenshotHandlers } from './ipc/screenshot';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simple file logger
function logToFile(message: string, ...args: any[]) {
  const logPath = join(app.getPath('userData'), 'app.log');
  const timestamp = new Date().toISOString();
  const formattedArgs = args.map(arg => {
    if (arg instanceof Error) return arg.stack || arg.toString();
    if (typeof arg === 'object') return JSON.stringify(arg);
    return arg;
  }).join(' ');
  const logMessage = `[${timestamp}] ${message} ${formattedArgs}\n`;
  try {
    fs.appendFileSync(logPath, logMessage);
  } catch (e) {
    // ignore logging errors
  }
}

// Initialize electron-store
const store = new Store<{ appConfig: AppConfig }>();

let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let cropOverlayWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 700,
    minWidth: 400,
    minHeight: 500,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'AI Assistant',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 15, y: 15 },
    show: false, // Don't show until ready
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173/src/popup/index.html');
    // Don't auto-open devtools
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/src/popup/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    if (isDev) {
      mainWindow?.webContents.openDevTools();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Hide instead of close on macOS
  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin' && !isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'AI Assistant Settings',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 15, y: 15 },
    show: false,
  });

  if (isDev) {
    settingsWindow.loadURL('http://localhost:5173/src/options/index.html');
  } else {
    settingsWindow.loadFile(join(__dirname, '../dist/src/options/index.html'));
  }

  settingsWindow.once('ready-to-show', () => {
    settingsWindow?.show();
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// Flag to prevent multiple crop windows being created simultaneously
let isCreatingCropWindow = false;

function createCropOverlayWindow(screenshotDataUrl: string, displayBounds: Electron.Rectangle) {
  // Prevent multiple simultaneous creations
  if (cropOverlayWindow || isCreatingCropWindow) {
    console.log('[Crop] Window already exists or is being created');
    if (cropOverlayWindow) {
      cropOverlayWindow.focus();
    }
    return;
  }

  isCreatingCropWindow = true;
  console.log('[Crop] Creating overlay window', displayBounds);
  logToFile('[Crop] Creating overlay window', displayBounds);

  try {
    cropOverlayWindow = new BrowserWindow({
      x: displayBounds.x,
      y: displayBounds.y,
      width: displayBounds.width,
      height: displayBounds.height,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      fullscreenable: false,
      show: false, // Don't show until ready
      webPreferences: {
        preload: join(__dirname, 'crop-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
      hasShadow: false,
      enableLargerThanScreen: true,
      type: 'panel', // Helps with staying on top of full-screen apps on macOS
    });

    // Set window level to screen-saver (highest) on macOS to cover Dock/Menu Bar
    if (process.platform === 'darwin') {
      cropOverlayWindow.setAlwaysOnTop(true, 'screen-saver');
      // Ensure bounds are strictly enforced
      cropOverlayWindow.setBounds(displayBounds);
    }


    // Store screenshot for later
    const pendingScreenshot = screenshotDataUrl;

    if (isDev) {
      const url = 'http://localhost:5173/src/crop/index.html';
      logToFile('[Crop] Loading URL:', url);
      cropOverlayWindow.loadURL(url);
    } else {
      const path = join(__dirname, '../dist/src/crop/index.html');
      logToFile('[Crop] Loading file:', path);
      cropOverlayWindow.loadFile(path);
    }

    // Wait for renderer to be ready before showing
    // This avoids race conditions where the window might be shown before React is hydrated
    ipcMain.once('crop-ready', () => {
      console.log('[Crop] Renderer ready, showing window and sending screenshot');
      logToFile('[Crop] Renderer ready, showing window');
      if (cropOverlayWindow) {
        // Enforce bounds again just in case OS tried to constrain it
        cropOverlayWindow.setBounds(displayBounds);
        cropOverlayWindow.show();
        cropOverlayWindow.focus();
        cropOverlayWindow.webContents.send('crop-screenshot', { screenshot: pendingScreenshot });
      }
      isCreatingCropWindow = false;
    });

    // Handle load failure
    cropOverlayWindow.webContents.once('did-fail-load', (_event, errorCode, errorDescription) => {
      console.error('[Crop] Failed to load:', errorCode, errorDescription);
      logToFile('[Crop] Failed to load:', errorCode, errorDescription);
      closeCropOverlayWindow();
      isCreatingCropWindow = false;
    });

    cropOverlayWindow.on('closed', () => {
      console.log('[Crop] Window closed');
      cropOverlayWindow = null;
      isCreatingCropWindow = false;
    });

  } catch (err) {
    console.error('[Crop] Failed to create window:', err);
    isCreatingCropWindow = false;
    // Show main window again on error
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  }
}

function closeCropOverlayWindow() {
  console.log('[Crop] Closing overlay window');
  if (cropOverlayWindow) {
    try {
      cropOverlayWindow.close();
    } catch (e) {
      console.error('[Crop] Error closing window:', e);
    }
    cropOverlayWindow = null;
  }
  isCreatingCropWindow = false;
  // Show main window again
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
}
function createTray() {
  // Create tray icon
  const iconPath = isDev
    ? join(__dirname, '../public/icons/icon16.png')
    : join(__dirname, '../dist/icons/icon16.png');

  try {
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  } catch (e) {
    tray = new Tray(nativeImage.createEmpty());
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show AI Assistant',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createMainWindow();
        }
      },
    },
    {
      label: 'New Chat',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('new-chat');
        } else {
          createMainWindow();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        createSettingsWindow();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('AI Assistant');
  tray.setContextMenu(contextMenu);

  // Click tray to show window
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    } else {
      createMainWindow();
    }
  });
}

const getElectronAccelerator = (key: string, modifiers: string[]) => {
  // Map modifiers
  const electronModifiers = modifiers.map(m => {
    const lower = m.toLowerCase();
    if (lower === 'cmd' || lower === 'command' || lower === 'meta') return 'Command';
    if (lower === 'ctrl' || lower === 'control') return 'Control';
    if (lower === 'alt' || lower === 'option') return 'Alt';
    if (lower === 'shift') return 'Shift';
    return m.charAt(0).toUpperCase() + m.slice(1);
  });

  // Map key
  let electronKey = key.toUpperCase();
  const lowerKey = key.toLowerCase();

  // Special key mappings
  const keyMap: Record<string, string> = {
    'arrowup': 'Up',
    'arrowdown': 'Down',
    'arrowleft': 'Left',
    'arrowright': 'Right',
    ' ': 'Space',
    'space': 'Space',
    'enter': 'Return',
    'return': 'Return',
    'escape': 'Escape',
    'esc': 'Escape',
    'tab': 'Tab',
    'backspace': 'Backspace',
    'delete': 'Delete',
    'insert': 'Insert',
    'home': 'Home',
    'end': 'End',
    'pageup': 'PageUp',
    'pagedown': 'PageDown',
    'plus': 'Plus',
    'mediaandtracknext': 'MediaNextTrack',
    'mediaandtrackprevious': 'MediaPreviousTrack',
    'mediastop': 'MediaStop',
    'mediaplaypause': 'MediaPlayPause',
    'printscreen': 'PrintScreen'
  };

  if (keyMap[lowerKey]) {
    electronKey = keyMap[lowerKey];
  } else if (lowerKey.length === 1) {
    // Single char
    electronKey = lowerKey.toUpperCase();
  }

  return `${electronModifiers.join('+')}+${electronKey}`;
};

async function updateGlobalShortcuts(config: AppConfig) {
  // Unregister all shortcuts to start fresh
  globalShortcut.unregisterAll();

  // 1. Register Default Capture Shortcut
  let defaultAccelerator = process.platform === 'darwin' ? 'Command+Shift+Y' : 'Control+Shift+Y';

  if (config.customHotkey) {
    defaultAccelerator = getElectronAccelerator(config.customHotkey.key, config.customHotkey.modifiers);
  }

  try {
    globalShortcut.register(defaultAccelerator, async () => {
      console.log('Global capture shortcut triggered');
      await handleGlobalCapture();
    });
  } catch (e) {
    console.error(`Failed to register global shortcut: ${defaultAccelerator}`, e);
  }

  // 1.5 Register Crop Shortcut
  if (config.cropHotkey) {
    const cropAccelerator = getElectronAccelerator(config.cropHotkey.key, config.cropHotkey.modifiers);
    try {
      globalShortcut.register(cropAccelerator, async () => {
        console.log('Crop shortcut triggered');
        logToFile('Crop shortcut triggered');

        // Prevent multiple crop windows
        if (cropOverlayWindow || isCreatingCropWindow) {
          console.log('Crop overlay already open or being created');
          logToFile('Crop overlay already open or being created');
          return;
        }

        // Hide main window first to capture external apps
        const wasMainVisible = mainWindow?.isVisible() ?? false;
        if (mainWindow && wasMainVisible) {
          mainWindow.hide();
        }

        // Wait for window to actually hide (macOS animation takes time)
        await new Promise(resolve => setTimeout(resolve, 500));

        // Capture screenshot while windows are hidden
        let screenshotDataUrl: string | null = null;
        let displayBounds: Electron.Rectangle | null = null;

        try {
          // 1. Detect which display the cursor is on
          const cursorPoint = screen.getCursorScreenPoint();
          const targetDisplay = screen.getDisplayNearestPoint(cursorPoint);
          displayBounds = targetDisplay.bounds;

          logToFile(`Cursor at: ${cursorPoint.x},${cursorPoint.y}`);
          logToFile(`Target Display: ${targetDisplay.id} [${displayBounds.x},${displayBounds.y} ${displayBounds.width}x${displayBounds.height}] scale:${targetDisplay.scaleFactor}`);

          // 2. Capture that specific display
          const scaleFactor = targetDisplay.scaleFactor || 1;
          const { width, height } = targetDisplay.size; // Use size in points * scaleFactor for pixel size

          logToFile('Capturing screen...');
          const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: {
              width: Math.floor(width * scaleFactor),
              height: Math.floor(height * scaleFactor)
            }
          });

          logToFile(`Found ${sources.length} sources`);
          sources.forEach(s => logToFile(`Source: ${s.name} id:${s.id} display_id:${(s as any).display_id}`));

          // Find the source matching our target display
          // Note: display_id property exists on Source in newer Electron
          let targetSource = sources.find(s => (s as any).display_id === targetDisplay.id.toString());

          // Fallback: try to match by name or return first one
          if (!targetSource) {
            logToFile('Could not match by display_id, trying fallback');
            // If primary display, "Screen 1" is consistent
            // But strict matching is hard without display_id. 
            // We'll default to the first one if we can't match, or try to parse id
            targetSource = sources[0];

            // Try better matching for multi-monitor if possible
            // On macOS, 'Screen 1', 'Screen 2' usually match the display index, but display objects don't explicitly have index
          }

          if (targetSource) {
            logToFile(`Selected Source: ${targetSource.name} (${targetSource.id})`);
            screenshotDataUrl = targetSource.thumbnail.toDataURL();
            logToFile('Screenshot captured, length:', screenshotDataUrl!.length);
          } else {
            logToFile('No sources available');
          }

        } catch (err) {
          console.error('Failed to capture screen for crop:', err);
          logToFile('Failed to capture screen:', err);
        }

        if (!screenshotDataUrl || !displayBounds) {
          console.error('Failed to get screenshot or display bounds');
          logToFile('Failed to get screenshot or display bounds');
          // Show main window again if capture failed
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
          return;
        }

        // Create the dedicated crop overlay window
        createCropOverlayWindow(screenshotDataUrl, displayBounds);
      });
    } catch (e) {
      console.error(`Failed to register crop shortcut: ${cropAccelerator}`, e);
    }
  }

  // 2. Register Prompt Shortcuts
  for (const prompt of config.prompts) {
    if (prompt.hotkey && prompt.hotkey.key) {
      const accelerator = getElectronAccelerator(prompt.hotkey.key, prompt.hotkey.modifiers);

      try {
        const success = globalShortcut.register(accelerator, async () => {
          console.log(`Prompt shortcut triggered: ${prompt.name}`);
          // Capture text first
          const text = await captureSelectedText();

          // Open window
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            // Send trigger-prompt event with captured text
            mainWindow.webContents.send('trigger-prompt', {
              promptId: prompt.id,
              text: text || ''
            });
          } else {
            createMainWindow();
            // Wait for window to load
            setTimeout(() => {
              if (mainWindow) {
                mainWindow.webContents.send('trigger-prompt', {
                  promptId: prompt.id,
                  text: text || ''
                });
              }
            }, 500);
          }
        });

        if (!success) {
          console.warn(`Failed to register prompt shortcut (returned false): ${accelerator}`);
        }
      } catch (e) {
        console.error(`Failed to register prompt shortcut: ${accelerator}`, e);
      }
    }
  }
}

async function handleGlobalCapture() {
  // Capture selected text
  let capturedText = '';
  try {
    capturedText = await captureSelectedText();
  } catch (e) {
    console.error('Failed to capture text:', e);
  }

  // Show main window
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createMainWindow();
  }

  // Wait for window to be ready, then send captured text
  setTimeout(() => {
    if (mainWindow && capturedText) {
      mainWindow.webContents.send('selected-text', capturedText);
    }
  }, 100);
}

function checkPermissions() {
  if (process.platform === 'darwin') {
    const hasPermission = checkAccessibilityPermission();
    if (!hasPermission) {
      dialog.showMessageBox({
        type: 'info',
        title: 'Accessibility Permission Required',
        message: 'AI Assistant needs Accessibility permission to capture selected text from other apps.',
        detail: 'Click OK to open System Settings. Grant permission to AI Assistant, then restart the app.',
        buttons: ['OK', 'Skip']
      }).then((result) => {
        if (result.response === 0) {
          requestAccessibilityPermission();
        }
      });
    }
  }
}

function setupAppMenu() {
  createAppMenu({
    onNewChat: () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('new-chat');
      } else {
        createMainWindow();
      }
    },
    onSettings: () => {
      createSettingsWindow();
    },
    onAbout: () => {
      showAboutDialog();
    }
  });
}

// Window controls
ipcMain.on('window-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.minimize();
});

ipcMain.on('window-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win?.isMaximized()) {
    win.unmaximize();
  } else {
    win?.maximize();
  }
});

ipcMain.on('window-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && win === mainWindow && process.platform === 'darwin') {
    win.hide();
  } else {
    // Close settings window or invalid windows, 
    // but for main window on Windows, we might want to hide to tray?
    // User intent on "X" usually means close or hide.
    // Let's stick to hiding Main Window to tray to match global hotkey workflow.
    if (win && win === mainWindow) {
      win.hide();
    } else {
      win?.close();
    }
  }
});

// App lifecycle
app.whenReady().then(() => {
  setupAppMenu();
  createMainWindow();
  createTray();
  const config = store.get('appConfig');
  if (config) {
    updateGlobalShortcuts(config);
  }
  registerApiHandlers();
  registerScreenshotHandlers();

  // Window Resizing IPC
  ipcMain.handle('resize-window', async (_event, width, height) => {
    if (mainWindow) {
      mainWindow.setSize(width, height, true); // true = animate on macOS
    }
  });

  setupAutoUpdater(() => mainWindow);

  // Check permissions after a short delay
  setTimeout(checkPermissions, 2000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS, keep app running in background
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
});

// IPC Handlers
ipcMain.handle('get-config', async () => {
  return store.get('appConfig');
});

ipcMain.handle('set-config', async (_event, config: AppConfig) => {
  store.set('appConfig', config);
  // Re-register shortcuts with new config
  updateGlobalShortcuts(config);
  return true;
});

ipcMain.handle('open-settings', () => {
  createSettingsWindow();
});

ipcMain.handle('get-selected-text', async () => {
  try {
    return await captureSelectedText();
  } catch (e) {
    console.error('Failed to get selected text:', e);
    return '';
  }
});

// Crop overlay IPC handlers
ipcMain.on('crop-complete', (_event, data: { image: string }) => {
  console.log('[Main] Crop complete, received cropped image');
  closeCropOverlayWindow();

  // Send the cropped image to the main window
  if (mainWindow) {
    mainWindow.webContents.send('crop-result', { image: data.image });
  }
});

ipcMain.on('crop-cancel', () => {
  console.log('[Main] Crop cancelled');
  closeCropOverlayWindow();
});

// Keep exit-crop-mode for backwards compatibility (can be removed later)
ipcMain.handle('exit-crop-mode', async () => {
  closeCropOverlayWindow();
});
