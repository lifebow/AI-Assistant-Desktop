import { type AppConfig, DEFAULT_CONFIG } from './types';

export const getStorage = async (): Promise<AppConfig> => {
  const result = await chrome.storage.sync.get('appConfig');
  return result.appConfig ? { ...DEFAULT_CONFIG, ...result.appConfig } : DEFAULT_CONFIG;
};

export const setStorage = async (config: AppConfig): Promise<void> => {
  await chrome.storage.sync.set({ appConfig: config });
};

export const getSelectedText = async (): Promise<string> => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.id) return '';

  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString() || '',
    });
    return result[0].result || '';
  } catch (e) {
    console.error('Failed to get selection:', e);
    return '';
  }
};
