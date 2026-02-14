
import React, { useRef, useEffect, useCallback } from 'react';
import { SequencerParams, DelayDivision, SynthState } from '../types';
import { TEXTS, TYPO, SEQ_DIRECTION_VALUES, SYNC_RATIOS, DELAY_DIVISIONS } from '../data/constants';
import { mapSeqRate, getNoteName } from '../utils/audioMath';
import { Button, ButtonGroup, Fader, Label, PanelTitle, Row, Select, SubSectionTitle, Value } from './library/Controls';

type SequencerKey = 'seq1' | 'seq2' | 'modSeq1' | 'modSeq2';
type VoiceSequencerKey = 'seq1' | 'seq2';
type SequencerUpdate = <K extends keyof SequencerParams>(seq: SequencerKey, key: K, value: SequencerParams[K]) => void;
type LocalSequencerUpdate = <K extends keyof SequencerParams>(key: K, value: SequencerParams[K]) => void;

interface SequencerPanelProps {
  id: 1 | 2;
  state: SequencerParams;
  params: SynthState;
  currentStep: number;
  updateSeq: LocalSequencerUpdate;
  updateSeqStep: (index: number, value: number) => void;
  toggleSeqGate: (index: number) => void;
  toggleSequencer: () => void;
  syncSequencers: () => void;
  manualSeqStep: () => void;
  resetSequencer: () => void;
  randomizePattern: () => void;
}

interface VoiceSequencerSectionProps {
  params: SynthState;
  currentStep1: number;
  currentStep2: number;
  updateSeq: SequencerUpdate;
  updateSeqStep: (seq: SequencerKey, index: number, value: number) => void;
  toggleSeqGate: (seq: VoiceSequencerKey, index: number) => void;
  toggleSequencer: () => void;
  syncSequencers: () => void;
  manualSeqStep: (id: 1 | 2) => void;
  resetSequencer: (id: 1 | 2) => void;
  randomizePattern: (seq: SequencerKey) => void;
}

interface SequencerStepProps {
  index: number;
  val: number;
  isActive: boolean;
  isPitchMode: boolean;
  gridStepsCount: number;
  onStepMouseDown: (index: number, e: React.MouseEvent) => void;
  onStepMouseEnter: (index: number, e: React.MouseEvent) => void;
  onStepMouseMove: (index: number, e: React.MouseEvent) => void;
}

const SequencerStep: React.FC<SequencerStepProps> = React.memo(({
  index, val, isActive, isPitchMode, gridStepsCount, onStepMouseDown, onStepMouseEnter, onStepMouseMove
}) => {
  const handleMouseDown = useCallback((e: React.MouseEvent) => onStepMouseDown(index, e), [index, onStepMouseDown]);
  const handleMouseEnter = useCallback((e: React.MouseEvent) => onStepMouseEnter(index, e), [index, onStepMouseEnter]);
  const handleMouseMove = useCallback((e: React.MouseEvent) => onStepMouseMove(index, e), [index, onStepMouseMove]);

  const { label, indicatorStyle, activeBarStyle } = React.useMemo(() => {
    let nextLabel = "";
    let nextIndicatorStyle: React.CSSProperties = {};
    let nextActiveBarStyle: React.CSSProperties | null = null;

    if (isPitchMode) {
      const discreteStep = Math.floor((val / 1025) * gridStepsCount);
      nextLabel = getNoteName(val);

      const cellHeight = 100 / 13;
      const cellBottom = discreteStep * cellHeight;

      nextIndicatorStyle = {
        bottom: `${cellBottom}%`,
        height: `${cellHeight}%`,
        backgroundColor: '#ffffff',
        mixBlendMode: 'difference',
        opacity: isActive ? 0.7 : 0.175
      };
    } else {
      nextLabel = (val / 10.24).toFixed(0);
      const pct = val / 10.24;

      nextIndicatorStyle = {
        bottom: `${pct}%`,
        height: '6px',
        backgroundColor: '#ffffff',
        mixBlendMode: 'difference'
      };

      if (isActive) {
        nextActiveBarStyle = {
          bottom: '0%',
          height: `${pct}%`,
          backgroundColor: 'var(--color-text-title)',
          opacity: 0.5
        };
      }
    }

    return { label: nextLabel, indicatorStyle: nextIndicatorStyle, activeBarStyle: nextActiveBarStyle };
  }, [gridStepsCount, isActive, isPitchMode, val]);

  return (
    <div
      className="relative flex-1 border-r border-zinc-800 last:border-r-0 cursor-crosshair group _b-widget z-20"
      style={{ isolation: 'isolate' }}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
    >
      <div className={`absolute -top-[15px] left-0 right-0 text-center _t-midi-value ${isPitchMode ? 'text-zinc-300' : 'text-zinc-500'}`}>{label}</div>

      <div
        className="absolute left-0 right-0 pointer-events-none transition-all duration-75 ease-out z-30"
        style={indicatorStyle}
      />

      {activeBarStyle && (
        <div
          className="absolute left-0 right-0 pointer-events-none transition-all duration-75 ease-out z-10"
          style={activeBarStyle}
        />
      )}
    </div>
  );
});

