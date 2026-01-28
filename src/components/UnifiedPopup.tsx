import { useState, useRef, useEffect } from 'react';
import ChatInterface from './ChatInterface';
import Options from '../options/Options';
import type { AppConfig, PromptTemplate } from '../lib/types';
import { useTheme } from '../lib/theme';
import { useAppConfig, useChatState } from '../lib/hooks';
import { setStorage } from '../lib/storage';

export type PopupMode = 'extension' | 'content' | 'desktop';

interface UnifiedPopupProps {
    mode: PopupMode;
    // Initial config (optional, will be loaded from storage if not provided)
    initialConfig?: AppConfig;
    // Context data
    initialSelection?: string;
    initialImage?: string | null;
    initialInstruction?: string;
    pendingAutoPrompt?: PromptTemplate | null;
    // Callbacks
    onClose?: () => void;
    // Position (only for content mode)
    initialX?: number;
    initialY?: number;
}

export default function UnifiedPopup({
    mode,
    initialConfig,
    initialSelection = '',
    initialImage = null,
    initialInstruction = '',
    pendingAutoPrompt = null,
    onClose,
    initialX = 0,
    initialY = 0
}: UnifiedPopupProps) {
    const isContentMode = mode === 'content';
    const [view, setView] = useState<'chat' | 'settings'>('chat');

    // Position state (only used in content mode)
    const [pos, setPos] = useState({ x: initialX, y: initialY });

    // Load config from storage or use initial
    const { config, loading: configLoading, updateConfig } = useAppConfig(initialConfig);

    // Size state
    const [size, setSize] = useState(config?.popupSize || { width: 450, height: 600 });

    // Update size when config loads
    useEffect(() => {
        if (config?.popupSize) {
            setSize(config.popupSize);
        }
    }, [config?.popupSize]);

    // Dragging refs (only for content mode)
    const isDragging = useRef(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Determine if this is a fresh context
    const hasExplicitContext = !!(initialSelection || initialImage || pendingAutoPrompt);

    // Chat state hook - for extension mode, we check storage for trigger flags
    const { state, updateState, hydrated, autoExecutePromptId } = useChatState(
        isContentMode
            ? {
                initialText: initialSelection,
                initialImage: initialImage,
                initialInstruction: initialInstruction,
                isFreshContext: hasExplicitContext
            }
            : undefined // Extension mode uses default behavior with trigger flags
    );

    // Theme handling
    const isDark = useTheme(config?.theme);

    // Apply theme to document for extension mode
    useEffect(() => {
        if (!isContentMode) {
            document.documentElement.classList.toggle('dark', isDark);
        }
    }, [isDark, isContentMode]);

    // Resolve pending auto prompt from ID for extension mode
    let resolvedPendingPrompt = pendingAutoPrompt;
    if (!isContentMode && autoExecutePromptId && config) {
        resolvedPendingPrompt = config.prompts.find(p => p.id === autoExecutePromptId) || null;
    }

    // Drag handlers (content mode only)
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isContentMode) return;
        if ((e.target as HTMLElement).closest('.draggable-header')) {
            isDragging.current = true;
            dragOffset.current = {
                x: e.clientX - pos.x,
                y: e.clientY - pos.y
            };
            e.preventDefault();
        }
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (isDragging.current) {
            setPos({
                x: e.clientX - dragOffset.current.x,
                y: e.clientY - dragOffset.current.y
            });
        }
    };

    const handleMouseUp = () => {
        isDragging.current = false;
    };

    // Setup drag listeners for content mode
    useEffect(() => {
        if (!isContentMode) return;
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isContentMode]);

    // Resize observer for content mode
    useEffect(() => {
        if (!isContentMode || !containerRef.current) return;
        const observer = new ResizeObserver(() => {
            // Noop for now, persistence handled by mouseup
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [isContentMode]);

    // Handle size persistence on mouse up (content mode)
    const handleMouseUpContainer = () => {
        if (!isContentMode || !containerRef.current || !config) return;
        const w = containerRef.current.offsetWidth;
        const h = containerRef.current.offsetHeight;
        if (w !== config.popupSize?.width || h !== config.popupSize?.height) {
            const newConfig = { ...config, popupSize: { width: w, height: h } };
            updateConfig(newConfig);
            setSize({ width: w, height: h });
        }
    };

    // Handle close
    const handleClose = () => {
        if (onClose) {
            onClose();
        } else if (!isContentMode) {
            window.close();
        }
    };

    // Handle config update
    const handleConfigUpdate = (newCfg: AppConfig) => {
        updateConfig(newCfg);
        if (isContentMode) {
            setStorage(newCfg);
        }
    };

    // Loading state
    if (configLoading || !hydrated || !config) return null;



    const handleOpenSettings = async () => {
        if (!isContentMode && (window as any).electronAPI) {
            await (window as any).electronAPI.resizeWindow(900, 700);
            setView('settings');
        }
    };

    const handleBackToChat = async () => {
        if (!isContentMode && (window as any).electronAPI) {
            await (window as any).electronAPI.resizeWindow(500, 700); // Standard Chat Size
            setView('chat');
        }
    };

    // Extension mode / Desktop Mode - simple wrapper
    if (!isContentMode) {
        if (view === 'settings') {
            return (
                <div className="w-full h-full bg-slate-50 dark:bg-gpt-main">
                    <Options onBack={handleBackToChat} />
                </div>
            );
        }

        return (
            <div className="w-[100vw] h-[100vh] overflow-hidden">
                <ChatInterface
                    config={config}
                    initialText={state.selectedText}
                    initialImage={state.selectedImage}
                    initialInstruction={state.instruction}
                    initialMessages={state.messages}
                    pendingAutoPrompt={resolvedPendingPrompt}
                    onStateChange={updateState}
                    onConfigUpdate={handleConfigUpdate}
                    onClose={mode === 'desktop' ? undefined : handleClose}
                    onOpenSettings={handleOpenSettings}
                />
            </div>
        );
    }

    // Content mode - with backdrop, dragging, resizing
    return (
        <div
            className={`font-sans text-base ${isDark ? 'dark' : ''}`}
            style={{
                all: 'initial',
                fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'"
            }}
        >
            {/* Backdrop */}
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 9999,
                    backgroundColor: 'transparent'
                }}
                onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    handleClose();
                }}
            />

            <div
                ref={containerRef}
                style={{
                    position: 'fixed',
                    left: pos.x,
                    top: pos.y,
                    width: size.width,
                    height: size.height,
                    maxWidth: '90vw',
                    maxHeight: '90vh',
                    zIndex: 10000
                }}
                className="bg-transparent shadow-2xl rounded-xl resize overflow-hidden flex flex-col font-sans animate-popup-in"
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUpContainer}
            >
                <div className="w-full h-full flex flex-col active:shadow-none transition-shadow bg-white dark:bg-slate-900 rounded-xl overflow-hidden border-2 border-slate-300 dark:border-slate-500 shadow-sm">
                    <ChatInterface
                        config={config}
                        initialText={state.selectedText}
                        initialImage={state.selectedImage}
                        initialInstruction={state.instruction}
                        initialMessages={state.messages}
                        pendingAutoPrompt={resolvedPendingPrompt}
                        onConfigUpdate={handleConfigUpdate}
                        onStateChange={updateState}
                        hideSettings={true}
                    />
                </div>
            </div>
        </div>
    );
}
