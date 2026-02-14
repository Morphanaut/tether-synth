
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSynth } from './hooks/useSynth';
import { SynthState, AssignTargets, LfoTarget } from './types';
import InstructionsModal from './components/InstructionsModal';
import AboutModal from './components/AboutModal';
import ScreenSizeWarningModal from './components/ScreenSizeWarningModal';
import MidiConfigPanel from './components/MidiConfigPanel';
import AppHeader from './components/AppHeader';
import VoiceSection from './components/VoiceSection';
import RackSection from './components/RackSection';
import MasterSection from './components/MasterSection';
import { useAppParamActions } from './hooks/useAppParamActions';
import { createTargetValueSetter, applyTargetDelta } from './utils/targetValueUtils';
import { parsePatchData, savePatchFile } from './utils/patchIO';
import { TEXTS, DEFAULT_PARAMS, DEFAULT_SENSITIVITIES, DEFAULT_ASSIGN_TARGETS } from './data/constants';
import { warnOnceInDev } from './utils/devDiagnostics';

type ActiveModal = 'none' | 'manual' | 'midi' | 'about';

export const App: React.FC = () => {
  const logoUrl = `${import.meta.env.BASE_URL}logo.png`;
  const [params, setParams] = useState<SynthState>(DEFAULT_PARAMS);
  const [interactionMode, setInteractionMode] = useState<'smooth' | 'instant'>('smooth');
  
  const [assignTargets, setAssignTargets] = useState<AssignTargets>(DEFAULT_ASSIGN_TARGETS);
  const [sensitivities, setSensitivities] = useState(DEFAULT_SENSITIVITIES);
  const [activeModal, setActiveModal] = useState<ActiveModal>('none');
  const [showScreenWarning, setShowScreenWarning] = useState(false);
  const [appNotice, setAppNotice] = useState<string | null>(null);
  const showInfo = activeModal === 'manual';
  const showMidi = activeModal === 'midi';
  const showAbout = activeModal === 'about';
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const notifyUiControlRef = useRef<() => void>(() => {});
  const appNoticeTimerRef = useRef<number | null>(null);
  const closeActiveModal = useCallback(() => setActiveModal('none'), []);
  const openModal = useCallback((nextModal: Exclude<ActiveModal, 'none'>) => {
      setActiveModal(prev => (prev === nextModal ? prev : nextModal));
  }, []);

  const {
    updateOsc,
    updateGlobal,
    updateNoise,
    updateLfo,
    updateEnv,
    updateModEnv,
    updateModPath,
    updateSeq,
    updateSeqStep,
    toggleSeqGate,
    randomizePattern
  } = useAppParamActions({ setParams, notifyUiControlRef });

  const setTargetValue = useCallback(
      createTargetValueSetter(setParams),
      []
  );

  const { 
      isStarted, startAudio, triggerGate, analyserNode, 
      currentStep1, currentStep2, currentStepMod1, currentStepMod2, 
      manualSeqStep, syncSequencers, resetSequencer, 
      manualModSeqStep, resetModSequencer, syncModToMaster, syncModSequencers, 
      handleTapTempo,
      isVOctGateActive1, isVOctGateActive2,
      midiAccess, midiConfig, updateMidiConfig, midiInputs,
      setLearningMapping, learningMappingIndex,
      notifyUiControl 
  } = useSynth(params, interactionMode, setTargetValue);
  
  useEffect(() => {
      notifyUiControlRef.current = notifyUiControl;
  }, [notifyUiControl]);

  useEffect(() => {
      if (activeModal === 'midi' && !midiAccess) {
          setActiveModal('none');
      }
  }, [activeModal, midiAccess]);

  useEffect(() => {
      if (isStarted) {
          const checkSize = () => {
              if (window.innerWidth < 1280 || window.innerHeight < 700) {
                  setShowScreenWarning(true);
              }
          };
          checkSize();
      }
  }, [isStarted]);

  useEffect(() => {
      setParams(prev => {
          let changed = false;
          const nextGlobal = { ...prev.global } as SynthState['global'];

          if (!Array.isArray(nextGlobal.fxRouting) || nextGlobal.fxRouting.length === 0) {
              nextGlobal.fxRouting = ['delay', 'bitcrusher', 'fuzz', 'reverb'];
              changed = true;
          }
          return changed ? { ...prev, global: nextGlobal } : prev;
      });
  }, []);

  useEffect(() => {
      const osc1Square = params.osc1.wave === 'square';
      const osc2Square = params.osc2.wave === 'square';
      const sanitizeTarget = (target: LfoTarget): LfoTarget => {
          if (target === 'osc1-pwm' && !osc1Square) return 'none';
          if (target === 'osc2-pwm' && !osc2Square) return 'none';
          return target;
      };

      setParams(prev => {
          const nextLfo1Target = sanitizeTarget(prev.lfo1.target);
          const nextLfo2Target = sanitizeTarget(prev.lfo2.target);
          const nextModEnv1Target = sanitizeTarget(prev.modEnv1.target);
          const nextModEnv2Target = sanitizeTarget(prev.modEnv2.target);
          const nextSeq1Target = sanitizeTarget(prev.seq1.target);
          const nextSeq2Target = sanitizeTarget(prev.seq2.target);
          const nextModSeq1Target = sanitizeTarget(prev.modSeq1.target);
          const nextModSeq2Target = sanitizeTarget(prev.modSeq2.target);

          if (
              nextLfo1Target === prev.lfo1.target &&
              nextLfo2Target === prev.lfo2.target &&
              nextModEnv1Target === prev.modEnv1.target &&
              nextModEnv2Target === prev.modEnv2.target &&
              nextSeq1Target === prev.seq1.target &&
              nextSeq2Target === prev.seq2.target &&
              nextModSeq1Target === prev.modSeq1.target &&
              nextModSeq2Target === prev.modSeq2.target
          ) {
              return prev;
          }

          return {
              ...prev,
              lfo1: { ...prev.lfo1, target: nextLfo1Target },
              lfo2: { ...prev.lfo2, target: nextLfo2Target },
              modEnv1: { ...prev.modEnv1, target: nextModEnv1Target },
              modEnv2: { ...prev.modEnv2, target: nextModEnv2Target },
              seq1: { ...prev.seq1, target: nextSeq1Target },
              seq2: { ...prev.seq2, target: nextSeq2Target },
              modSeq1: { ...prev.modSeq1, target: nextModSeq1Target },
              modSeq2: { ...prev.modSeq2, target: nextModSeq2Target }
          };
      });

      setAssignTargets(prev => {
          const next = {
              pad1: { x: sanitizeTarget(prev.pad1.x), y: sanitizeTarget(prev.pad1.y) },
              pad2: { x: sanitizeTarget(prev.pad2.x), y: sanitizeTarget(prev.pad2.y) },
              pad3: { x: sanitizeTarget(prev.pad3.x), y: sanitizeTarget(prev.pad3.y) },
              pad4: { x: sanitizeTarget(prev.pad4.x), y: sanitizeTarget(prev.pad4.y) }
          } as AssignTargets;

          const unchanged =
              next.pad1.x === prev.pad1.x && next.pad1.y === prev.pad1.y &&
              next.pad2.x === prev.pad2.x && next.pad2.y === prev.pad2.y &&
              next.pad3.x === prev.pad3.x && next.pad3.y === prev.pad3.y &&
              next.pad4.x === prev.pad4.x && next.pad4.y === prev.pad4.y;
          return unchanged ? prev : next;
      });
  }, [params.osc1.wave, params.osc2.wave]);

  const [activeGateKeys, setActiveGateKeys] = useState<{ osc1: boolean; osc2: boolean }>({ osc1: false, osc2: false });
  const activeGateKeysRef = useRef(activeGateKeys);

  useEffect(() => {
    activeGateKeysRef.current = activeGateKeys;
  }, [activeGateKeys]);

  const toggleSequencer = useCallback(() => {
    notifyUiControlRef.current();
    const willRun = !params.seq1.isRunning;
    
    setParams(prev => ({
      ...prev,
      seq1: { ...prev.seq1, isRunning: willRun, target: willRun ? 'osc1-freq' : prev.seq1.target },
      seq2: { ...prev.seq2, isRunning: willRun, target: willRun ? 'osc2-freq' : prev.seq2.target },
      osc1: willRun ? { ...prev.osc1, voltOct: false, drone: false, midi: false } : prev.osc1, 
      osc2: willRun ? { ...prev.osc2, voltOct: false, drone: false, midi: false } : prev.osc2
    }));
    
    if (!willRun) {
        triggerGate(1, false, true);
        triggerGate(2, false, true);
    }
  }, [params.seq1.isRunning, triggerGate]);

  const toggleModSequencer = useCallback(() => {
      notifyUiControlRef.current();
      const willRun = !params.modSeq1.isRunning;
      updateSeq('modSeq1', 'isRunning', willRun);
      updateSeq('modSeq2', 'isRunning', willRun);
  }, [params.modSeq1.isRunning, updateSeq]);

  const toggleDrone = useCallback((oscId: 1 | 2) => {
    notifyUiControlRef.current();
    const oscKey = oscId === 1 ? 'osc1' : 'osc2';
    const currentDrone = params[oscKey].drone;
    const newDroneState = !currentDrone;
    
    setParams(prev => ({
        ...prev,
        [oscKey]: { 
            ...prev[oscKey], 
            drone: newDroneState,
            midi: false,
            voltOct: false
        }
    }));
    triggerGate(oscId, newDroneState, true);
  }, [params.osc1.drone, params.osc2.drone, triggerGate]);

  const toggleVoltOct = useCallback((oscId: 1 | 2) => {
      notifyUiControlRef.current();
      const oscKey = oscId === 1 ? 'osc1' : 'osc2';
      const isCurrentlyOn = params[oscKey].voltOct;
      const willBeOn = !isCurrentlyOn;

      setParams(prev => ({
          ...prev,
          [oscKey]: { 
              ...prev[oscKey], 
              voltOct: willBeOn,
              drone: false,
              midi: false,
              octave: willBeOn ? 0 : prev[oscKey].octave 
          }
      }));
      triggerGate(oscId, false, true);
  }, [params.osc1.voltOct, params.osc2.voltOct, triggerGate]);

  const toggleMidi = useCallback((oscId: 1 | 2) => {
      notifyUiControlRef.current();
      const oscKey = oscId === 1 ? 'osc1' : 'osc2';
      const isCurrentlyOn = params[oscKey].midi;
      const willBeOn = !isCurrentlyOn;

      setParams(prev => ({
          ...prev,
          [oscKey]: { 
              ...prev[oscKey], 
              midi: willBeOn,
              drone: false,
              voltOct: false
          }
      }));
      triggerGate(oscId, false, true);
  }, [params.osc1.midi, params.osc2.midi, triggerGate]);

  const onTapTempo = () => {
    notifyUiControlRef.current();
    const newBpm = handleTapTempo();
    if (newBpm) {
        updateGlobal('bpm', newBpm);
    }
  };

  const onLfoTapTempo = (id: 1 | 2) => {
      notifyUiControlRef.current();
      const newBpm = handleTapTempo();
      if (newBpm) {
          updateLfo(id, 'bpm', newBpm);
      }
  };

  const handleSave = () => {
      savePatchFile(params, assignTargets, sensitivities);
  };

  const handleLoadClick = () => { if (fileInputRef.current) fileInputRef.current.click(); };
  const showAppNotice = useCallback((message: string, timeoutMs = 4000) => {
      if (appNoticeTimerRef.current !== null) {
          clearTimeout(appNoticeTimerRef.current);
          appNoticeTimerRef.current = null;
      }
      setAppNotice(message);
      appNoticeTimerRef.current = window.setTimeout(() => {
          setAppNotice(null);
          appNoticeTimerRef.current = null;
      }, timeoutMs);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          const loaded = parsePatchData(event.target?.result as string);
          if (loaded) {
              setParams(loaded.params);
              setAssignTargets(loaded.assignTargets);
              setSensitivities(loaded.sensitivities);
          } else {
              warnOnceInDev('[App] invalid patch file load attempt', 'invalid-patch-file');
              showAppNotice("Invalid patch file.");
          }
          if (fileInputRef.current) fileInputRef.current.value = "";
      };
      reader.readAsText(file);
  };

  useEffect(() => {
    return () => {
      if (appNoticeTimerRef.current !== null) {
        clearTimeout(appNoticeTimerRef.current);
        appNoticeTimerRef.current = null;
      }
    };
  }, []);

  const handleMacroMove = useCallback((deltaX: number, deltaY: number, isInstant: boolean) => {
    if (deltaX === 0 && deltaY === 0) return;
    notifyUiControlRef.current(); 
    setInteractionMode(isInstant ? 'instant' : 'smooth');
    const globalStrength = sensitivities.macro / 1024;
    
    setParams(prev => {
        const calcDelta = (rawDelta: number, sensitivity: number) => rawDelta * globalStrength * (sensitivity / 1024);
        const d1x = calcDelta(deltaX, sensitivities.assign1);
        const d1y = calcDelta(deltaY, sensitivities.assign1);
        const d2x = calcDelta(deltaX, sensitivities.assign2);
        const d2y = calcDelta(deltaY, sensitivities.assign2);
        const d3x = calcDelta(deltaX, sensitivities.assign3);
        const d3y = calcDelta(deltaY, sensitivities.assign3);
        const d4x = calcDelta(deltaX, sensitivities.assign4);
        const d4y = calcDelta(deltaY, sensitivities.assign4);

        if (d1x === 0 && d1y === 0 && d2x === 0 && d2y === 0 && d3x === 0 && d3y === 0 && d4x === 0 && d4y === 0) {
            return prev;
        }

        let nextState = prev;
        if (d1x !== 0) nextState = applyTargetDelta(nextState, assignTargets.pad1.x, d1x);
        if (d1y !== 0) nextState = applyTargetDelta(nextState, assignTargets.pad1.y, d1y);
        if (d2x !== 0) nextState = applyTargetDelta(nextState, assignTargets.pad2.x, d2x);
        if (d2y !== 0) nextState = applyTargetDelta(nextState, assignTargets.pad2.y, d2y);
        if (d3x !== 0) nextState = applyTargetDelta(nextState, assignTargets.pad3.x, d3x);
        if (d3y !== 0) nextState = applyTargetDelta(nextState, assignTargets.pad3.y, d3y);
        if (d4x !== 0) nextState = applyTargetDelta(nextState, assignTargets.pad4.x, d4x);
        if (d4y !== 0) nextState = applyTargetDelta(nextState, assignTargets.pad4.y, d4y);

        return nextState;
    });
  }, [sensitivities, assignTargets]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.key.toLowerCase();
      const isGateA = e.code === 'KeyA' || key === 'a';
      const isGateF = e.code === 'KeyF' || key === 'f';
      if (!isGateA && !isGateF) return;
      const t = e.target as HTMLElement;
      const isControl = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT';
      if (isControl && t.getAttribute('type') !== 'range') return;

      if (isGateA && !activeGateKeysRef.current.osc1) {
        activeGateKeysRef.current = { ...activeGateKeysRef.current, osc1: true };
        setActiveGateKeys(prev => (prev.osc1 ? prev : { ...prev, osc1: true }));
        triggerGate(1, true);
      }
      if (isGateF && !activeGateKeysRef.current.osc2) {
        activeGateKeysRef.current = { ...activeGateKeysRef.current, osc2: true };
        setActiveGateKeys(prev => (prev.osc2 ? prev : { ...prev, osc2: true }));
        triggerGate(2, true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const isGateA = e.code === 'KeyA' || key === 'a';
      const isGateF = e.code === 'KeyF' || key === 'f';
      if (isGateA && activeGateKeysRef.current.osc1) {
        activeGateKeysRef.current = { ...activeGateKeysRef.current, osc1: false };
        setActiveGateKeys(prev => (prev.osc1 ? { ...prev, osc1: false } : prev));
        triggerGate(1, false);
      }
      if (isGateF && activeGateKeysRef.current.osc2) {
        activeGateKeysRef.current = { ...activeGateKeysRef.current, osc2: false };
        setActiveGateKeys(prev => (prev.osc2 ? { ...prev, osc2: false } : prev));
        triggerGate(2, false);
      }
    };

    const handleWindowBlur = () => {
      const { osc1, osc2 } = activeGateKeysRef.current;
      if (!osc1 && !osc2) return;
      if (osc1) triggerGate(1, false);
      if (osc2) triggerGate(2, false);
      activeGateKeysRef.current = { osc1: false, osc2: false };
      setActiveGateKeys({ osc1: false, osc2: false });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [triggerGate]);

  if (!isStarted) {
    return (
      <div className="relative min-h-screen flex flex-col text-zinc-300 p-6 _b-panel border">
        <InstructionsModal isOpen={showInfo} onClose={closeActiveModal} />
        <div
          className="absolute top-[20px] left-1/2 -translate-x-1/2 h-12 w-12"
          style={{
            backgroundImage: `url('${logoUrl}')`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            backgroundSize: 'contain'
          }}
          aria-hidden="true"
        />
        <div className="flex-grow flex flex-col items-center justify-center gap-8">
          {appNotice && <div className="mb-2 px-3 py-1 border border-red-800 bg-red-950/30 text-red-300 text-[10px] uppercase tracking-wider">{appNotice}</div>}
          <div className="text-center">
            <h1 className="mb-4 _t-init-title">{TEXTS.title}</h1>
            <h2 className="_t-init-subtitle">{TEXTS.subtitle}</h2>
          </div>
          <button onClick={startAudio} className="mt-[16px] px-12 _c-btn-init _t-init-btn _s-inactive _b-panel border animate-pulse">{TEXTS.initSystem}</button>
        </div>
        <div className="w-full max-w-4xl mx-auto text-center border-t border-zinc-800 pt-6 _b-widget">
            <p className="mb-6 max-w-2xl mx-auto _t-init-foot-body">{TEXTS.footer.descBody}</p>
            <div className="flex flex-col gap-1 _t-init-foot-meta"><span>{TEXTS.footer.version}</span><span>{TEXTS.footer.credit}</span><span>{TEXTS.footer.license}</span></div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-950 overflow-hidden">
      {appNotice && <div className="absolute top-2 right-2 z-50 px-3 py-1 border border-red-800 bg-red-950/30 text-red-300 text-[10px] uppercase tracking-wider">{appNotice}</div>}
      <ScreenSizeWarningModal isOpen={showScreenWarning} onClose={() => setShowScreenWarning(false)} />
      <InstructionsModal isOpen={showInfo} onClose={closeActiveModal} />
      <AboutModal isOpen={showAbout} onClose={closeActiveModal} />
      {showMidi && midiAccess && (
          <MidiConfigPanel inputs={midiInputs} config={midiConfig} updateConfig={updateMidiConfig} learningIndex={learningMappingIndex} setLearningIndex={setLearningMapping} onClose={closeActiveModal} />
      )}
      <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept=".json" />
      
      <AppHeader 
        onSave={handleSave} 
        onLoad={handleLoadClick} 
        onManual={() => openModal('manual')} 
        onMidi={() => openModal('midi')} 
        onAbout={() => openModal('about')} 
      />

      <div className="flex-1 flex overflow-hidden">
          <div className="w-1/2 flex-shrink-0 flex flex-col border-r border-zinc-800 bg-black overflow-y-auto _scroll-thin px-6 pt-6">
              <VoiceSection 
                  params={params}
                  activeGateKeys={activeGateKeys}
                  isVOctGateActive1={isVOctGateActive1}
                  isVOctGateActive2={isVOctGateActive2}
                  updateOsc={updateOsc}
                  updateEnv={updateEnv}
                  toggleSequencer={toggleSequencer}
                  toggleVoltOct={toggleVoltOct}
                  toggleDrone={toggleDrone}
                  toggleMidi={toggleMidi}
              />
          </div>

          <RackSection 
              params={params}
              assignTargets={assignTargets}
              setAssignTargets={setAssignTargets}
              sensitivities={sensitivities}
              setSensitivities={setSensitivities}
              onMacroMove={handleMacroMove}
              triggerGate={triggerGate}
              setTargetValue={setTargetValue}
              setInteractionMode={setInteractionMode}
              updateLfo={updateLfo}
              updateModPath={updateModPath}
              updateModEnv={updateModEnv}
              onLfoTapTempo={onLfoTapTempo}
              updateGlobal={updateGlobal}
              updateNoise={updateNoise}
              onTapTempo={onTapTempo}
              currentStep1={currentStep1}
              currentStep2={currentStep2}
              currentStepMod1={currentStepMod1}
              currentStepMod2={currentStepMod2}
              updateSeq={updateSeq}
              updateSeqStep={updateSeqStep}
              toggleSeqGate={toggleSeqGate}
              toggleSequencer={toggleSequencer}
              toggleModSequencer={toggleModSequencer}
              syncSequencers={syncSequencers}
              syncModSequencers={syncModSequencers}
              syncModToMaster={syncModToMaster}
              manualSeqStep={manualSeqStep}
              manualModSeqStep={manualModSeqStep}
              resetSequencer={resetSequencer}
              resetModSequencer={resetModSequencer}
              randomizePattern={randomizePattern}
          />
      </div>
      
      <MasterSection
          analyserNode={analyserNode}
          global={params.global}
          osc1={params.osc1}
          osc2={params.osc2}
          updateGlobal={updateGlobal}
          updateOsc={updateOsc}
          isModalOpen={activeModal !== 'none' || showScreenWarning}
      />

      <div className="flex-shrink-0 border-t border-zinc-800 p-2 px-6 flex justify-between items-center bg-black">
          <div className="_t-meta opacity-50">{TEXTS.footer.version}</div>
          <div className="_t-meta opacity-50">{TEXTS.footer.credit}</div>
      </div>
    </div>
  );
};

