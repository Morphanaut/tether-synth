
import React from 'react';
import { TEXTS } from '../data/constants';
import { Button, ButtonGroup } from './library/Controls';

interface AppHeaderProps {
    onSave: () => void;
    onLoad: () => void;
    onManual: () => void;
    onMidi: () => void;
    onAbout: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = React.memo(({ onSave, onLoad, onManual, onMidi, onAbout }) => {
    return (
        <div className="flex-shrink-0 flex justify-between items-center px-6 py-4 border-b border-zinc-800 bg-black z-30">
            <div className="flex items-center gap-3">
                <h1 className="_t-app-title">{TEXTS.title}</h1>
                <div className="flex flex-col gap-1.5">
                    <span className="_t-app-subtitle">WEB-BASED</span>
                    <span className="_t-app-subtitle">NOISE SYNTHESIZER</span>
                </div>
            </div>
            <ButtonGroup>
                <Button onClick={onSave}>SAVE</Button>
                <Button onClick={onLoad}>LOAD</Button>
                <Button onClick={onManual}>MANUAL</Button>
                <Button onClick={onMidi}>MIDI</Button>
                <Button onClick={onAbout}>INFO</Button>
            </ButtonGroup>
        </div>
    );
});

export default AppHeader;
