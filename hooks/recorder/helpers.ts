import { warnOnceInDev } from '../../utils/devDiagnostics';
import { SPEED_MIN, SPEED_RANGE } from './constants';

/**
 * Maps 0-1024 slider value to playback speed (0.2x - 1.8x).
 * Center (512) = 1.0x.
 */
export const mapSpeed = (val: number): number => {
    const clamped = Math.max(0, Math.min(1024, val));
    return SPEED_MIN + (clamped / 1024) * SPEED_RANGE;
};

export const safeStopSource = (source: AudioBufferSourceNode | null): void => {
    if (!source) return;
    try {
        source.stop();
    } catch (e) {
        // Source may already be stopped; expected in racey stop/play paths.
        warnOnceInDev('[useRecorder] source.stop failed in safeStopSource', e);
    }
};

export const safeDisconnect = (node: AudioNode | null): void => {
    if (!node) return;
    try {
        node.disconnect();
    } catch (e) {
        // Node may already be disconnected; expected during cleanup.
        warnOnceInDev('[useRecorder] node.disconnect failed in safeDisconnect', e);
    }
};

export const getOfflineAudioContext = (): typeof OfflineAudioContext | null => {
    if (typeof window === 'undefined') return null;
    return (
        window.OfflineAudioContext ||
        (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext ||
        null
    );
};

export const triggerDownload = (blob: Blob, suffix: string): void => {
    const url = URL.createObjectURL(blob);
    try {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const link = document.createElement('a');
        link.href = url;
        link.download = `tether-${suffix}-${timestamp}.wav`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } finally {
        // Always revoke URL to prevent memory leak.
        URL.revokeObjectURL(url);
    }
};
