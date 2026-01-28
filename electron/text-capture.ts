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
// Note: robotjs requires native compilation. If not available, we'll use keyboard simulation

let robot: any = null;
try {
    robot = require('@jitsi/robotjs');
} catch (e) {
    console.warn('@jitsi/robotjs not available, trying robotjs or fallback');
    try {
        robot = require('robotjs');
    } catch (e2) {
        console.warn('robotjs not available');
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
 * This works for most applications
 */
async function simulateCopyAndRead(): Promise<string> {
    // Save current clipboard content
    const previousClipboard = clipboard.readText();

    // Clear clipboard to detect if copy was successful
    clipboard.writeText('');

    // Simulate copy command
    // Simulate copy command
    if (process.platform === 'darwin') {
        // Force AppleScript on macOS for stability (robotjs can be flaky)
        try {
            const { execSync } = require('child_process');
            execSync(`osascript -e 'tell application "System Events" to keystroke "c" using command down'`);
            console.log('[TextCapture] Simulated copy via AppleScript');
        } catch (e) {
            console.warn('AppleScript keystroke failed:', e);
            // Fallback to robotjs if AppleScript fails (unlikely)
            if (robot) {
                try {
                    const modifier = 'command';
                    robot.keyTap('c', modifier);
                } catch (rErr) {
                    console.error('[TextCapture] robot.keyTap fallback failed:', rErr);
                }
            }
        }
    } else if (robot) {
        const modifier = 'control';
        console.log(`[TextCapture] Simulating ${modifier}+c using robotjs`);
        try {
            robot.keyTap('c', modifier);
        } catch (err) {
            console.error('[TextCapture] robot.keyTap failed:', err);
        }
    } else {
        // Fallback for Windows without robotjs? use powershell? (harder)
        // Just log warning for now
        console.warn('No robotjs, cannot simulate copy. Returning clipboard content.');
        return previousClipboard;
    }

    // Poll for clipboard change (up to 600ms)
    // Sometimes osascript/System Events takes time to trigger the copy
    for (let i = 0; i < 6; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const selectedText = clipboard.readText();
        if (selectedText && selectedText !== '') {
            return selectedText;
        }
    }

    // If we're here, it means we timed out or got empty string
    const finalCheck = clipboard.readText();
    if (finalCheck && finalCheck !== '') {
        return finalCheck;
    }

    // If clipboard check failed, restore previous clipboard
    clipboard.writeText(previousClipboard);
    return '';

    // Restore previous clipboard if nothing was selected
    clipboard.writeText(previousClipboard);
    return '';
}

/**
 * Get the currently selected text without modifying clipboard
 * Uses Accessibility API where available (platform-specific)
 */
export async function getSelectedTextNative(): Promise<string | null> {
    // macOS: Use AXUIElement API 
    // Windows: Use UI Automation API
    // These require native modules - placeholder for now

    if (process.platform === 'darwin') {
        return await getSelectedTextMacOS();
    } else if (process.platform === 'win32') {
        return await getSelectedTextWindows();
    }

    return null;
}

/**
 * macOS: Get selected text using Accessibility API
 * Requires native module or AppleScript
 */
async function getSelectedTextMacOS(): Promise<string | null> {
    try {
        // Use AppleScript as a simpler alternative to native module
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
 * Windows: Get selected text using UI Automation API
 * Requires native module - placeholder implementation
 */
async function getSelectedTextWindows(): Promise<string | null> {
    // UI Automation requires native module
    // For now, return null to trigger clipboard fallback
    return null;
}

/**
 * Check if Accessibility permissions are granted (macOS)
 */
export function checkAccessibilityPermission(): boolean {
    if (process.platform !== 'darwin') {
        return true; // Windows doesn't require explicit permission
    }

    try {
        const { systemPreferences } = require('electron');
        return systemPreferences.isTrustedAccessibilityClient(false);
    } catch (e) {
        return false;
    }
}

/**
 * Request Accessibility permission (macOS)
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