const SequencerPanel: React.FC<SequencerPanelProps> = React.memo(({
  id, state, params, currentStep, updateSeq, updateSeqStep, toggleSeqGate, toggleSequencer, syncSequencers, manualSeqStep, resetSequencer, randomizePattern
}) => {
  const isMaster = id === 1;
  const isDrawingSeq = useRef(false);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<{ index: number; clientY: number; rect: DOMRect } | null>(null);
  const isPitchMode = state.target === 'osc1-freq' || state.target === 'osc2-freq';
  const gridStepsCount = isPitchMode ? 13 : 0;

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
    if (isPitchMode) {
      const discreteStep = Math.floor((val / 1025) * gridStepsCount);
      val = (discreteStep / (gridStepsCount - 1)) * 1024;
    }
    updateSeqStep(index, val);
  }, [gridStepsCount, isPitchMode, updateSeqStep]);

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

  const renderGrid = React.useMemo(() => {
    const lines = [];
    if (isPitchMode) {
      for (let i = 1; i < 13; i++) {
        const pct = (i / 13) * 100;
        lines.push({ pct, label: '', isRoot: false });
      }
    } else {
      lines.push({ pct: 0, label: '', isRoot: true });
      lines.push({ pct: 50, label: '', isRoot: false });
      lines.push({ pct: 100, label: '', isRoot: true });
    }
    return lines.map((l, i) => (
      <div key={i} className={`absolute left-0 right-0 pointer-events-none flex items-end justify-start z-10 ${l.isRoot ? 'border-t border-zinc-500' : 'border-t border-zinc-800/40'}`} style={{ bottom: `${l.pct}%`, height: '0px' }}></div>
    ));
  }, [isPitchMode]);

  return (
    <div className="flex flex-col md:flex-row gap-6 items-stretch mb-4 last:mb-0">
      <div className="w-full md:w-1/4 flex flex-col gap-4">
        <div className="flex justify-between items-center pb-2 border-b border-zinc-800 mb-0">
          <SubSectionTitle className="!mb-0">OSC {id === 1 ? 'A' : 'B'}</SubSectionTitle>
          {isMaster ? (
            <div className={TYPO.PANEL_DESC}>{TEXTS.seq.master}</div>
          ) : (
            <ButtonGroup>
              {params.seq2.isSynced && <Button onClick={syncSequencers}>{TEXTS.seq.phaseRst}</Button>}
              <Button onClick={() => updateSeq('isSynced', !state.isSynced)} active={state.isSynced}>{state.isSynced ? TEXTS.seq.linked : TEXTS.seq.unlinked}</Button>
            </ButtonGroup>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {isMaster && (
            <Button onClick={toggleSequencer} active={params.seq1.isRunning} animate={params.seq1.isRunning} className="col-span-3">
                {params.seq1.isRunning ? TEXTS.seq.running : TEXTS.seq.start}
            </Button>
          )}
          <Button onClick={manualSeqStep}>{TEXTS.seq.step}</Button>
          <Button onClick={resetSequencer}>{TEXTS.seq.reset}</Button>
          <Button onClick={randomizePattern}>{TEXTS.seq.rnd}</Button>
        </div>

        <div>
          <Label className="block mb-1.5">{TEXTS.seq.direction}</Label>
          <ButtonGroup>
            {SEQ_DIRECTION_VALUES.map(dir => (
              <Button key={dir} onClick={() => updateSeq('direction', dir)} active={state.direction === dir} className="flex-1">
                  {TEXTS.options.directions[dir]}
              </Button>
            ))}
          </ButtonGroup>
        </div>

        <div className="mt-auto">
          {!isMaster && params.seq2.isSynced ? (
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
                           <Select 
                                value={state.rateDivision} 
                                onChange={v => updateSeq('rateDivision', v as DelayDivision)} 
                                options={DELAY_DIVISIONS.map(d => ({ label: d.label, value: d.value }))}
                           />
                       </div>
                   </div>
               )}
            </div>
          )}
        </div>
      </div>

      <div className="w-full md:w-3/4 flex flex-col mt-[13px]">
        <div className="flex-grow flex border border-zinc-800 bg-black min-h-[14rem] mb-[10px] _b-widget relative">
          {renderGrid}
          {state.steps.map((val, idx) => (
            <SequencerStep
              key={idx}
              index={idx}
              val={val}
              isActive={currentStep === idx}
              isPitchMode={isPitchMode}
              gridStepsCount={gridStepsCount}
              onStepMouseDown={handleStepMouseDown}
              onStepMouseEnter={handleStepMouseEnter}
              onStepMouseMove={handleStepMouseMove}
            />
          ))}
        </div>
        <div className="flex justify-between gap-2">
          {state.gates.map((isOn, idx) => (
            <div key={idx} className="flex-1">
              <Button onClick={() => toggleSeqGate(idx)} active={isOn} className="w-full">{TEXTS.seq.gate}</Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

const VoiceSequencerSection: React.FC<VoiceSequencerSectionProps> = React.memo(({
    params, currentStep1, currentStep2, updateSeq, updateSeqStep, toggleSeqGate, toggleSequencer, syncSequencers, manualSeqStep, resetSequencer, randomizePattern
}) => {
    const updateSeq1 = useCallback<LocalSequencerUpdate>((k, v) => updateSeq('seq1', k, v), [updateSeq]);
    const updateSeq2 = useCallback<LocalSequencerUpdate>((k, v) => updateSeq('seq2', k, v), [updateSeq]);
    const updateSeqStep1 = useCallback((idx: number, val: number) => updateSeqStep('seq1', idx, val), [updateSeqStep]);
    const updateSeqStep2 = useCallback((idx: number, val: number) => updateSeqStep('seq2', idx, val), [updateSeqStep]);
    const toggleSeqGate1 = useCallback((idx: number) => toggleSeqGate('seq1', idx), [toggleSeqGate]);
    const toggleSeqGate2 = useCallback((idx: number) => toggleSeqGate('seq2', idx), [toggleSeqGate]);
    const manualSeqStep1 = useCallback(() => manualSeqStep(1), [manualSeqStep]);
    const manualSeqStep2 = useCallback(() => manualSeqStep(2), [manualSeqStep]);
    const resetSeq1 = useCallback(() => resetSequencer(1), [resetSequencer]);
    const resetSeq2 = useCallback(() => resetSequencer(2), [resetSequencer]);
    const randomizeSeq1 = useCallback(() => randomizePattern('seq1'), [randomizePattern]);
    const randomizeSeq2 = useCallback(() => randomizePattern('seq2'), [randomizePattern]);

    return (
        <div className="border border-zinc-400 p-4 _b-panel">
            <div className="border-b border-zinc-800 pb-2 mb-4 flex justify-between items-end _b-widget">
                <PanelTitle>{TEXTS.seq.title}</PanelTitle>
            </div>
            <div className="flex flex-col gap-6">
                <SequencerPanel 
                    id={1} state={params.seq1} params={params} currentStep={currentStep1} 
                    updateSeq={updateSeq1} updateSeqStep={updateSeqStep1} toggleSeqGate={toggleSeqGate1} 
                    toggleSequencer={toggleSequencer} syncSequencers={syncSequencers} manualSeqStep={manualSeqStep1} resetSequencer={resetSeq1} randomizePattern={randomizeSeq1} 
                />
                <SequencerPanel 
                    id={2} state={params.seq2} params={params} currentStep={currentStep2} 
                    updateSeq={updateSeq2} updateSeqStep={updateSeqStep2} toggleSeqGate={toggleSeqGate2} 
                    toggleSequencer={toggleSequencer} syncSequencers={syncSequencers} manualSeqStep={manualSeqStep2} resetSequencer={resetSeq2} randomizePattern={randomizeSeq2} 
                />
            </div>
        </div>
    );
});

export default VoiceSequencerSection;

