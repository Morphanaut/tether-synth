import React, { useMemo } from 'react';
import { SynthState, LfoParams, ModPathParams, ModEnvelopeParams, DelayDivision, LfoTarget, Waveform } from '../types';
import { TEXTS, WAVEFORMS, DELAY_DIVISIONS, MOD_TYPES, MOD_SOURCES, LFO_TARGET_VALUES, TARGET_GROUPS } from '../data/constants';
import { mapLfoRate, mapFmDeviation, mapAttackTime, mapReleaseTime, mapModEnvDelay } from '../utils/audioMath';
import { Button, ButtonGroup, Fader, Label, PanelTitle, Row, Select, SubSectionTitle, Value } from './library/Controls';

interface LfoSectionProps {
  lfo1: LfoParams;
  lfo2: LfoParams;
  osc1Wave: Waveform;
  osc2Wave: Waveform;
  updateLfo: <K extends keyof LfoParams>(id: 1 | 2, key: K, value: LfoParams[K]) => void;
  onTapTempo: (id: 1 | 2) => void;
  layoutMode?: 'desktop' | 'mobile';
}

const isPwmTargetAllowed = (target: LfoTarget, osc1Wave: Waveform, osc2Wave: Waveform): boolean => {
  if (target === 'osc1-pwm') return osc1Wave === 'square';
  if (target === 'osc2-pwm') return osc2Wave === 'square';
  return true;
};

