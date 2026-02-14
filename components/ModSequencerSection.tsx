
import React, { useRef, useEffect, useCallback } from 'react';
import { SequencerParams, DelayDivision, SynthState } from '../types';
import { TEXTS, SEQ_DIRECTION_VALUES, SYNC_RATIOS, DELAY_DIVISIONS, LFO_TARGET_VALUES, TARGET_GROUPS } from '../data/constants';
import { mapSeqRate } from '../utils/audioMath';
import { Button, ButtonGroup, Fader, Label, PanelTitle, Row, Select, SubSectionTitle, Value } from './library/Controls';

type SequencerKey = 'seq1' | 'seq2' | 'modSeq1' | 'modSeq2';
type ModSequencerKey = 'modSeq1' | 'modSeq2';
type SequencerUpdate = <K extends keyof SequencerParams>(seq: SequencerKey, key: K, value: SequencerParams[K]) => void;
type LocalSequencerUpdate = <K extends keyof SequencerParams>(key: K, value: SequencerParams[K]) => void;

interface ModSequencerPanelProps {
  id: 1 | 2;
  state: SequencerParams;
  params: SynthState;
  currentStep: number;
  updateSeq: LocalSequencerUpdate;
  updateSeqStep: (index: number, value: number) => void;
  toggleModSequencer: () => void;
  syncModSequencers: () => void;
  syncModToMaster: () => void;
  manualModSeqStep: () => void;
  resetModSequencer: () => void;
  randomizePattern: () => void;
}

interface ModSequencerSectionProps {
  params: SynthState;
  currentStepMod1: number;
  currentStepMod2: number;
  updateSeq: SequencerUpdate;
  updateSeqStep: (seq: SequencerKey, index: number, value: number) => void;
  toggleModSequencer: () => void;
  syncModSequencers: () => void;
  syncModToMaster: () => void;
  manualModSeqStep: (id: 1 | 2) => void;
  resetModSequencer: (id: 1 | 2) => void;
  randomizePattern: (seq: ModSequencerKey) => void;
}

interface ModSequencerStepProps {
  index: number;
  val: number;
  isActive: boolean;
  onStepMouseDown: (index: number, e: React.MouseEvent) => void;
  onStepMouseEnter: (index: number, e: React.MouseEvent) => void;
  onStepMouseMove: (index: number, e: React.MouseEvent) => void;
}

const ModSequencerStep: React.FC<ModSequencerStepProps> = React.memo(({
  index, val, isActive, onStepMouseDown, onStepMouseEnter, onStepMouseMove
}) => {
  const handleMouseDown = useCallback((e: React.MouseEvent) => onStepMouseDown(index, e), [index, onStepMouseDown]);
  const handleMouseEnter = useCallback((e: React.MouseEvent) => onStepMouseEnter(index, e), [index, onStepMouseEnter]);
  const handleMouseMove = useCallback((e: React.MouseEvent) => onStepMouseMove(index, e), [index, onStepMouseMove]);

  const { label, displayHeight } = React.useMemo(() => {
    return {
      label: (val / 10.24).toFixed(0),
      displayHeight: val / 10.24
    };
  }, [val]);

  return (
    <div
      className="relative flex-1 border-r border-zinc-800 last:border-r-0 cursor-crosshair group _b-widget z-20"
      style={{ isolation: 'isolate' }}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
    >
      <div className="absolute -top-[15px] left-0 right-0 text-center _t-midi-value text-zinc-500">{label}</div>

      <div
        className="absolute left-0 right-0 h-1.5 pointer-events-none z-30"
        style={{ bottom: `${displayHeight}%`, backgroundColor: '#ffffff', mixBlendMode: 'difference' }}
      />

      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none z-10"
        style={{
          height: `${displayHeight}%`,
          backgroundColor: '#ffffff',
          mixBlendMode: 'difference',
          opacity: isActive ? 0.7 : 0.175,
          transition: 'opacity 75ms ease-out'
        }}
      />
    </div>
  );
});

