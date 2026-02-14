
import React, { useRef, useMemo, useState } from 'react';
import { MidiConfig, MidiMapping, LfoTarget } from '../types';
import { MODAL, TEXTS, LFO_TARGET_VALUES, TARGET_GROUPS } from '../data/constants';
import { Button, Input, Label, Select } from './library/Controls';
import { useModalDismiss } from '../hooks/useModalDismiss';

type MidiConfigUpdate = <K extends keyof MidiConfig | 'FULL'>(
    key: K,
    val: K extends 'FULL' ? Partial<MidiConfig> : MidiConfig[K & keyof MidiConfig]
) => void;

interface MidiConfigPanelProps { 
    inputs: MIDIInput[];
    config: MidiConfig; 
    updateConfig: MidiConfigUpdate;
    learningIndex: number | null; 
    setLearningIndex: (index: number | null) => void; 
    onClose: () => void; 
}

const MappingRow: React.FC<{ 
    mapping: MidiMapping; 
    index: number; 
    isLearning: boolean; 
    targetOptions: React.ReactNode; 
    onSetLearning: (idx: number | null) => void; 
    onUpdate: <K extends keyof MidiMapping>(idx: number, key: K, val: MidiMapping[K]) => void;
    onRemove: (idx: number) => void; 
}> = React.memo(({ mapping, index, isLearning, targetOptions, onSetLearning, onUpdate, onRemove }) => (
    <div className="grid gap-2 items-center mb-1" style={{ gridTemplateColumns: '2fr 5fr 1.5fr 1.5fr 2fr' }}>
        <div>
            <Button 
                onClick={() => onSetLearning(isLearning ? null : index)} 
                active={isLearning}
                animate={isLearning}
                className="w-full"
            >
                {isLearning ? "WAIT..." : `CC ${mapping.cc}`}
            </Button>
        </div>

        <div>
            <Select 
                value={mapping.target} 
                onChange={(v) => onUpdate(index, 'target', v as MidiMapping['target'])}
                className="relative top-[2px]"
            >
                {targetOptions}
            </Select>
        </div>

        <div>
            <Input 
                type="number" 
                min={0} 
                max={1024} 
                value={mapping.min ?? 0} 
                onChange={(v) => onUpdate(index, 'min', Number(v))} 
                className="text-center relative top-[2px]"
            />
        </div>

        <div>
            <Input 
                type="number" 
                min={0} 
                max={1024} 
                value={mapping.max ?? 1024} 
                onChange={(v) => onUpdate(index, 'max', Number(v))} 
                className="text-center relative top-[2px]"
            />
        </div>

        <div className="text-right">
            <Button 
                onClick={() => onRemove(index)} 
                variant="danger"
                className="w-full"
            >
                DEL
            </Button>
        </div>
    </div>
));