const LfoPanel: React.FC<LfoSectionProps> = React.memo(({ lfo1, lfo2, osc1Wave, osc2Wave, updateLfo, onTapTempo, layoutMode = 'desktop' }) => {
  const renderTargetOptions = (id: 1 | 2) => {
    const allowedTargets = LFO_TARGET_VALUES.filter(t => {
        if (!isPwmTargetAllowed(t, osc1Wave, osc2Wave)) return false;
        if (id === 1 && (t === 'lfo1-rate' || t === 'lfo1-depth')) return false;
        if (id === 2 && (t === 'lfo2-rate' || t === 'lfo2-depth')) return false;
        return true;
    });

    return (
        <>
            <option value="none" className="text-zinc-500 bg-black font-normal">{TEXTS.options.lfoTargets['none']}</option>
            {TARGET_GROUPS.map(g => {
                const opts = allowedTargets.filter(g.check);
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
    );
  };

  const renderControls = (id: 1 | 2, state: LfoParams) => (
    <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center mb-2">
            <ButtonGroup>
                {WAVEFORMS.map(w => (
                <Button
                    key={w.value}
                    onClick={() => updateLfo(id, 'wave', w.value)}
                    active={state.wave === w.value}
                    className="px-1.5"
                >
                    {w.label === 'SQR' ? TEXTS.osc.sqr : w.label}
                </Button>
                ))}
            </ButtonGroup>
            <ButtonGroup>
                <Button onClick={() => updateLfo(id, 'rateMode', 'free')} active={state.rateMode === 'free'}>FREE</Button>
                <Button onClick={() => updateLfo(id, 'rateMode', 'sync')} active={state.rateMode === 'sync'}>SYNC</Button>
            </ButtonGroup>
        </div>

        <div className={`${layoutMode === 'mobile' ? 'pt-4 border-t border-zinc-800 ' : ''}flex flex-col gap-4`}>
            {state.rateMode === 'free' ? (
                <div className="animate-in fade-in">
                    <Row><Label>{TEXTS.lfo.rate}</Label><Value>{mapLfoRate(state.rate).toFixed(2)} Hz</Value></Row>
                    <Fader value={state.rate} onChange={v => updateLfo(id, 'rate', v)} />
                </div>
            ) : (
                <div className="flex flex-col gap-4 animate-in fade-in">
                    <div>
                        <Row><Label>{TEXTS.delay.bpm}</Label><Value>{state.bpm}</Value></Row>
                        <Fader min={30} max={300} value={state.bpm} onChange={v => updateLfo(id, 'bpm', v)} />
                    </div>
                    <div className="flex gap-2 items-end">
                        <div className="flex-grow">
                            <Label className="block mb-1.5">{TEXTS.lfo.div}</Label>
                            <Select 
                                value={state.rateDivision} 
                                onChange={v => updateLfo(id, 'rateDivision', v as DelayDivision)} 
                                options={DELAY_DIVISIONS.map(d => ({ label: d.label, value: d.value }))}
                            />
                        </div>
                        <Button onClick={() => onTapTempo(id)}>TAP</Button>
                    </div>
                </div>
            )}

            <div>
                <Row><Label>{TEXTS.lfo.depth}</Label><Value>{Math.round(state.depth / 10.24)}%</Value></Row>
                <Fader value={state.depth} onChange={v => updateLfo(id, 'depth', v)} />
            </div>

            <div>
                <Label className="block mb-1.5">{TEXTS.lfo.target}</Label>
                <Select value={state.target} onChange={v => updateLfo(id, 'target', v as LfoParams['target'])}>
                    {renderTargetOptions(id)}
                </Select>
            </div>
        </div>
    </div>
  );

  return (
    <div className="border border-zinc-400 p-4 _b-panel">
      <div className={`border-b border-zinc-800 pb-2 mb-4 flex justify-between items-end _b-widget`}>
        <PanelTitle>{TEXTS.lfo.sectionTitle}</PanelTitle>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="relative pb-4 mb-4 border-b border-zinc-800 md:border-b-0 md:pb-0 md:mb-0 md:pr-6 md:border-r">
            <SubSectionTitle className="mb-3">{TEXTS.lfo.title} 1</SubSectionTitle>
            {renderControls(1, lfo1)}
        </div>
        <div className="md:pl-6 pt-4 md:pt-0">
            <SubSectionTitle className="mb-3">{TEXTS.lfo.title} 2</SubSectionTitle>
            {renderControls(2, lfo2)}
        </div>
      </div>
    </div>
  );
});

interface CrossModProps {
    oscMod: SynthState['oscMod'];
    updateModPath: <K extends keyof ModPathParams>(path: 'osc1to2' | 'osc2to1', key: K, value: ModPathParams[K]) => void;
    layoutMode?: 'desktop' | 'mobile';
}

const CrossModPanel: React.FC<CrossModProps> = React.memo(({ oscMod, updateModPath, layoutMode = 'desktop' }) => {
    return (
        <div className="border border-zinc-400 p-4 _b-panel">
            <div className="border-b border-zinc-800 pb-2 mb-4 flex justify-between items-end _b-widget">
                <PanelTitle>{TEXTS.mod.title}</PanelTitle>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="relative pb-4 mb-4 border-b border-zinc-800 md:border-b-0 md:pb-0 md:mb-0 md:pr-6 md:border-r">
                    <SubSectionTitle className="mb-3">{TEXTS.osc.title} A {TEXTS.mod.to} {TEXTS.osc.title} B</SubSectionTitle>
                    <div className="flex justify-between items-center mb-6">
                        <ButtonGroup>
                            {MOD_TYPES.map(t => <Button key={t.value} onClick={() => updateModPath('osc1to2', 'type', t.value)} active={oscMod.osc1to2.type === t.value}>{t.label}</Button>)}
                        </ButtonGroup>
                        <ButtonGroup>
                            {MOD_SOURCES.map(s => <Button key={s.value} onClick={() => updateModPath('osc1to2', 'source', s.value)} active={oscMod.osc1to2.source === s.value}>{TEXTS.mod[s.labelKey]}</Button>)}
                        </ButtonGroup>
                    </div>
                    <div className={layoutMode === 'mobile' ? 'pt-4 border-t border-zinc-800' : ''}>
                        <div className="mb-4">
                            <Row><Label>{TEXTS.mod.amount}</Label><Value>{Math.round(oscMod.osc1to2.amount / 10.24)}%</Value></Row>
                            <Fader value={oscMod.osc1to2.amount} onChange={v => updateModPath('osc1to2', 'amount', v)} />
                        </div>
                        <div className={`${oscMod.osc1to2.type !== 'fm' ? 'opacity-30 pointer-events-none' : ''}`}>
                            <Row><Label>{TEXTS.mod.range}</Label><Value>{Math.round(mapFmDeviation(oscMod.osc1to2.range))} Hz</Value></Row>
                            <Fader value={oscMod.osc1to2.range} onChange={v => updateModPath('osc1to2', 'range', v)} />
                        </div>
                    </div>
                </div>
                <div className="md:pl-6 pt-4 md:pt-0">
                    <SubSectionTitle className="mb-3">{TEXTS.osc.title} B {TEXTS.mod.to} {TEXTS.osc.title} A</SubSectionTitle>
                    <div className="flex justify-between items-center mb-6">
                        <ButtonGroup>
                            {MOD_TYPES.map(t => <Button key={t.value} onClick={() => updateModPath('osc2to1', 'type', t.value)} active={oscMod.osc2to1.type === t.value}>{t.label}</Button>)}
                        </ButtonGroup>
                        <ButtonGroup>
                            {MOD_SOURCES.map(s => <Button key={s.value} onClick={() => updateModPath('osc2to1', 'source', s.value)} active={oscMod.osc2to1.source === s.value}>{TEXTS.mod[s.labelKey]}</Button>)}
                        </ButtonGroup>
                    </div>
                    <div className={layoutMode === 'mobile' ? 'pt-4 border-t border-zinc-800' : ''}>
                        <div className="mb-4">
                            <Row><Label>{TEXTS.mod.amount}</Label><Value>{Math.round(oscMod.osc2to1.amount / 10.24)}%</Value></Row>
                            <Fader value={oscMod.osc2to1.amount} onChange={v => updateModPath('osc2to1', 'amount', v)} />
                        </div>
                        <div className={`${oscMod.osc2to1.type !== 'fm' ? 'opacity-30 pointer-events-none' : ''}`}>
                            <Row><Label>{TEXTS.mod.range}</Label><Value>{Math.round(mapFmDeviation(oscMod.osc2to1.range))} Hz</Value></Row>
                            <Fader value={oscMod.osc2to1.range} onChange={v => updateModPath('osc2to1', 'range', v)} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

interface ModEnvelopeProps {
    modEnv1: ModEnvelopeParams;
    modEnv2: ModEnvelopeParams;
    osc1Wave: Waveform;
    osc2Wave: Waveform;
    updateModEnv: <K extends keyof ModEnvelopeParams>(id: 1 | 2, key: K, value: ModEnvelopeParams[K]) => void;
}

const ModEnvelopePanel: React.FC<ModEnvelopeProps> = React.memo(({ modEnv1, modEnv2, osc1Wave, osc2Wave, updateModEnv }) => {
    
    const targetOptions = useMemo(() => (
        <>
            <option value="none" className="text-zinc-500 bg-black">{TEXTS.options.lfoTargets['none']}</option>
            {TARGET_GROUPS.map(g => {
                const opts = LFO_TARGET_VALUES.filter(t => (
                    g.check(t) &&
                    t !== 'none' &&
                    isPwmTargetAllowed(t, osc1Wave, osc2Wave)
                ));
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
    ), [osc1Wave, osc2Wave]);

    const renderControls = (id: 1 | 2, state: ModEnvelopeParams) => (
        <div className="flex flex-col gap-4">
             <div>
                <Row><Label>{TEXTS.osc.attack}</Label><Value>{mapAttackTime(state.attack).toFixed(2)} s</Value></Row>
                <Fader value={state.attack} onChange={v => updateModEnv(id, 'attack', v)} />
            </div>
            <div>
                <Row><Label>{TEXTS.osc.release}</Label><Value>{mapReleaseTime(state.release).toFixed(2)} s</Value></Row>
                <Fader value={state.release} onChange={v => updateModEnv(id, 'release', v)} />
            </div>
            <div>
                <Row><Label>{TEXTS.modEnv.delay}</Label><Value>{mapModEnvDelay(state.delay).toFixed(2)} s</Value></Row>
                <Fader value={state.delay} onChange={v => updateModEnv(id, 'delay', v)} />
            </div>
            <div className="pt-4 border-t border-zinc-800">
                <Row><Label>{TEXTS.modEnv.depth}</Label><Value>{Math.round(state.depth / 10.24)}%</Value></Row>
                <Fader value={state.depth} onChange={v => updateModEnv(id, 'depth', v)} />
            </div>
            <div>
                <Label className="block mb-2">{TEXTS.lfo.target}</Label>
                <Select value={state.target} onChange={v => updateModEnv(id, 'target', v as ModEnvelopeParams['target'])}>
                    {targetOptions}
                </Select>
            </div>
        </div>
    );

    return (
        <div className="border border-zinc-400 p-4 _b-panel">
            <div className="border-b border-zinc-800 pb-2 mb-4 flex flex-col items-start gap-1 md:flex-row md:justify-between md:items-end md:gap-0 _b-widget">
                <div className="whitespace-nowrap">
                    <PanelTitle>{TEXTS.modEnv.title}</PanelTitle>
                </div>
                <div className="_t-panel-desc whitespace-nowrap hidden md:block">
                    <span>{TEXTS.modEnv.subTitle}</span>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="relative pb-4 mb-4 border-b border-zinc-800 md:border-b-0 md:pb-0 md:mb-0 md:pr-6 md:border-r">
                    <SubSectionTitle className="mb-4 md:mb-6">{TEXTS.modEnv.mod1}</SubSectionTitle>
                    {renderControls(1, modEnv1)}
                </div>
                <div className="md:pl-6 pt-4 md:pt-0">
                    <SubSectionTitle className="mb-4 md:mb-6">{TEXTS.modEnv.mod2}</SubSectionTitle>
                    {renderControls(2, modEnv2)}
                </div>
            </div>
        </div>
    );
});

interface ModulationSectionProps {
    lfo1: LfoParams;
    lfo2: LfoParams;
    osc1Wave: Waveform;
    osc2Wave: Waveform;
    oscMod: SynthState['oscMod'];
    modEnv1: ModEnvelopeParams;
    modEnv2: ModEnvelopeParams;
    updateLfo: <K extends keyof LfoParams>(id: 1 | 2, key: K, value: LfoParams[K]) => void;
    updateModPath: <K extends keyof ModPathParams>(path: 'osc1to2' | 'osc2to1', key: K, value: ModPathParams[K]) => void;
    updateModEnv: <K extends keyof ModEnvelopeParams>(id: 1 | 2, key: K, value: ModEnvelopeParams[K]) => void;
    onLfoTapTempo: (id: 1 | 2) => void;
    layoutMode?: 'desktop' | 'mobile';
}

const ModulationSection: React.FC<ModulationSectionProps> = React.memo(({
    lfo1, lfo2, osc1Wave, osc2Wave, oscMod, modEnv1, modEnv2,
    updateLfo, updateModPath, updateModEnv, onLfoTapTempo, layoutMode = 'desktop'
}) => {
    return (
        <div className="animate-in fade-in duration-300 flex flex-col gap-6">
            <LfoPanel
                lfo1={lfo1}
                lfo2={lfo2}
                osc1Wave={osc1Wave}
                osc2Wave={osc2Wave}
                updateLfo={updateLfo}
                onTapTempo={onLfoTapTempo}
                layoutMode={layoutMode}
            />
            <CrossModPanel oscMod={oscMod} updateModPath={updateModPath} layoutMode={layoutMode} />
            <ModEnvelopePanel
                modEnv1={modEnv1}
                modEnv2={modEnv2}
                osc1Wave={osc1Wave}
                osc2Wave={osc2Wave}
                updateModEnv={updateModEnv}
            />
        </div>
    );
});

export default ModulationSection;