const ModSequencerPanel: React.FC<ModSequencerPanelProps> = React.memo(({
  id, state, params, currentStep, updateSeq, updateSeqStep, toggleModSequencer, syncModSequencers, syncModToMaster, manualModSeqStep, resetModSequencer, randomizePattern
}) => {
  const isMaster = id === 1;
  const isDrawingSeq = useRef(false);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<{ index: number; clientY: number; rect: DOMRect } | null>(null);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      isDrawingSeq.current = false;
      pendingRef.current = null;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const applySeqStep = useCallback((index: number, clientY: number, rect: DOMRect) => {
    const height = rect.height;
    const y = clientY - rect.top;
    let val = 1024 - (y / height) * 1024;
    val = Math.max(0, Math.min(1024, val));
    updateSeqStep(index, val);
  }, [updateSeqStep]);

  const scheduleSeqStep = useCallback((index: number, clientY: number, rect: DOMRect) => {
    pendingRef.current = { index, clientY, rect };
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const pending = pendingRef.current;
        if (!pending) return;
        applySeqStep(pending.index, pending.clientY, pending.rect);
      });
    }
  }, [applySeqStep]);

  const handleStepMouseDown = useCallback((index: number, e: React.MouseEvent) => {
    isDrawingSeq.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    applySeqStep(index, e.clientY, rect);
  }, [applySeqStep]);

  const handleStepMouseEnter = useCallback((index: number, e: React.MouseEvent) => {
    if (!isDrawingSeq.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    scheduleSeqStep(index, e.clientY, rect);
  }, [scheduleSeqStep]);

  const handleStepMouseMove = useCallback((index: number, e: React.MouseEvent) => {
    if (!isDrawingSeq.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    scheduleSeqStep(index, e.clientY, rect);
  }, [scheduleSeqStep]);

  const renderTargetOptions = React.useMemo(() => {
    return (
        <>
            <option key="none" value="none" className="text-zinc-500 bg-black font-normal">{TEXTS.options.lfoTargets['none']}</option>
            {TARGET_GROUPS.map(g => {
                const opts = LFO_TARGET_VALUES.filter(g.check);
                if (opts.length === 0) return null;
                return (
                    <optgroup key={g.label} label={g.label} className="font-bold text-zinc-500 bg-zinc-900">
                        {opts.map(t => <option key={t} value={t} className="text-zinc-300 bg-black font-normal">{TEXTS.options.lfoTargets[t]}</option>)}
                    </optgroup>
                );
            })}
        </>
    );
  }, []);

  return (
    <div className="flex flex-col md:flex-row gap-6 items-stretch mb-4 last:mb-0">
      <div className="w-full md:w-1/4 flex flex-col gap-4">
        <div className="flex justify-between items-center pb-2 border-b border-zinc-800 mb-0">
          <SubSectionTitle className="!mb-0">MOD {id}</SubSectionTitle>
          {!isMaster && (
            <ButtonGroup>
              {params.modSeq2.isSynced && <Button onClick={syncModSequencers}>{TEXTS.seq.phaseRst}</Button>}
              <Button onClick={() => updateSeq('isSynced', !params.modSeq2.isSynced)} active={params.modSeq2.isSynced}>{params.modSeq2.isSynced ? TEXTS.seq.linked : TEXTS.seq.unlinked}</Button>
            </ButtonGroup>
          )}
          {isMaster && (
            <ButtonGroup>
              {params.modSeq1.isSynced && <Button onClick={syncModToMaster}>{TEXTS.seq.phaseRst}</Button>}
              <Button onClick={() => updateSeq('isSynced', !params.modSeq1.isSynced)} active={params.modSeq1.isSynced}>{params.modSeq1.isSynced ? TEXTS.seq.linkDig : TEXTS.seq.free}</Button>
            </ButtonGroup>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {isMaster && <Button onClick={toggleModSequencer} active={params.modSeq1.isRunning} animate={params.modSeq1.isRunning} className="col-span-3">{params.modSeq1.isRunning ? TEXTS.seq.running : TEXTS.seq.start}</Button>}
          <Button onClick={manualModSeqStep}>{TEXTS.seq.step}</Button>
          <Button onClick={resetModSequencer}>{TEXTS.seq.reset}</Button>
          <Button onClick={randomizePattern}>{TEXTS.seq.rnd}</Button>
        </div>

        <div>
          <Label className="block mb-1.5">{TEXTS.seq.target}</Label>
          <Select value={state.target} onChange={v => updateSeq('target', v as SequencerParams['target'])}>
            {renderTargetOptions}
          </Select>
        </div>

        <div>
          <Label className="block mb-1.5">{TEXTS.seq.direction}</Label>
          <ButtonGroup>
            {SEQ_DIRECTION_VALUES.map(dir => (
              <Button key={dir} onClick={() => updateSeq('direction', dir)} active={state.direction === dir} className="flex-1">{TEXTS.options.directions[dir]}</Button>
            ))}
          </ButtonGroup>
        </div>

        <div className="mt-auto">
          {(isMaster && params.modSeq1.isSynced) || (!isMaster && params.modSeq2.isSynced) ? (
            <div>
              <Row><Label>{TEXTS.seq.syncRatio}</Label></Row>
              <div className="grid grid-cols-3 gap-2">
                {SYNC_RATIOS.map((r) => <Button key={r.value} onClick={() => updateSeq('syncRatio', r.value)} active={state.syncRatio === r.value}>{r.label}</Button>)}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
               {state.rateMode === 'free' ? (
                   <div>
                        <Row><Label>{TEXTS.seq.rate}</Label><Value>{mapSeqRate(state.rate).toFixed(2)} Hz</Value></Row>
                        <Fader value={state.rate} onChange={v => updateSeq('rate', v)} />
                        <ButtonGroup className="mt-2">
                            <Button onClick={() => updateSeq('rateMode', 'free')} active className="flex-1">FREE</Button>
                            <Button onClick={() => updateSeq('rateMode', 'sync')} className="flex-1">SYNC</Button>
                        </ButtonGroup>
                   </div>
               ) : (
                   <div className="flex flex-col gap-4">
                       <div>
                            <Row><Label>{TEXTS.delay.bpm}</Label><Value>{state.bpm}</Value></Row>
                            <Fader min={30} max={300} value={state.bpm} onChange={v => updateSeq('bpm', v)} />
                            <ButtonGroup className="mt-2">
                                <Button onClick={() => updateSeq('rateMode', 'free')} className="flex-1">FREE</Button>
                                <Button onClick={() => updateSeq('rateMode', 'sync')} active className="flex-1">SYNC</Button>
                            </ButtonGroup>
                       </div>
                       <div>
                           <Row><Label>{TEXTS.seq.div}</Label></Row>
                           <Select value={state.rateDivision} onChange={v => updateSeq('rateDivision', v as DelayDivision)} options={DELAY_DIVISIONS.map(d => ({ label: d.label, value: d.value }))} />
                       </div>
                   </div>
               )}
            </div>
          )}
        </div>
      </div>

      <div className="w-full md:w-3/4 flex flex-col mt-[13px]">
        <div className="flex-grow flex border border-zinc-800 bg-black min-h-[10rem] mb-0 _b-widget relative">
          <div className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none flex flex-col justify-between opacity-20">
            <div className="border-b border-zinc-600 h-0"></div>
            <div className="border-b border-zinc-600 h-0"></div>
            <div className="border-b border-zinc-600 h-0"></div>
          </div>
          {state.steps.map((val, idx) => (
            <ModSequencerStep
              key={idx}
              index={idx}
              val={val}
              isActive={currentStep === idx}
              onStepMouseDown={handleStepMouseDown}
              onStepMouseEnter={handleStepMouseEnter}
              onStepMouseMove={handleStepMouseMove}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

const ModSequencerSection: React.FC<ModSequencerSectionProps> = React.memo(({
    params, currentStepMod1, currentStepMod2, updateSeq, updateSeqStep, toggleModSequencer, syncModSequencers, syncModToMaster, manualModSeqStep, resetModSequencer, randomizePattern
}) => {
    const updateSeq1 = useCallback<LocalSequencerUpdate>((k, v) => updateSeq('modSeq1', k, v), [updateSeq]);
    const updateSeq2 = useCallback<LocalSequencerUpdate>((k, v) => updateSeq('modSeq2', k, v), [updateSeq]);
    const updateSeqStep1 = useCallback((idx: number, val: number) => updateSeqStep('modSeq1', idx, val), [updateSeqStep]);
    const updateSeqStep2 = useCallback((idx: number, val: number) => updateSeqStep('modSeq2', idx, val), [updateSeqStep]);
    const manualModSeqStep1 = useCallback(() => manualModSeqStep(1), [manualModSeqStep]);
    const manualModSeqStep2 = useCallback(() => manualModSeqStep(2), [manualModSeqStep]);
    const resetModSeq1 = useCallback(() => resetModSequencer(1), [resetModSequencer]);
    const resetModSeq2 = useCallback(() => resetModSequencer(2), [resetModSequencer]);
    const randomizeModSeq1 = useCallback(() => randomizePattern('modSeq1'), [randomizePattern]);
    const randomizeModSeq2 = useCallback(() => randomizePattern('modSeq2'), [randomizePattern]);

    return (
        <div className="border border-zinc-400 p-4 _b-panel">
            <div className="border-b border-zinc-800 pb-2 mb-4 flex justify-between items-end _b-widget">
                <PanelTitle>{TEXTS.modSeq.title}</PanelTitle>
            </div>
            <div className="flex flex-col gap-6">
                <ModSequencerPanel 
                    id={1} state={params.modSeq1} params={params} currentStep={currentStepMod1} 
                    updateSeq={updateSeq1} updateSeqStep={updateSeqStep1} 
                    toggleModSequencer={toggleModSequencer} syncModSequencers={syncModSequencers} syncModToMaster={syncModToMaster} 
                    manualModSeqStep={manualModSeqStep1} resetModSequencer={resetModSeq1} randomizePattern={randomizeModSeq1} 
                />
                <ModSequencerPanel 
                    id={2} state={params.modSeq2} params={params} currentStep={currentStepMod2} 
                    updateSeq={updateSeq2} updateSeqStep={updateSeqStep2} 
                    toggleModSequencer={toggleModSequencer} syncModSequencers={syncModSequencers} syncModToMaster={syncModToMaster} 
                    manualModSeqStep={manualModSeqStep2} resetModSequencer={resetModSeq2} randomizePattern={randomizeModSeq2} 
                />
            </div>
        </div>
    );
});

export default ModSequencerSection;

