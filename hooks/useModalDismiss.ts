import { useEffect, useRef } from 'react';
import type { MouseEvent, PointerEvent } from 'react';

interface UseModalDismissOptions {
    isOpen: boolean;
    onClose: () => void;
    closeOnEscape?: boolean;
    closeOnOverlayClick?: boolean;
    overlayCloseCooldownMs?: number;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export const useModalDismiss = ({
    isOpen,
    onClose,
    closeOnEscape = true,
    closeOnOverlayClick = true,
    overlayCloseCooldownMs = 180
}: UseModalDismissOptions) => {
    const shouldCloseOnClickRef = useRef(false);
    const openedAtRef = useRef(0);

    useEffect(() => {
        if (!isOpen) {
            shouldCloseOnClickRef.current = false;
            return;
        }
        openedAtRef.current = now();
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !closeOnEscape) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            e.preventDefault();
            e.stopPropagation();
            onClose();
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [isOpen, closeOnEscape, onClose]);

    const handleOverlayPointerDown = (e: PointerEvent<HTMLDivElement>) => {
        shouldCloseOnClickRef.current = e.target === e.currentTarget;
    };

    const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
        if (!closeOnOverlayClick) return;
        if (e.target !== e.currentTarget) return;
        if (!shouldCloseOnClickRef.current) return;
        shouldCloseOnClickRef.current = false;
        if (now() - openedAtRef.current < overlayCloseCooldownMs) return;
        onClose();
    };

    const handlePanelPointerDown = (e: PointerEvent<HTMLDivElement>) => {
        shouldCloseOnClickRef.current = false;
        e.stopPropagation();
    };

    const handlePanelClick = (e: MouseEvent<HTMLDivElement>) => {
        shouldCloseOnClickRef.current = false;
        e.stopPropagation();
    };

    return {
        handleOverlayPointerDown,
        handleOverlayClick,
        handlePanelPointerDown,
        handlePanelClick
    };
};
