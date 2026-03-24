
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GlobalParams, NoiseGeneratorParams, DelayDivision, FxType } from '../types';
import { TEXTS, DELAY_DIVISIONS, NOISE_TYPES } from '../data/constants';
import { mapCutoff } from '../utils/audioMath';
import { Button, ButtonGroup, Fader, Label, PanelTitle, Row, Select, Value } from './library/Controls';

// ============================================================================
// TYPE-SAFE UPDATE FUNCTION
// ============================================================================

type GlobalUpdateFn = <K extends keyof GlobalParams>(key: K, value: GlobalParams[K]) => void;
type NoiseUpdateFn = <K extends keyof NoiseGeneratorParams>(key: K, value: NoiseGeneratorParams[K]) => void;

// ============================================================================
// SUB-COMPONENT: FX ROUTING
// ============================================================================

const DEFAULT_ROUTING: FxType[] = ['delay', 'bitcrusher', 'fuzz', 'reverb'];
const FX_LABELS: Record<FxType, string> = { delay: "DELAY", bitcrusher: "CRUSH", fuzz: "FUZZ", reverb: "REVERB" };

const FxRoutingPanel: React.FC<{ global: GlobalParams, updateGlobal: GlobalUpdateFn }> = ({ global, updateGlobal }) => {
    if (!global) return <div className="border border-red-500 p-4">Error: global state is undefined</div>;
    
    const globalRouting: FxType[] = (Array.isArray(global.fxRouting) && global.fxRouting.length === 4) ? global.fxRouting : DEFAULT_ROUTING;
    const [localRouting, setLocalRouting] = useState<FxType[]>(globalRouting);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    
    const itemsRef = useRef<Map<string, HTMLDivElement>>(new Map());
    const prevPositions = useRef<Map<string, number>>(new Map());
    const containerRef = useRef<HTMLDivElement>(null);
    const dragItem = useRef<number | null>(null);
    const isDraggingRef = useRef(false);
    
    useEffect(() => { if (!isDraggingRef.current) setLocalRouting(globalRouting); }, [globalRouting]);

    useEffect(() => {
        const handleGlobalEnd = () => { if (isDraggingRef.current) finalizeDrag(); };
        window.addEventListener('mouseup', handleGlobalEnd); window.addEventListener('dragend', handleGlobalEnd);
        return () => { window.removeEventListener('mouseup', handleGlobalEnd); window.removeEventListener('dragend', handleGlobalEnd); };
    }, []);

    useLayoutEffect(() => {
        const rafIds: number[] = [];  // Track RAF IDs for cleanup

        itemsRef.current.forEach((node, key) => {
            const oldLeft = prevPositions.current.get(key);
            if (oldLeft !== undefined && node) {
                const newLeft = node.getBoundingClientRect().left;
                const delta = oldLeft - newLeft;
                if (delta !== 0) {
                    node.style.transition = 'none';
                    node.style.transform = `translate3d(${delta}px, 0, 0)`;
                    const rafId = requestAnimationFrame(() => {
                        // Guard: verify node still connected to DOM before accessing
                        if (node?.isConnected) {
                            node.style.transition = 'transform 300ms cubic-bezier(0.2, 0, 0.2, 1)';
                            node.style.transform = 'translate3d(0, 0, 0)';
                        }
                    });
                    rafIds.push(rafId);
                }
            }
        });

        // Cleanup: cancel any pending RAF callbacks on unmount
        return () => {
            rafIds.forEach(id => cancelAnimationFrame(id));
        };
    }, [localRouting]);

    const moveItem = (sourceIdx: number, targetIdx: number) => {
        if (sourceIdx === targetIdx) return;
        const positions = new Map<string, number>();
        itemsRef.current.forEach((node, key) => { if (node) positions.set(key, node.getBoundingClientRect().left); });
        prevPositions.current = positions;
        const newRouting = [...localRouting];
        const [removed] = newRouting.splice(sourceIdx, 1);
        newRouting.splice(targetIdx, 0, removed);
        setLocalRouting(newRouting);
        dragItem.current = targetIdx;
    };

    const handleContainerDragOver = (e: React.DragEvent) => {
        e.preventDefault(); if (dragItem.current === null || !containerRef.current) return;
        const containerRect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - containerRect.left + containerRef.current.scrollLeft;
        let closestIndex = -1; let minDistance = Number.MAX_VALUE;
        localRouting.forEach((fx, index) => {
            const node = itemsRef.current.get(fx);
            if (node) {
                const center = node.offsetLeft + node.offsetWidth / 2;
                const distance = Math.abs(mouseX - center);
                if (distance < minDistance) { minDistance = distance; closestIndex = index; }
            }
        });
        if (closestIndex !== -1 && closestIndex !== dragItem.current) moveItem(dragItem.current, closestIndex);
    };

    const finalizeDrag = () => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false; dragItem.current = null; setDraggingId(null);
        itemsRef.current.forEach((node) => { if (node) { node.style.transition = ''; node.style.transform = ''; node.style.opacity = ''; node.style.pointerEvents = ''; } });
        updateGlobal('fxRouting', localRouting);
    };

    const isFxEnabled = useCallback((type: FxType): boolean => {
        switch (type) {
            case 'delay': return global.delayEnabled ?? false;
            case 'bitcrusher': return global.bitcrusherEnabled ?? false;
            case 'fuzz': return global.fuzzEnabled ?? false;
            case 'reverb': return global.springReverbEnabled ?? false;
            default: return false;
        }
    }, [global]);

    const toggleFx = useCallback((type: FxType) => {
        switch (type) {
            case 'delay': updateGlobal('delayEnabled', !global.delayEnabled); break;
            case 'bitcrusher': updateGlobal('bitcrusherEnabled', !global.bitcrusherEnabled); break;
            case 'fuzz': updateGlobal('fuzzEnabled', !global.fuzzEnabled); break;
            case 'reverb': updateGlobal('springReverbEnabled', !global.springReverbEnabled); break;
        }
    }, [global, updateGlobal]);

    return (
        <div className="border border-zinc-400 p-4 _b-panel">
            <div className="flex justify-between items-end border-b border-zinc-800 pb-2 mb-4 _b-widget">
                <PanelTitle>{TEXTS.routing.title}</PanelTitle>
                <div className="_t-panel-desc">DRAG TO REORDER</div>
            </div>
            <div 
                ref={containerRef}
                className="flex gap-2 items-center overflow-x-auto pb-2 w-full relative" 
                onDragOver={handleContainerDragOver}
                onDrop={(e) => { e.preventDefault(); finalizeDrag(); }}
            >
                <div className="_t-label px-2 opacity-50 shrink-0 select-none">VOICES</div>
                <div className="_t-label opacity-50 select-none">&gt;</div>
                {localRouting.map((fx, index) => {
                    const enabled = isFxEnabled(fx);
                    const isDraggingThis = draggingId === fx;
                    return (
                        <React.Fragment key={fx}>
                            <div 
                                ref={(el) => { if (el) itemsRef.current.set(fx, el); else itemsRef.current.delete(fx); }}
                                draggable
                                onDragStart={(e) => { isDraggingRef.current = true; dragItem.current = index; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", fx); setTimeout(() => setDraggingId(fx), 0); }}
                                onDragEnd={finalizeDrag}
                                style={{ opacity: isDraggingThis ? 0 : undefined, pointerEvents: isDraggingThis ? 'none' : undefined }}
                                className={`flex-1 flex flex-col border border-zinc-800 bg-black p-2 min-w-[100px] items-center gap-2 _b-widget cursor-grab active:cursor-grabbing select-none group ${enabled ? 'opacity-100 hover:border-zinc-500' : 'opacity-60'}`}
                            >
                                <div className={`_t-label font-bold tracking-wider ${enabled ? 'text-zinc-300' : 'text-zinc-500'}`}>{FX_LABELS[fx]}</div>
                                <div className="w-full">
                                    <Button onClick={(e) => { e.stopPropagation(); toggleFx(fx); }} active={enabled} className="w-full">{enabled ? 'ENABLED' : 'BYPASSED'}</Button>
                                </div>
                            </div>
                            {index < localRouting.length - 1 && <div className="_t-label opacity-50 select-none">&gt;</div>}
                        </React.Fragment>
                    );
                })}
                <div className="_t-label opacity-50 select-none">&gt;</div>
                <div className="_t-label px-2 opacity-50 shrink-0 select-none">MASTER</div>
            </div>
        </div>
    );
};

// ============================================================================
// SUB-COMPONENTS: INDIVIDUAL EFFECT PANELS (Memo'd for isolation)
// ============================================================================

interface FxPanelProps {
    global: GlobalParams;
    updateGlobal: GlobalUpdateFn;
}

const DelayPanel: React.FC<FxPanelProps & { onTapTempo: () => void }> = React.memo(({ global, updateGlobal, onTapTempo }) => (
    <div className="border border-zinc-400 p-4 _b-panel">
        <div className="border-b border-zinc-800 pb-2 mb-4 flex justify-between items-end _b-widget">
            <PanelTitle>{TEXTS.delay.title}</PanelTitle>
            <Button onClick={() => updateGlobal('delayEnabled', !global.delayEnabled)} active={global.delayEnabled}>{global.delayEnabled ? "ENABLED" : "BYPASSED"}</Button>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-6">
            <ButtonGroup>
                <Button onClick={() => updateGlobal('delayMode', 'free')} active={global.delayMode === 'free'}>FREE</Button>
                <Button onClick={() => updateGlobal('delayMode', 'sync')} active={global.delayMode === 'sync'}>SYNC</Button>
            </ButtonGroup>
            {global.delayMode === 'sync' && (
                <div className="flex gap-2 w-full md:w-auto">
                    <Select value={global.delayDivision} onChange={v => updateGlobal('delayDivision', v as DelayDivision)} options={DELAY_DIVISIONS.map(d => ({ label: d.label, value: d.value }))} className="w-24" />
                    <Button onClick={onTapTempo}>{TEXTS.delay.tap}</Button>
                </div>
            )}
        </div>
        <div className="pt-4 border-t border-zinc-800 md:pt-0 md:border-t-0">
            <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 pb-6 ${!global.delayEnabled ? 'opacity-50' : ''} transition-opacity duration-200`}>
                {global.delayMode === 'free' ? (
                    <div><Row><Label>{TEXTS.delay.time}</Label><Value>{global.delayTime} ms</Value></Row><Fader value={global.delayTime} onChange={v => updateGlobal('delayTime', v)} /></div>
                ) : (
                    <div><Row><Label>{TEXTS.delay.bpm}</Label><Value>{global.bpm}</Value></Row><Fader min={30} max={300} value={global.bpm} onChange={v => updateGlobal('bpm', v)} /></div>
                )}
                <div><Row><Label>{TEXTS.delay.feedback}</Label><Value>{Math.round(global.delayFeedback / 10.24)}%</Value></Row><Fader value={global.delayFeedback} onChange={v => updateGlobal('delayFeedback', v)} /></div>
                <div><Row><Label>{TEXTS.delay.drywet}</Label><Value>{Math.round(global.delayMix / 10.24)}%</Value></Row><Fader value={global.delayMix} onChange={v => updateGlobal('delayMix', v)} /></div>
            </div>
        </div>
    </div>
));

const ReverbPanel: React.FC<FxPanelProps> = React.memo(({ global, updateGlobal }) => {
    const currentSeconds = (0.02 + Math.pow(global.springReverbDecay / 1024, 2.0) * 4.98).toFixed(2);
    return (
        <div className="border border-zinc-400 p-4 _b-panel">
            <div className="border-b border-zinc-800 pb-2 mb-4 flex justify-between items-end _b-widget">
                <PanelTitle>{TEXTS.springReverb.title}</PanelTitle>
                <Button onClick={() => updateGlobal('springReverbEnabled', !global.springReverbEnabled)} active={global.springReverbEnabled}>{global.springReverbEnabled ? "ENABLED" : "BYPASSED"}</Button>
            </div>
            <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${!global.springReverbEnabled ? 'opacity-50' : ''} transition-opacity duration-200`}>
                <div><Row><Label>{TEXTS.springReverb.decay}</Label><Value>{currentSeconds}s</Value></Row><Fader value={global.springReverbDecay} onChange={v => updateGlobal('springReverbDecay', v)} /></div>
                <div><Row><Label>{TEXTS.springReverb.tone}</Label><Value>{Math.round((global.springReverbTone - 512) / 5.12)}%</Value></Row><Fader value={global.springReverbTone} onChange={v => updateGlobal('springReverbTone', v)} /></div>
                <div><Row><Label>{TEXTS.springReverb.mix}</Label><Value>{Math.round(global.springReverbMix / 10.24)}%</Value></Row><Fader value={global.springReverbMix} onChange={v => updateGlobal('springReverbMix', v)} /></div>
            </div>
        </div>
    );
});

