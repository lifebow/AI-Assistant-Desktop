import React from 'react';
import { Minus, Square, X } from 'lucide-react';

export const WindowsWindowControls: React.FC = () => {
    // Check if running on Windows
    // Use the exposed API from preload
    const isWindows = typeof window !== 'undefined' &&
        (window as any).electronAPI?.platform === 'win32';

    if (!isWindows) return null;

    const handleMinimize = () => {
        (window as any).electronAPI?.minimize();
    };

    const handleMaximize = () => {
        (window as any).electronAPI?.maximize();
    };

    const handleClose = () => {
        (window as any).electronAPI?.close();
    };

    return (
        <div className="flex h-full items-center no-drag z-50 absolute top-0 right-0">
            <button
                onClick={handleMinimize}
                className="h-full px-4 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center text-slate-500 dark:text-slate-400"
                title="Minimize"
            >
                <Minus size={16} />
            </button>
            <button
                onClick={handleMaximize}
                className="h-full px-4 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center text-slate-500 dark:text-slate-400"
                title="Maximize"
            >
                <Square size={14} />
            </button>
            <button
                onClick={handleClose}
                className="h-full px-4 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center text-slate-500 dark:text-slate-400"
                title="Close"
            >
                <X size={16} />
            </button>
        </div>
    );
};
