import React from 'react';
import { MODAL } from '../data/constants';
import { useModalDismiss } from '../hooks/useModalDismiss';

interface AboutModalProps { isOpen: boolean; onClose: () => void; }

const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
    const { handleOverlayPointerDown, handleOverlayClick, handlePanelPointerDown, handlePanelClick } =
        useModalDismiss({ isOpen, onClose, overlayCloseCooldownMs: 180 });

    if (!isOpen) return null;
    const LinkRow = ({ label, href, text }: { label: string, href: string, text: string }) => (
        <div className="flex justify-between items-center group">
            <span className="_t-modal-footnote-white">{label}</span>
            <a href={href} target="_blank" rel="noreferrer" className="_t-link">{text}</a>
        </div>
    );
    return (
        <div className={MODAL.LAYOUT.OVERLAY} onPointerDown={handleOverlayPointerDown} onClick={handleOverlayClick}>
             <div className={`${MODAL.LAYOUT.PANEL} w-full max-w-md`} onPointerDown={handlePanelPointerDown} onClick={handlePanelClick}>
                 <div className={MODAL.LAYOUT.HEADER}>
                     <span className={MODAL.TYPO.TITLE}>ABOUT PROJECT</span>
                     <button onClick={onClose} className="_c-btn-close">CLOSE</button>
                 </div>
                 <div className={MODAL.LAYOUT.BODY}>
                    <div className={`${MODAL.TYPO.BODY} space-y-4 text-left`}>
                        <p>The TETHER project started as a rapid testbed for sound ideas during the design of an analog synthesizer and gradually evolved into a large-scale digital modular system.</p>
                        <p>It is focused on industrial noise textures, drones, and lo-fi, dungeon-synth-inspired sound design. The system integrates the tools and effects I find essential in this context, with an emphasis on preserving an analog character within a digital environment.</p>
                        <p>This is my first project of this architectural scale, so refinement is ongoing. Feedback, testing, and contributions are highly encouraged and genuinely appreciated.</p>
                        <p>TETHER is open source. You are free to explore, modify, and use it.</p>
                    </div>
                 </div>
                 <div className={MODAL.LAYOUT.FOOTER}><div className="flex-1 space-y-3"><LinkRow label="SOURCE CODE" href="https://github.com/Morphanaut/tether-synth" text="GITHUB" /><LinkRow label="REDDIT" href="https://www.reddit.com/user/Morphanaut/" text="u/Morphanaut" /><LinkRow label="INSTAGRAM" href="https://www.instagram.com/morphanaut/" text="@morphanaut" /></div></div>
             </div>
        </div>
    );
};

export default AboutModal;
