import React, { useState } from 'react';
import VisualizerSection from './VisualizerSection';
import RecorderPanel from './RecorderPanel';
import { GlobalParams, OscillatorParams } from '../types';
import { TEXTS, getPanDisplay, MASTER_EQ_FREQUENCIES } from '../data/constants';
import { Button, Fader, Label, PanelTitle, Row, SubSectionTitle, Value } from './library/Controls';

type UpdateGlobal = <K extends keyof GlobalParams>(key: K, value: GlobalParams[K]) => void;
type UpdateOsc = <K extends keyof OscillatorParams>(id: 'osc1' | 'osc2', key: K, value: OscillatorParams[K]) => void;

interface MasterSectionProps {
    analyserNode: AnalyserNode | null;
    global: GlobalParams;
    osc1: OscillatorParams;
    osc2: OscillatorParams;
    updateGlobal: UpdateGlobal;
    updateOsc: UpdateOsc;
    isModalOpen?: boolean;
}

const MIXER_PANEL_HEIGHT = 275;

const GraphicEQPanel: React.FC<{ eqGains: number[]; updateGlobal: UpdateGlobal; onClose: () => void }> = ({ eqGains, updateGlobal, onClose }) => {
    
    const updateBand = (index: number, val: number) => {
        const newGains = [...eqGains];
        newGains[index] = val;
        updateGlobal('eqGains', newGains);
    };

    return (
        <div
            className="col-span-2 border border-zinc-400 p-4 _b-panel animate-in fade-in zoom-in-95 duration-200 flex flex-col overflow-hidden"
            style={{ height: MIXER_PANEL_HEIGHT }}
        >
            <div className="border-b border-zinc-800 pb-2 mb-4 flex justify-between items-end _b-widget">
                <PanelTitle>MASTER GRAPHIC EQ</PanelTitle>
                <button onClick={onClose} className="_c-btn-close">CLOSE</button>
            </div>
            
            <div className="_c-eq-panel flex-1 min-h-0">
                {MASTER_EQ_FREQUENCIES.map((freq, i) => {
                    const gain = eqGains[i] ?? 512;
                    const db = ((gain - 512) / 512) * 12;
                    
                    return (
                        <div key={freq} className="_c-eq-fader">
                            <div className="_c-eq-fader-label-container mb-1 items-end">
                                <span className="_t-value text-center w-full">{db > 0 ? '+' : ''}{db.toFixed(1)}</span>
                            </div>
                            
                            <div className="_c-eq-fader-track">
                                <div className="_b-eq-fader-zeroline" />
                                <Fader
                                    value={gain}
                                    min={0}
                                    max={1024}
                                    ariaLabel={`EQ ${freq}Hz`}
                                    orientation="vertical"
                                    onChange={(v) => updateBand(i, v)}
                                    className="_c-eq-fader-input absolute z-10"
                                />
                            </div>

                            <div className="_c-eq-fader-label-container mt-1 items-start">
                                <span className="_t-label text-center w-full">{freq < 1000 ? freq : (freq/1000).toFixed(1) + 'k'}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const MixerPanel: React.FC<{ global: GlobalParams; osc1: OscillatorParams; osc2: OscillatorParams; updateGlobal: UpdateGlobal; updateOsc: UpdateOsc; onOpenEQ: () => void }> = ({ global, osc1, osc2, updateGlobal, updateOsc, onOpenEQ }) => {
    return (
        <div
            className="col-span-2 border border-zinc-400 p-4 _b-panel overflow-hidden"
            style={{ height: MIXER_PANEL_HEIGHT }}
        >
            <div className="border-b border-zinc-800 pb-2 mb-4 flex justify-between items-end _b-widget">
                <PanelTitle>{TEXTS.mixer.title}</PanelTitle>
                <div className="_t-panel-desc">{TEXTS.mixer.subTitle}</div>
            </div>
            <div className="col-span-2 mb-6">
                <Row><Label>MASTER</Label><Value>{(global.masterVolume / 10.24).toFixed(0)}%</Value></Row>
                <div className="flex gap-2 items-center">
                    <Fader value={global.masterVolume} onChange={v => updateGlobal('masterVolume', v)} className="flex-grow" />
                    <Button onClick={onOpenEQ} className="w-[34px] flex-shrink-0" title="GRAPHIC EQ">EQ</Button>
                </div>
            </div>
            <div className="grid grid-cols-2">
                <div className="border-r border-zinc-800 pr-6 _b-widget">
                    <SubSectionTitle className="mb-6">{TEXTS.mixer.ch1}</SubSectionTitle>
                    <div className="mb-4">
                        <Row><Label>{TEXTS.mixer.gain}</Label><Value>{(osc1.gain / 10.24).toFixed(0)}%</Value></Row>
                        <Fader value={osc1.gain} onChange={v => updateOsc('osc1', 'gain', v)} />
                    </div>
                    <div>
                        <div className="flex justify-between items-end mb-1.5"><Label>L</Label><Value>{getPanDisplay(osc1.pan)}</Value><Label>R</Label></div>
                        <Fader 
                            value={osc1.pan} 
                            onChange={v => {
                                const snapped = Math.abs(v - 512) < 8 ? 512 : v;
                                updateOsc('osc1', 'pan', snapped);
                            }} 
                        />
                    </div>
                </div>
                <div className="pl-6">
                    <SubSectionTitle className="mb-6">{TEXTS.mixer.ch2}</SubSectionTitle>
                    <div className="mb-4">
                        <Row><Label>{TEXTS.mixer.gain}</Label><Value>{(osc2.gain / 10.24).toFixed(0)}%</Value></Row>
                        <Fader value={osc2.gain} onChange={v => updateOsc('osc2', 'gain', v)} />
                    </div>
                    <div>
                        <div className="flex justify-between items-end mb-1.5"><Label>L</Label><Value>{getPanDisplay(osc2.pan)}</Value><Label>R</Label></div>
                        <Fader 
                            value={osc2.pan} 
                            onChange={v => {
                                const snapped = Math.abs(v - 512) < 8 ? 512 : v;
                                updateOsc('osc2', 'pan', snapped);
                            }} 
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

const MasterSection: React.FC<MasterSectionProps> = React.memo(({
    analyserNode, global, osc1, osc2, updateGlobal, updateOsc, isModalOpen = false
}) => {
    const [showEQ, setShowEQ] = useState(false);

    return (
        <div className="flex-shrink-0 border-t border-zinc-800 bg-black p-6 z-20">
            <div className="grid grid-cols-5 gap-4">
                <VisualizerSection analyserNode={analyserNode} isModalOpen={isModalOpen} />
                {showEQ ? (
                    <GraphicEQPanel
                        eqGains={global.eqGains || [512,512,512,512,512,512,512]}
                        updateGlobal={updateGlobal}
                        onClose={() => setShowEQ(false)}
                    />
                ) : (
                    <MixerPanel
                        global={global}
                        osc1={osc1}
                        osc2={osc2}
                        updateGlobal={updateGlobal}
                        updateOsc={updateOsc}
                        onOpenEQ={() => setShowEQ(true)}
                    />
                )}
                <RecorderPanel analyserNode={analyserNode} className="col-span-2 mb-0 h-[275px]" isModalOpen={isModalOpen} />
            </div>
        </div>
    );
});

export default MasterSection;

