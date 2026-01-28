import UnifiedPopup from '../components/UnifiedPopup';

// Detect if running in Electron
const isElectron = typeof window !== 'undefined' && (window as any).electronAPI !== undefined;

export default function Popup() {
    return <UnifiedPopup mode={isElectron ? "desktop" : "extension"} />;
}