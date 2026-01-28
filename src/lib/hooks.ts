import { useState, useEffect } from 'react';
import { type AppConfig, type ChatMessage, DEFAULT_CONFIG } from './types';
import { getStorage, setStorage, getSelectedText } from './storage';

// Detect environment
const isElectron = typeof window !== 'undefined' && (window as any).electronAPI !== undefined;
const isChrome = typeof chrome !== 'undefined' && chrome.storage !== undefined;

// Abstracted local storage helpers
const getLocalStorage = async (keys: string[]): Promise<Record<string, unknown>> => {
    if (isElectron) {
        // In Electron, we use main process storage or just return empty
        // For now, Electron doesn't need trigger flags
        return {};
    }
    if (isChrome && chrome.storage?.local) {
        return chrome.storage.local.get(keys);
    }
    return {};
};

const setLocalStorage = async (data: Record<string, unknown>): Promise<void> => {
    if (isElectron) {
        // In Electron, handled by main process or ignored
        return;
    }
    if (isChrome && chrome.storage?.local) {
        await chrome.storage.local.set(data);
    }
};

const removeLocalStorage = async (keys: string | string[]): Promise<void> => {
    if (isElectron) {
        return;
    }
    if (isChrome && chrome.storage?.local) {
        await chrome.storage.local.remove(keys);
    }
};

export const useAppConfig = (initialConfig?: AppConfig) => {
    const [config, setConfigState] = useState<AppConfig>(initialConfig || DEFAULT_CONFIG);
    const [loading, setLoading] = useState(!initialConfig);

    useEffect(() => {
        // If initialConfig provided, we assume it's fresh enough or we just load strictly from storage to be sure?
        // Usually hooks should load truth from storage.
        const load = async () => {
            const stored = await getStorage();
            setConfigState(stored);
            setLoading(false);
        };
        load();
    }, []);

    const updateConfig = async (newConfig: AppConfig) => {
        setConfigState(newConfig);
        await setStorage(newConfig);
    };

    return { config, loading, updateConfig };
};

interface ChatState {
    instruction: string;
    messages: ChatMessage[];
    selectedText: string;
    selectedImage: string | null;
}

interface UseChatStateProps {
    initialText?: string;
    initialImage?: string | null;
    initialInstruction?: string;
    initialMessages?: ChatMessage[];
    // If true, we prioritize initial values over storage (e.g. fresh context trigger)
    isFreshContext?: boolean;
}

export const useChatState = ({
    initialText = '',
    initialImage = null,
    initialInstruction = '',
    initialMessages = [],
    isFreshContext = false
}: UseChatStateProps = {}) => {
    const [state, setState] = useState<ChatState>({
        instruction: initialInstruction,
        messages: initialMessages,
        selectedText: initialText,
        selectedImage: initialImage
    });
    const [hydrated, setHydrated] = useState(false);
    const [autoExecutePromptId, setAutoExecutePromptId] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            // Get page text if no initial text provided
            let pageText = initialText;
            if (!pageText && !isFreshContext) {
                try {
                    pageText = await getSelectedText();
                } catch (e) {
                    // In Electron or non-extension context, this may fail
                    pageText = '';
                }
            }

            // Check triggers from background (context menu) if in extension context
            // In content script context, these are usually passed as props.
            // In Electron, we skip this and just use props/defaults.
            const storage = await getLocalStorage(['contextSelection', 'contextImage', 'autoExecutePromptId', 'popupState']);

            const hasContextTrigger = storage.contextSelection || storage.contextImage || storage.autoExecutePromptId;
            // If explicit fresh context passed via props, we treat it as a trigger too.
            const effectiveFreshContext = isFreshContext || hasContextTrigger;

            if (effectiveFreshContext) {
                // Start fresh
                let currentText = initialText || pageText; // Prefer prop input, fallback to page/stored
                let currentImage = initialImage;
                const currentInstruction = initialInstruction;

                if (storage.contextSelection) {
                    currentText = storage.contextSelection as string;
                    await removeLocalStorage('contextSelection');
                }

                if (storage.contextImage) {
                    currentImage = storage.contextImage as string;
                    await removeLocalStorage('contextImage');
                } else if (!isFreshContext) {
                    // If triggered by text context only (and not props), ensure image is clear
                    // UNLESS props provided an image?
                    currentImage = null;
                }

                if (storage.autoExecutePromptId) {
                    setAutoExecutePromptId(storage.autoExecutePromptId as string);
                    await removeLocalStorage('autoExecutePromptId');
                }

                // Clear any stored state since we're starting a new explicit task
                await removeLocalStorage('popupState');

                setState({
                    instruction: currentInstruction,
                    messages: [],
                    selectedText: currentText,
                    selectedImage: currentImage
                });

            } else {
                // Restore previous state if available
                if (storage.popupState) {
                    const s = storage.popupState as {
                        instruction?: string;
                        messages?: ChatMessage[];
                        selectedText?: string;
                        selectedImage?: string | null;
                    };
                    setState({
                        instruction: s.instruction || '',
                        messages: s.messages || [],
                        selectedText: s.selectedText || '',
                        selectedImage: s.selectedImage || null
                    });
                } else {
                    // No previous state, just use current page text
                    setState(prev => ({ ...prev, selectedText: pageText }));
                }
            }

            setHydrated(true);
        };
        init();
    }, []);

    const updateState = (newState: Partial<ChatState>) => {
        setState(prev => {
            const updated = { ...prev, ...newState };
            // Persist
            const stateToSave = {
                instruction: updated.instruction,
                messages: updated.messages,
                selectedText: updated.selectedText,
                selectedImage: updated.selectedImage,
                timestamp: Date.now()
            };
            setLocalStorage({ popupState: stateToSave });
            return updated;
        });
    };

    return { state, updateState, hydrated, autoExecutePromptId };
};
