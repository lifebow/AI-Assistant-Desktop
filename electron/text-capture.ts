/**
 * Text Capture Module for Electron Desktop App
 * 
 * Strategy:
 * 1. Try Accessibility API first (best quality, no clipboard pollution)
 * 2. Fallback to clipboard simulation (Cmd+C + read clipboard)
 */

import { clipboard } from 'electron';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// For clipboard simulation, we'll use robotjs
let robot: any = null;
try {
    robot = require('@jitsi/robotjs');
} catch (e) {
    // console.warn('@jitsi/robotjs not available, trying robotjs or fallback');
    try {
        robot = require('robotjs');
    } catch (e2) {
        // console.warn('robotjs not available');
    }
}

/**
 * Capture selected text from the foreground application
 */
export async function captureSelectedText(): Promise<string> {
    console.log('[TextCapture] captureSelectedText called');

    // 1. Try Native Accessibility API first (best quality, no clipboard pollution)
    try {
        const nativeText = await getSelectedTextNative();
        if (nativeText) {
            console.log('[TextCapture] Native capture success');
            return nativeText;
        }
    } catch (e) {
        console.error('[TextCapture] Native capture failed:', e);
    }

    // 2. Fallback to clipboard simulation
    console.log('[TextCapture] Falling back to clipboard simulation');
    return await simulateCopyAndRead();
}

/**
 * Simulates Cmd+C/Ctrl+C and reads the clipboard
 */
async function simulateCopyAndRead(): Promise<string> {
    // Save current clipboard content
    const previousClipboard = clipboard.readText();

    // Clear clipboard to detect if copy was successful
    clipboard.writeText('');

    // Simulate copy command
    if (process.platform === 'darwin') {
        // macOS: Force AppleScript for stability
        try {
            const { execSync } = require('child_process');
            execSync(`osascript -e 'tell application "System Events" to keystroke "c" using command down'`);
        } catch (e) {
            console.warn('AppleScript keystroke failed:', e);
            if (robot) {
                try {
                    robot.keyTap('c', 'command');
                } catch (rErr) {
                    console.error('[TextCapture] robot fallback failed:', rErr);
                }
            }
        }
    } else {
        // Windows/Linux: Use robotjs
        if (robot) {
            const modifier = 'control';
            try {
                robot.keyTap('c', modifier);
            } catch (err) {
                console.error('[TextCapture] robot.keyTap failed:', err);
            }
        } else {
            console.warn('No robotjs, cannot simulate copy.');
            return previousClipboard;
        }
    }

    // Poll for clipboard change (up to 600ms)
    for (let i = 0; i < 6; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const selectedText = clipboard.readText();
        if (selectedText && selectedText !== '') {
            return selectedText;
        }
    }

    // Final check
    const finalCheck = clipboard.readText();
    if (finalCheck && finalCheck !== '') {
        return finalCheck;
    }

    // Restore previous if failed
    clipboard.writeText(previousClipboard);
    return '';
}

/**
 * Get the currently selected text without modifying clipboard
 */
export async function getSelectedTextNative(): Promise<string | null> {
    if (process.platform === 'darwin') {
        return await getSelectedTextMacOS();
    }
    // Windows native automation is TODO, return null for now to trigger clipboard fallback
    return null;
}

/**
 * macOS: Get selected text using Accessibility API (AppleScript)
 */
async function getSelectedTextMacOS(): Promise<string | null> {
    try {
        const { exec } = require('child_process');
        return new Promise((resolve) => {
            const script = `
        tell application "System Events"
          set frontApp to first application process whose frontmost is true
          set appName to name of frontApp
        end tell
        
        tell application appName
          try
            set selectedText to selection as text
            return selectedText
          on error
            return ""
          end try
        end tell
      `;
            exec(`osascript -e '${script}'`, (error: any, stdout: string) => {
                if (error) {
                    resolve(null);
                } else {
                    resolve(stdout.trim() || null);
                }
            });
        });
    } catch (e) {
        console.warn('Failed to get selected text via AppleScript:', e);
        return null;
    }
}

/**
 * Check if Accessibility permissions are granted
 * Returns true on Windows (not required)
 */
export function checkAccessibilityPermission(): boolean {
    if (process.platform !== 'darwin') {
        return true;
    }
    try {
        const { systemPreferences } = require('electron');
        return systemPreferences.isTrustedAccessibilityClient(false);
    } catch (e) {
        return false;
    }
}

/**
 * Request Accessibility permission
 * Returns true on Windows (not required)
 */
export function requestAccessibilityPermission(): boolean {
    if (process.platform !== 'darwin') {
        return true;
    }
    try {
        const { systemPreferences } = require('electron');
        return systemPreferences.isTrustedAccessibilityClient(true);
    } catch (e) {
        return false;
    }
}
