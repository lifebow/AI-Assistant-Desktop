import { DEFAULT_CONFIG } from '../lib/types';

chrome.runtime.onInstalled.addListener(async () => {
  // Initialize storage with defaults if not present
  const { appConfig } = await chrome.storage.sync.get('appConfig');
  if (!appConfig) {
    await chrome.storage.sync.set({ appConfig: DEFAULT_CONFIG });
  }

  // Create context menu
  chrome.contextMenus.create({
    id: "ai-ask-context",
    title: "Ask AI Assistant",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "ai-ask-image",
    title: "Ask AI about this image",
    contexts: ["image"]
  });
});

const openUi = async () => {
    // Method 1: Try to open the Browser Action Popup (Preferred)
    try {
        // @ts-ignore - openPopup is available in newer Chrome versions
        await chrome.action.openPopup();
        return;
    } catch (e) {
        console.log("chrome.action.openPopup failed, falling back to window creation.", e);
    }

    // Method 2: Fallback to creating a small popup window
    // Calculate center position
    const width = 450; // Matched popup width
    const height = 600; // Matched popup height
    let left = 100;
    let top = 100;

    try {
        const displays = await chrome.system.display.getInfo();
        const primaryDisplay = displays.find(d => d.isPrimary) || displays[0];
        if (primaryDisplay) {
            left = Math.round(primaryDisplay.workArea.left + (primaryDisplay.workArea.width - width) / 2);
            top = Math.round(primaryDisplay.workArea.top + (primaryDisplay.workArea.height - height) / 2);
        }
    } catch (err) {
        console.error("Failed to get display info:", err);
    }

    await chrome.windows.create({
        url: "src/popup/index.html",
        type: "popup",
        width: width,
        height: height,
        left: left,
        top: top
    });
};

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "ai-ask-context" && tab?.id) {
    let selectedText = info.selectionText || '';
    
    // Try to get better text with newlines via script
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => window.getSelection()?.toString() || ''
        });
        if (results[0]?.result) {
            selectedText = results[0].result;
        }
    } catch (e) {
        console.error("Failed to retrieve selection via script, falling back to info.selectionText", e);
    }

    await chrome.storage.local.set({ contextSelection: selectedText, contextImage: null });
    await openUi();
  } else if (info.menuItemId === "ai-ask-image" && info.srcUrl) {
      await chrome.storage.local.set({ contextSelection: null, contextImage: info.srcUrl });
      await openUi();
  }
});

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'open_popup_hotkey') {
        // Store selection if present
        if (message.selection) {
            chrome.storage.local.set({ contextSelection: message.selection }).then(() => {
                openUi();
            });
        } else {
            openUi();
        }
    }
});