const FuzzPanel: React.FC<FxPanelProps> = React.memo(({ global, updateGlobal }) => (
    <div className="border border-zinc-400 p-4 _b-panel">
        <div className="border-b border-zinc-800 pb-2 mb-4 flex justify-between items-end _b-widget">
            <PanelTitle>{TEXTS.fuzz.title}</PanelTitle>
            <Button onClick={() => updateGlobal('fuzzEnabled', !global.fuzzEnabled)} active={global.fuzzEnabled}>{global.fuzzEnabled ? "ENABLED" : "BYPASSED"}</Button>
        </div>
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${!global.fuzzEnabled ? 'opacity-50' : ''} transition-opacity duration-200`}>
            <div><Row><Label>{TEXTS.fuzz.drive}</Label><Value>{Math.round(global.fuzzDrive / 10.24)}%</Value></Row><Fader value={global.fuzzDrive} onChange={v => updateGlobal('fuzzDrive', v)} /></div>
            <div><Row><Label>{TEXTS.fuzz.tone}</Label><Value>{Math.round(global.fuzzTone / 10.24)}%</Value></Row><Fader value={global.fuzzTone} onChange={v => updateGlobal('fuzzTone', v)} /></div>
            <div><Row><Label>{TEXTS.fuzz.mix}</Label><Value>{Math.round(global.fuzzMix / 10.24)}%</Value></Row><Fader value={global.fuzzMix} onChange={v => updateGlobal('fuzzMix', v)} /></div>
        </div>
    </div>
));

const BitcrusherPanel: React.FC<FxPanelProps> = React.memo(({ global, updateGlobal }) => {
    const dispBits = (5 + (global.bitcrusherBits / 1024) * 3).toFixed(1);
    const dispRate = (0.005 * Math.pow(200, global.bitcrusherRate / 1024)).toFixed(3);
    return (
        <div className="border border-zinc-400 p-4 _b-panel">
            <div className="border-b border-zinc-800 pb-2 mb-4 flex justify-between items-end _b-widget">
                <PanelTitle>{TEXTS.bitcrusher.title}</PanelTitle>
                <Button onClick={() => updateGlobal('bitcrusherEnabled', !global.bitcrusherEnabled)} active={global.bitcrusherEnabled}>{global.bitcrusherEnabled ? "ENABLED" : "BYPASSED"}</Button>
            </div>
            <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${!global.bitcrusherEnabled ? 'opacity-50' : ''} transition-opacity duration-200`}>
                <div><Row><Label>{TEXTS.bitcrusher.bits}</Label><Value>{dispBits} BITS</Value></Row><Fader value={global.bitcrusherBits} onChange={v => updateGlobal('bitcrusherBits', v)} /></div>
                <div><Row><Label>{TEXTS.bitcrusher.rate}</Label><Value>{dispRate} x</Value></Row><Fader value={global.bitcrusherRate} onChange={v => updateGlobal('bitcrusherRate', v)} /></div>
                <div><Row><Label>{TEXTS.bitcrusher.mix}</Label><Value>{Math.round(global.bitcrusherMix / 10.24)}%</Value></Row><Fader value={global.bitcrusherMix} onChange={v => updateGlobal('bitcrusherMix', v)} /></div>
            </div>
        </div>
    );
});