const MidiConfigPanel: React.FC<MidiConfigPanelProps> = ({ inputs, config, updateConfig, learningIndex, setLearningIndex, onClose }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [mapLoadError, setMapLoadError] = useState<string | null>(null);
    const { handleOverlayPointerDown, handleOverlayClick, handlePanelPointerDown, handlePanelClick } =
        useModalDismiss({ isOpen: true, onClose, overlayCloseCooldownMs: 180 });
    
    const targetOptions = useMemo(() => (
        <>
            <option value="none" className="text-zinc-500 bg-black">SELECT PARAMETER</option>
            {TARGET_GROUPS.map(g => {
                const opts = LFO_TARGET_VALUES.filter(g.check); 
                if (opts.length === 0) return null;
                return (
                    <optgroup key={g.label} label={g.label} className="font-bold text-zinc-500 bg-zinc-900">
                        {opts.map(t => (
                            <option key={t} value={t} className="text-zinc-300 bg-black font-normal">
                                {TEXTS.options.lfoTargets[t]}
                            </option>
                        ))}
                    </optgroup>
                );
            })}
        </>
    ), []);

    return (
        <div className={MODAL.LAYOUT.OVERLAY} onPointerDown={handleOverlayPointerDown} onClick={handleOverlayClick}>
             <div className={`${MODAL.LAYOUT.PANEL} w-full max-w-4xl max-h-[90vh]`} onPointerDown={handlePanelPointerDown} onClick={handlePanelClick}>
                 <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={(e) => { 
                        const f = e.target.files?.[0]; 
                        if (!f) return; 
                        const r = new FileReader(); 
                        r.onload = (ev) => { 
                            try { 
                                const loaded = JSON.parse(ev.target?.result as string) as unknown;
                                if (!loaded || typeof loaded !== 'object') {
                                    throw new Error('Invalid MIDI map payload');
                                }
                                setMapLoadError(null);
                                updateConfig('FULL', loaded); 
                            } catch (_err) {
                                setMapLoadError('Invalid MIDI map file.');
                            } 
                        }; 
                        r.readAsText(f); 
                    }} 
                    style={{ display: 'none' }} 
                    accept=".json" 
                 />
                 
                 <div className={MODAL.LAYOUT.HEADER}>
                     <span className={MODAL.TYPO.TITLE}>MIDI CONFIGURATION</span>
                     <div className="flex gap-2">
                        <Button onClick={() => fileInputRef.current?.click()}>LOAD MAP</Button>
                        <Button onClick={() => { 
                            const b = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' }); 
                            const u = URL.createObjectURL(b); 
                            const l = document.createElement('a'); 
                            l.href = u; 
                            l.download = `tether-midi-map.json`; 
                            l.click(); 
                        }}>SAVE MAP</Button>
                        <div className="w-4" />
                        <button onClick={onClose} className="_c-btn-close">CLOSE</button>
                     </div>
                 </div>

                 <div className={MODAL.LAYOUT.BODY}>
                     {mapLoadError && (
                        <div className="mb-4 px-3 py-2 border border-red-800 bg-red-950/30 text-red-300 text-[10px] uppercase tracking-wider">
                            {mapLoadError}
                        </div>
                     )}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 border-b border-zinc-800 pb-8">
                         <div>
                             <Label className="mb-2 block">INPUT DEVICE</Label>
                             {inputs.length === 0 ? (
                                 <div className="_t-body italic p-2 border border-zinc-800 bg-black text-zinc-500">NO DEVICES DETECTED</div>
                             ) : (
                                 <Select 
                                    value={config.inputName || ''} 
                                    onChange={(v) => updateConfig('inputName', v || null)}
                                    options={inputs.map((i) => ({ value: i.name || '', label: i.name || 'UNKNOWN MIDI INPUT' }))}
                                 />
                             )}
                         </div>
                         <div>
                             <Label className="mb-2 block">VOICE ALLOCATION</Label>
                             <div className="flex gap-2">
                                 <Button onClick={() => updateConfig('polyphonic', false)} active={!config.polyphonic} className="flex-1">MONOPHONIC</Button>
                                 <Button onClick={() => updateConfig('polyphonic', true)} active={config.polyphonic} className="flex-1">POLYPHONIC</Button>
                             </div>
                         </div>
                     </div>

                     <div className="mb-4">
                         <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-2">
                             <span className={MODAL.TYPO.SUB_TITLE}>CC MAPPINGS</span>
                             <Button 
                                onClick={() => updateConfig('mappings', [...config.mappings, { cc: 0, target: 'none' as LfoTarget, min: 0, max: 1024 }])}
                             >
                                + ADD MAPPING
                             </Button>
                         </div>
                         
                         {config.mappings.length === 0 ? (
                             <div className={`text-center py-8 border border-zinc-800 bg-zinc-900/20 ${MODAL.TYPO.BODY}`}>NO CC MAPPINGS. CLICK ADD.</div>
                         ) : (
                             <div className="flex flex-col gap-2">
                                 <div className="grid gap-2 mb-1 items-center" style={{ gridTemplateColumns: '2fr 5fr 1.5fr 1.5fr 2fr' }}>
                                     <Label>CC</Label>
                                     <Label>Target</Label>
                                     <Label className="text-center">Min</Label>
                                     <Label className="text-center">Max</Label>
                                     <div></div>
                                 </div>

                                 {config.mappings.map((m, idx) => (
                                     <MappingRow 
                                        key={idx} 
                                        index={idx} 
                                        mapping={m} 
                                        isLearning={learningIndex === idx} 
                                        targetOptions={targetOptions} 
                                        onSetLearning={setLearningIndex} 
                                        onUpdate={(i, k, v) => { 
                                            const n = [...config.mappings]; 
                                            if (!n[i]) return;
                                            n[i] = { ...n[i], [k]: v } as MidiMapping;
                                            updateConfig('mappings', n); 
                                        }} 
                                        onRemove={(i) => updateConfig('mappings', config.mappings.filter((_, idx) => idx !== i))} 
                                     />
                                 ))}
                             </div>
                         )}
                     </div>
                 </div>
                 
                 <div className={MODAL.LAYOUT.FOOTER}>
                     <div className="flex-1">
                         <p className={`${MODAL.TYPO.FOOTNOTE}`}>Standard MIDI Mapping. 0-127 maps to [MIN-MAX]. Preset saves mapping config only. Use Main SAVE to store parameter values.</p>
                     </div>
                 </div>
             </div>
        </div>
    );
};
export default MidiConfigPanel;

