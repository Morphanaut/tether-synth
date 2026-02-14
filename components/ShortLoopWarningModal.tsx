import React, { useEffect, useState } from 'react';
import { MODAL } from '../data/constants';
import { Button } from './library/Controls';
import { useModalDismiss } from '../hooks/useModalDismiss';

interface ShortLoopWarningModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (dontAskAgain: boolean) => void;
}

const ShortLoopWarningModal: React.FC<ShortLoopWarningModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const [tempDontAskAgain, setTempDontAskAgain] = useState(false);
    const { handleOverlayPointerDown, handleOverlayClick, handlePanelPointerDown, handlePanelClick } =
        useModalDismiss({ isOpen, onClose, overlayCloseCooldownMs: 180 });

    useEffect(() => {
        if (isOpen) setTempDontAskAgain(false);
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className={MODAL.LAYOUT.OVERLAY} onPointerDown={handleOverlayPointerDown} onClick={handleOverlayClick}>
            <div className={`${MODAL.LAYOUT.PANEL} w-full max-w-sm p-8 items-center text-center`} onPointerDown={handlePanelPointerDown} onClick={handlePanelClick}>
                <div className="mb-8 flex flex-col gap-3 items-center">
                    <div className={`${MODAL.TYPO.TITLE} text-red-500`}>WARNING:</div>
                    <div className={`${MODAL.TYPO.TITLE} text-red-500`}>SHORT LOOP</div>
                </div>
                <p className={`${MODAL.TYPO.BODY} mb-6`}>
                    The selected loop is very short (&lt; 0.5s). Are you sure you want to download?
                </p>
                <div className="flex items-center justify-center gap-3 mb-8 cursor-pointer group" onClick={() => setTempDontAskAgain(prev => !prev)}>
                    <div 
                        className="_b-widget border w-3 h-3 flex items-center justify-center"
                        style={{ backgroundColor: tempDontAskAgain ? 'var(--color-button-hover-bg)' : 'transparent' }}
                    >
                        {tempDontAskAgain && (
                            <div className="w-1.5 h-1.5" style={{ backgroundColor: 'var(--color-text-title)' }} />
                        )}
                    </div>
                    <span className={`${MODAL.TYPO.DT} select-none group-hover:text-zinc-200 transition-colors`}>Don't ask again</span>
                </div>
                <div className="flex gap-4 w-full justify-center">
                    <Button onClick={onClose} className="flex-1">CANCEL</Button>
                    <Button onClick={() => onConfirm(tempDontAskAgain)} active className="flex-1">CONFIRM</Button>
                </div>
            </div>
        </div>
    );
};

export default ShortLoopWarningModal;