const NoisePanel: React.FC<{ noise: NoiseGeneratorParams; updateNoise: NoiseUpdateFn }> = React.memo(({ noise, updateNoise }) => (
    <div className="border border-zinc-400 p-4 _b-panel">
        <div className="border-b border-zinc-800 pb-2 mb-4 flex justify-between items-end _b-widget"><PanelTitle>{TEXTS.noise.title}</PanelTitle></div>
        <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 md:flex md:flex-row md:justify-between md:items-center md:gap-3">
            <div className="min-w-0 overflow-x-auto _scroll-thin md:overflow-visible">
                <ButtonGroup className="w-max md:w-auto">
                    {NOISE_TYPES.map(n => (
                        <Button
                            key={n.value}
                            onClick={() => updateNoise('type', n.value)}
                            active={noise.type === n.value}
                            className="px-1.5 md:px-2"
                        >
                            {n.label}
                        </Button>
                    ))}
                </ButtonGroup>
            </div>
            <ButtonGroup className="shrink-0">
                <Button onClick={() => updateNoise('routing', 'filter')} active={noise.routing === 'filter'} className="px-1.5 md:px-2">
                    <span className="md:hidden">OSC/FLT</span>
                    <span className="hidden md:inline">OSC FLT</span>
                </Button>
                <Button onClick={() => updateNoise('routing', 'direct')} active={noise.routing === 'direct'} className="px-1.5 md:px-2">
                    DIRECT
                </Button>
            </ButtonGroup>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-6 pt-4 border-t border-zinc-800">
            <div><Row><Label>{TEXTS.noise.cutoff}</Label><Value>{mapCutoff(noise.cutoff).toFixed(0)} Hz</Value></Row><Fader value={noise.cutoff} onChange={v => updateNoise('cutoff', v)} /></div>
            <div><Row><Label>{TEXTS.noise.resonance}</Label><Value>{Math.round(noise.resonance / 10.24)}%</Value></Row><Fader value={noise.resonance} onChange={v => updateNoise('resonance', v)} /></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-800">
            <div><Row><Label>{TEXTS.noise.sendA}</Label><Value>{Math.round(noise.sendA / 10.24)}%</Value></Row><Fader value={noise.sendA} onChange={v => updateNoise('sendA', v)} /></div>
            <div><Row><Label>{TEXTS.noise.sendB}</Label><Value>{Math.round(noise.sendB / 10.24)}%</Value></Row><Fader value={noise.sendB} onChange={v => updateNoise('sendB', v)} /></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 mt-4 border-t border-zinc-800">
            <div><Row><Label>{TEXTS.noise.fmA}</Label><Value>{Math.round(noise.fmSendA / 10.24)}%</Value></Row><Fader value={noise.fmSendA} onChange={v => updateNoise('fmSendA', v)} /></div>
            <div><Row><Label>{TEXTS.noise.fmB}</Label><Value>{Math.round(noise.fmSendB / 10.24)}%</Value></Row><Fader value={noise.fmSendB} onChange={v => updateNoise('fmSendB', v)} /></div>
        </div>
    </div>
));

// ============================================================================
// MAIN COMPONENT: EFFECTS SECTION
// ============================================================================

interface EffectsSectionProps {
    global: GlobalParams;
    noise: NoiseGeneratorParams;
    updateGlobal: GlobalUpdateFn;
    updateNoise: NoiseUpdateFn;
    onTapTempo: () => void;
}

const EffectsSection: React.FC<EffectsSectionProps> = React.memo(({ global, noise, updateGlobal, updateNoise, onTapTempo }) => {
    return (
        <div className="animate-in fade-in duration-300 flex flex-col gap-6">
            <FxRoutingPanel global={global} updateGlobal={updateGlobal} />
            <DelayPanel global={global} updateGlobal={updateGlobal} onTapTempo={onTapTempo} />
            <ReverbPanel global={global} updateGlobal={updateGlobal} />
            <FuzzPanel global={global} updateGlobal={updateGlobal} />
            <BitcrusherPanel global={global} updateGlobal={updateGlobal} />
            <NoisePanel noise={noise} updateNoise={updateNoise} />
            <div className="border border-zinc-400 p-4 _b-panel"><p className="_t-body text-center text-zinc-500">More effects will be added in future updates.</p></div>
        </div>
    );
});

export default EffectsSection;
