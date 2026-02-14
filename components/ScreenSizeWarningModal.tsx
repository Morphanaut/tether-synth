
import React from 'react';
import { MODAL } from '../data/constants';
import { Button } from './library/Controls';
import { useModalDismiss } from '../hooks/useModalDismiss';

interface ScreenSizeWarningModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ScreenSizeWarningModal: React.FC<ScreenSizeWarningModalProps> = ({ isOpen, onClose }) => {
    const { handleOverlayPointerDown, handleOverlayClick, handlePanelPointerDown, handlePanelClick } =
        useModalDismiss({ isOpen, onClose, closeOnEscape: false, closeOnOverlayClick: false, overlayCloseCooldownMs: 180 });

    if (!isOpen) return null;

    return (
        <div className={`${MODAL.LAYOUT.OVERLAY} z-[100]`} onPointerDown={handleOverlayPointerDown} onClick={handleOverlayClick}>
             <div className={`${MODAL.LAYOUT.PANEL} w-full max-w-md border-zinc-600`} onPointerDown={handlePanelPointerDown} onClick={handlePanelClick}>
                 <div className={MODAL.LAYOUT.HEADER}>
                     <div className="flex items-center gap-2">
                        <span className={`${MODAL.TYPO.TITLE} text-zinc-300`}>DISPLAY OPTIMIZATION</span>
                     </div>
                 </div>
                 <div className={MODAL.LAYOUT.BODY}>
                    <div className={`${MODAL.TYPO.BODY} space-y-4 text-left leading-relaxed`}>
                        <p>
                            This system is optimized for <strong>Desktop Environments</strong> (1920x1080 @ 100% Scale).
                        </p>
                        <p>
                            Mobile and Tablet devices may experience layout issues due to interface complexity.
                        </p>
                        <div className="p-3 border border-zinc-800 bg-zinc-900/50 mt-4">
                            <p className="mb-2 font-bold text-zinc-400 text-[9px] uppercase tracking-wider">Interface Clipped?</p>
                            <p>
                                If controls are extending beyond the screen boundaries, please <strong>adjust your browser zoom level</strong> (Ctrl - / Cmd -) until the interface fits.
                            </p>
                        </div>
                    </div>
                 </div>
                 <div className={MODAL.LAYOUT.FOOTER}>
                     <Button onClick={onClose} className="w-full" active>ACKNOWLEDGE</Button>
                 </div>
             </div>
        </div>
    );
};

export default ScreenSizeWarningModal;
