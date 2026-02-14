
import React from 'react';

interface RackTabButtonProps {
    label: string;
    isActive: boolean;
    onClick: () => void;
    isLast?: boolean;
}

const RackTabButton: React.FC<RackTabButtonProps> = ({ label, isActive, onClick, isLast = false }) => {
    return (
        <button 
            onClick={onClick} 
            className={`flex-1 py-3 flex items-center justify-center transition-colors ${!isLast ? 'border-r border-zinc-800' : ''} ${isActive ? '_rack-tab-active' : '_rack-tab-inactive'}`}
        >
            <span className="_t-panel-desc relative top-px">{label}</span>
        </button>
    );
};

export default RackTabButton;
