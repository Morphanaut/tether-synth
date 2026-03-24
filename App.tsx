
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
import ModulationSection from './components/ModulationSection';
import VoiceSequencerSection from './components/VoiceSequencerSection';
import ModSequencerSection from './components/ModSequencerSection';
import MatrixSection from './components/MatrixSection';
import EffectsSection from './components/EffectsSection';
import MobileKeyboardOverlay from './components/MobileKeyboardOverlay';
import { useAppParamActions } from './hooks/useAppParamActions';
import { createTargetValueSetter, applyTargetDelta } from './utils/targetValueUtils';
import { parsePatchData, savePatchFile } from './utils/patchIO';
import { TEXTS, DEFAULT_PARAMS, DEFAULT_SENSITIVITIES, DEFAULT_ASSIGN_TARGETS, OCTAVE_FOOTAGE } from './data/constants';
import { warnOnceInDev } from './utils/devDiagnostics';
import { triggerMobileHaptic } from './utils/haptics';

type ActiveModal = 'none' | 'manual' | 'midi' | 'about';
type MobileTab = 'oscillators' | 'modulation' | 'sequencers' | 'matrix' | 'effects' | 'mix-record';
type MobileMenuVisualState = 'entering' | 'open' | 'closing-right';
type MobileKeyboardOscMode = 'kbd' | 'drone' | 'off';

const MOBILE_TABS: Array<{ key: MobileTab; label: string }> = [
  { key: 'oscillators', label: 'Osc' },
  { key: 'modulation', label: 'Mod' },
  { key: 'sequencers', label: 'Seq' },
  { key: 'matrix', label: 'Matrix' },
  { key: 'effects', label: 'FX' },
  { key: 'mix-record', label: 'Mix' }
];
const MOBILE_TOP_MENU_HEIGHT = 49;
const MOBILE_BOTTOM_MENU_HEIGHT = 112;
const MOBILE_MENU_ANIMATION_MS = 180;
const MOBILE_KEYBOARD_CONTROL_FADERS_DEFAULT: Array<{ target: LfoTarget; value: number }> = Array.from(
    { length: 4 },
    () => ({ target: 'none' as LfoTarget, value: 512 })
);

export const App: React.FC = () => {
  const logoUrl = `${import.meta.env.BASE_URL}logo.png`;
  const [params, setParams] = useState<SynthState>(DEFAULT_PARAMS);
  const [interactionMode, setInteractionMode] = useState<'smooth' | 'instant'>('smooth');
  
  const [assignTargets, setAssignTargets] = useState<AssignTargets>(DEFAULT_ASSIGN_TARGETS);
  const [sensitivities, setSensitivities] = useState(DEFAULT_SENSITIVITIES);
  const [activeModal, setActiveModal] = useState<ActiveModal>('none');
  const [showScreenWarning, setShowScreenWarning] = useState(false);
  const [appNotice, setAppNotice] = useState<string | null>(null);
  const [isMobileLayout, setIsMobileLayout] = useState<boolean>(() => (
      typeof window !== 'undefined' ? window.innerWidth <= 1024 : false
  ));
  const [mobileActiveTab, setMobileActiveTab] = useState<MobileTab>('oscillators');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileMenuVisualState, setMobileMenuVisualState] = useState<MobileMenuVisualState>('open');
  const [isMobileKeyboardOpen, setIsMobileKeyboardOpen] = useState(false);
  const [mobileKeyboardPolyphonic, setMobileKeyboardPolyphonic] = useState(false);
  const [mobileKeyboardControlFaders, setMobileKeyboardControlFaders] = useState<Array<{ target: LfoTarget; value: number }>>(
      () => MOBILE_KEYBOARD_CONTROL_FADERS_DEFAULT.map(item => ({ ...item }))
  );
  const [isMobileContentAtTop, setIsMobileContentAtTop] = useState(true);
  const [isMobileContentAtBottom, setIsMobileContentAtBottom] = useState(false);
  const showInfo = activeModal === 'manual';
  const showMidi = activeModal === 'midi';
  const showAbout = activeModal === 'about';
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileContentRef = useRef<HTMLDivElement>(null);
  const mobileMenuSwipeRef = useRef<{ startX: number; startY: number; pointerId: number } | null>(null);
  const mobileMenuCloseTimerRef = useRef<number | null>(null);
  const mobileLastTabRef = useRef<MobileTab>('oscillators');
  const mobileKeyboardControlFadersRef = useRef(mobileKeyboardControlFaders);
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
      triggerMobileKeyboardNote, releaseMobileKeyboardNotes,
      handleTapTempo,
      isVOctGateActive1, isVOctGateActive2,
      midiAccess, midiConfig, updateMidiConfig, midiInputs,
      setLearningMapping, learningMappingIndex,
      notifyUiControl 
  } = useSynth(params, interactionMode, setTargetValue);
  
  useEffect(() => {
      const handleResize = () => {
          setIsMobileLayout(window.innerWidth <= 1024);
      };
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
      notifyUiControlRef.current = notifyUiControl;
  }, [notifyUiControl]);

  useEffect(() => {
      mobileKeyboardControlFadersRef.current = mobileKeyboardControlFaders;
  }, [mobileKeyboardControlFaders]);

  useEffect(() => {
      return () => {
          if (mobileMenuCloseTimerRef.current !== null) {
              window.clearTimeout(mobileMenuCloseTimerRef.current);
              mobileMenuCloseTimerRef.current = null;
          }
      };
  }, []);

  useEffect(() => {
      if (activeModal === 'midi' && !midiAccess) {
          setActiveModal('none');
      }
  }, [activeModal, midiAccess]);

  useEffect(() => {
      if (isMobileLayout && activeModal === 'midi') {
          setActiveModal('none');
      }
      if (!isMobileLayout) {
          if (mobileMenuCloseTimerRef.current !== null) {
              window.clearTimeout(mobileMenuCloseTimerRef.current);
              mobileMenuCloseTimerRef.current = null;
          }
          mobileMenuSwipeRef.current = null;
          setMobileMenuVisualState('open');
          setIsMobileMenuOpen(false);
          setIsMobileKeyboardOpen(false);
      }
  }, [isMobileLayout, activeModal]);

  useEffect(() => {
      if (!isMobileLayout) {
          releaseMobileKeyboardNotes();
      }
  }, [isMobileLayout, releaseMobileKeyboardNotes]);

  useEffect(() => {
      if (!isStarted) return;
      if (isMobileLayout) {
          setShowScreenWarning(false);
          return;
      }
      const checkSize = () => {
          if (window.innerWidth < 1280 || window.innerHeight < 700) {
              setShowScreenWarning(true);
          }
      };
      checkSize();
  }, [isStarted, isMobileLayout]);

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
  const openMobileKeyboard = useCallback(() => {
      mobileLastTabRef.current = mobileActiveTab;
      releaseMobileKeyboardNotes();
      triggerGate(1, false, true);
      triggerGate(2, false, true);
      setParams(prev => {
          const nextOsc1 = (prev.osc1.voltOct && !prev.osc1.drone && !prev.osc1.midi)
              ? prev.osc1
              : {
                  ...prev.osc1,
                  voltOct: true,
                  drone: false,
                  midi: false,
                  octave: prev.osc1.voltOct ? prev.osc1.octave : 0
              };
          const nextOsc2 = (prev.osc2.voltOct && !prev.osc2.drone && !prev.osc2.midi)
              ? prev.osc2
              : {
                  ...prev.osc2,
                  voltOct: true,
                  drone: false,
                  midi: false,
                  octave: prev.osc2.voltOct ? prev.osc2.octave : 0
              };
          if (nextOsc1 === prev.osc1 && nextOsc2 === prev.osc2) return prev;
          return { ...prev, osc1: nextOsc1, osc2: nextOsc2 };
      });
      setIsMobileKeyboardOpen(true);
      if (mobileMenuCloseTimerRef.current !== null) {
          window.clearTimeout(mobileMenuCloseTimerRef.current);
          mobileMenuCloseTimerRef.current = null;
      }
      mobileMenuSwipeRef.current = null;
      setMobileMenuVisualState('open');
      setIsMobileMenuOpen(false);
      if (typeof document !== 'undefined' && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {
              // Some mobile browsers block fullscreen; keyboard overlay still works.
          });
      }
  }, [mobileActiveTab, releaseMobileKeyboardNotes, triggerGate]);
  const closeMobileKeyboard = useCallback(() => {
      releaseMobileKeyboardNotes();
      setIsMobileKeyboardOpen(false);
      setMobileActiveTab(mobileLastTabRef.current);
      if (typeof document !== 'undefined' && document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {
              // Ignore browser-specific fullscreen exit failures.
          });
      }
  }, [releaseMobileKeyboardNotes]);
  const handleMobileKeyboardPolyphonicChange = useCallback((next: boolean) => {
      releaseMobileKeyboardNotes();
      setMobileKeyboardPolyphonic(next);
  }, [releaseMobileKeyboardNotes]);
  const handleMobileKeyboardNoteOn = useCallback((note: number) => {
      if (!isMobileKeyboardOpen) return;
      triggerMobileKeyboardNote(note, true, mobileKeyboardPolyphonic);
  }, [isMobileKeyboardOpen, mobileKeyboardPolyphonic, triggerMobileKeyboardNote]);
  const handleMobileKeyboardNoteOff = useCallback((note: number) => {
      if (!isMobileKeyboardOpen) return;
      triggerMobileKeyboardNote(note, false, mobileKeyboardPolyphonic);
  }, [isMobileKeyboardOpen, mobileKeyboardPolyphonic, triggerMobileKeyboardNote]);
  const handleMobileKeyboardControlTargetChange = useCallback((index: number, target: LfoTarget) => {
      if (!isMobileKeyboardOpen) return;
      const current = mobileKeyboardControlFadersRef.current;
      if (index < 0 || index >= current.length) return;
      const next = [...current];
      const nextValue = next[index].value;
      next[index] = { ...next[index], target };
      mobileKeyboardControlFadersRef.current = next;
      setMobileKeyboardControlFaders(next);
      if (target !== 'none') {
          notifyUiControlRef.current();
          setInteractionMode('instant');
          setTargetValue(target, nextValue);
      }
  }, [isMobileKeyboardOpen, setTargetValue]);
  const handleMobileKeyboardControlValueChange = useCallback((index: number, value: number) => {
      if (!isMobileKeyboardOpen) return;
      const current = mobileKeyboardControlFadersRef.current;
      if (index < 0 || index >= current.length) return;
      const target = current[index].target;
      const next = [...current];
      next[index] = { ...next[index], value };
      mobileKeyboardControlFadersRef.current = next;
      setMobileKeyboardControlFaders(next);
      if (target !== 'none') {
          notifyUiControlRef.current();
          setInteractionMode('instant');
          setTargetValue(target, value);
      }
  }, [isMobileKeyboardOpen, setTargetValue]);
  const handleMobileKeyboardOscOctaveChange = useCallback((oscId: 1 | 2, octave: number) => {
      if (!isMobileKeyboardOpen) return;
      const min = OCTAVE_FOOTAGE[0].value;
      const max = OCTAVE_FOOTAGE[OCTAVE_FOOTAGE.length - 1].value;
      const next = Math.max(min, Math.min(max, octave));
      notifyUiControlRef.current();
      setInteractionMode('instant');
      updateOsc(oscId === 1 ? 'osc1' : 'osc2', 'octave', next);
  }, [isMobileKeyboardOpen, updateOsc]);
  const handleMobileKeyboardOscModeChange = useCallback((oscId: 1 | 2, mode: MobileKeyboardOscMode) => {
      if (!isMobileKeyboardOpen) return;
      notifyUiControlRef.current();
      setInteractionMode('instant');
      if (mode !== 'kbd') {
          releaseMobileKeyboardNotes();
      }
      const oscKey = oscId === 1 ? 'osc1' : 'osc2';
      setParams(prev => {
          const currentOsc = prev[oscKey];
          const nextOsc = mode === 'kbd'
              ? { ...currentOsc, voltOct: true, drone: false, midi: false }
              : mode === 'drone'
                  ? { ...currentOsc, voltOct: false, drone: true, midi: false }
                  : { ...currentOsc, voltOct: false, drone: false, midi: false };

          if (
              nextOsc.voltOct === currentOsc.voltOct &&
              nextOsc.drone === currentOsc.drone &&
              nextOsc.midi === currentOsc.midi
          ) {
              return prev;
          }
          return { ...prev, [oscKey]: nextOsc };
      });
      triggerGate(oscId, mode === 'drone', true);
  }, [isMobileKeyboardOpen, releaseMobileKeyboardNotes, triggerGate]);
  const openMobileMenu = useCallback(() => {
      if (mobileMenuCloseTimerRef.current !== null) {
          window.clearTimeout(mobileMenuCloseTimerRef.current);
          mobileMenuCloseTimerRef.current = null;
      }
      mobileMenuSwipeRef.current = null;
      setMobileMenuVisualState('entering');
      setIsMobileMenuOpen(true);
      window.requestAnimationFrame(() => {
          setMobileMenuVisualState('open');
      });
  }, []);
  const closeMobileMenuImmediate = useCallback(() => {
      if (mobileMenuCloseTimerRef.current !== null) {
          window.clearTimeout(mobileMenuCloseTimerRef.current);
          mobileMenuCloseTimerRef.current = null;
      }
      mobileMenuSwipeRef.current = null;
      setMobileMenuVisualState('open');
      setIsMobileMenuOpen(false);
  }, []);
  const closeMobileMenu = useCallback((direction: 'up' | 'right' = 'up') => {
      if (!isMobileMenuOpen) {
          closeMobileMenuImmediate();
          return;
      }
      if (mobileMenuCloseTimerRef.current !== null) {
          window.clearTimeout(mobileMenuCloseTimerRef.current);
      }
      setMobileMenuVisualState('closing-right');
      mobileMenuCloseTimerRef.current = window.setTimeout(() => {
          mobileMenuCloseTimerRef.current = null;
          mobileMenuSwipeRef.current = null;
          setMobileMenuVisualState('open');
          setIsMobileMenuOpen(false);
      }, MOBILE_MENU_ANIMATION_MS);
  }, [closeMobileMenuImmediate, isMobileMenuOpen]);
  const clearMobileMenuSwipe = useCallback(() => {
      mobileMenuSwipeRef.current = null;
  }, []);
  const handleMobileMenuPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== 'touch') return;
      mobileMenuSwipeRef.current = {
          startX: event.clientX,
          startY: event.clientY,
          pointerId: event.pointerId
      };
  }, []);
  const handleMobileMenuPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
      const swipe = mobileMenuSwipeRef.current;
      if (!swipe || event.pointerType !== 'touch' || swipe.pointerId !== event.pointerId) return;
      const dx = event.clientX - swipe.startX;
      const dy = event.clientY - swipe.startY;
      const swipeUpToClose = dy <= -48 && Math.abs(dy) > Math.abs(dx) + 12;
      const swipeRightToClose = dx >= 48 && dx > Math.abs(dy) + 12;
      if (swipeUpToClose) {
          mobileMenuSwipeRef.current = null;
          triggerMobileHaptic('medium');
          closeMobileMenu('right');
      } else if (swipeRightToClose) {
          mobileMenuSwipeRef.current = null;
          triggerMobileHaptic('medium');
          closeMobileMenu('right');
      }
  }, [closeMobileMenu]);
  const handleMobileContentScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
      const target = event.currentTarget;
      const atTop = target.scrollTop <= 1;
      const atBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 2;
      setIsMobileContentAtTop(prev => (prev === atTop ? prev : atTop));
      setIsMobileContentAtBottom(prev => (prev === atBottom ? prev : atBottom));
  }, []);

  useEffect(() => {
      if (!isMobileLayout) {
          setIsMobileContentAtTop(true);
          setIsMobileContentAtBottom(false);
          return;
      }
      const target = mobileContentRef.current;
      if (!target) return;
      const atTop = target.scrollTop <= 1;
      const atBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 2;
      setIsMobileContentAtTop(atTop);
      setIsMobileContentAtBottom(atBottom);
  }, [isMobileLayout, mobileActiveTab, isMobileMenuOpen]);

  useEffect(() => {
      mobileLastTabRef.current = mobileActiveTab;
  }, [mobileActiveTab]);
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
        <InstructionsModal isOpen={showInfo} onClose={closeActiveModal} isMobile={isMobileLayout} />
        {!isMobileLayout && (
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
        )}
        <div className="flex-grow flex flex-col items-center justify-center gap-8">
          {appNotice && <div className="mb-2 px-3 py-1 border border-red-800 bg-red-950/30 text-red-300 text-[10px] uppercase tracking-wider">{appNotice}</div>}
          <div className="text-center">
            <h1 className="mb-4 _t-init-title">{TEXTS.title}</h1>
            {isMobileLayout ? (
              <h2 className="_t-init-subtitle" style={{ lineHeight: 2.0 }}>
                <span className="block">WEB-BASED</span>
                <span className="block whitespace-nowrap" style={{ marginTop: "-2px" }}>NOISE SYNTHESIZER</span>
              </h2>
            ) : (
              <h2 className="_t-init-subtitle">{TEXTS.subtitle}</h2>
            )}
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

  let mobileTabContent: React.ReactNode = null;
  switch (mobileActiveTab) {
      case 'oscillators':
          mobileTabContent = (
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
                  layoutMode="mobile"
                  hideMidiControls
              />
          );
          break;
      case 'modulation':
          mobileTabContent = (
              <ModulationSection
                  lfo1={params.lfo1}
                  lfo2={params.lfo2}
                  osc1Wave={params.osc1.wave}
                  osc2Wave={params.osc2.wave}
                  oscMod={params.oscMod}
                  modEnv1={params.modEnv1}
                  modEnv2={params.modEnv2}
                  updateLfo={updateLfo}
                  updateModPath={updateModPath}
                  updateModEnv={updateModEnv}
                  onLfoTapTempo={onLfoTapTempo}
                  layoutMode="mobile"
              />
          );
          break;
      case 'sequencers':
          mobileTabContent = (
              <div className="flex flex-col gap-6">
                  <VoiceSequencerSection
                      params={params}
                      layoutMode="mobile"
                      currentStep1={currentStep1}
                      currentStep2={currentStep2}
                      updateSeq={updateSeq}
                      updateSeqStep={updateSeqStep}
                      toggleSeqGate={toggleSeqGate}
                      toggleSequencer={toggleSequencer}
                      syncSequencers={syncSequencers}
                      manualSeqStep={manualSeqStep}
                      resetSequencer={resetSequencer}
                      randomizePattern={randomizePattern}
                  />
                  <ModSequencerSection
                      params={params}
                      currentStepMod1={currentStepMod1}
                      currentStepMod2={currentStepMod2}
                      updateSeq={updateSeq}
                      updateSeqStep={updateSeqStep}
                      toggleModSequencer={toggleModSequencer}
                      syncModSequencers={syncModSequencers}
                      syncModToMaster={syncModToMaster}
                      manualModSeqStep={manualModSeqStep}
                      resetModSequencer={resetModSequencer}
                      randomizePattern={randomizePattern}
                  />
              </div>
          );
          break;
      case 'matrix':
          mobileTabContent = (
              <MatrixSection
                  params={params}
                  assignTargets={assignTargets}
                  setAssignTargets={setAssignTargets}
                  sensitivities={sensitivities}
                  setSensitivities={setSensitivities}
                  onMacroMove={handleMacroMove}
                  triggerGate={triggerGate}
                  setTargetValue={setTargetValue}
                  setInteractionMode={setInteractionMode}
                  layoutMode="mobile"
              />
          );
          break;
      case 'effects':
          mobileTabContent = (
              <EffectsSection
                  global={params.global}
                  noise={params.noise}
                  updateGlobal={updateGlobal}
                  updateNoise={updateNoise}
                  onTapTempo={onTapTempo}
              />
          );
          break;
      case 'mix-record':
          mobileTabContent = (
              <MasterSection
                  analyserNode={analyserNode}
                  global={params.global}
                  osc1={params.osc1}
                  osc2={params.osc2}
                  updateGlobal={updateGlobal}
                  updateOsc={updateOsc}
                  isModalOpen={activeModal !== 'none' || isMobileMenuOpen || isMobileKeyboardOpen}
                  layoutMode="mobile"
              />
          );
          break;
      default:
          break;
  }

  if (isMobileLayout) {
      return (
          <div className="h-screen overflow-hidden" style={{ backgroundColor: 'var(--color-fader-track)' }}>
              {appNotice && (
                  <div className="absolute top-2 left-2 right-2 z-[140] px-3 py-1 border border-red-800 bg-red-950/30 text-red-300 text-[10px] uppercase tracking-wider">
                      {appNotice}
                  </div>
              )}
              <InstructionsModal isOpen={showInfo} onClose={closeActiveModal} isMobile={isMobileLayout} />
              <AboutModal isOpen={showAbout} onClose={closeActiveModal} />
              <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept=".json" />

              {isMobileMenuOpen && (
                  <div
                      className={`fixed inset-0 z-[120] bg-black/80 transition-opacity duration-200 ${mobileMenuVisualState === 'open' ? 'opacity-100' : 'opacity-0'}`}
                      onClick={() => closeMobileMenu('right')}
                  >
                      <div
                          className={`h-full w-full bg-black/95 flex flex-col transition-transform transition-opacity duration-200 ${
                              mobileMenuVisualState === 'entering'
                                  ? 'opacity-0 translate-x-16'
                                  : mobileMenuVisualState === 'closing-right'
                                      ? 'opacity-0 translate-x-16'
                                      : 'opacity-100 translate-x-0'
                          }`}
                          style={{
                              paddingTop: 'calc(10px + env(safe-area-inset-top))',
                              paddingBottom: 'calc(14px + env(safe-area-inset-bottom))'
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={handleMobileMenuPointerDown}
                          onPointerMove={handleMobileMenuPointerMove}
                          onPointerUp={clearMobileMenuSwipe}
                          onPointerCancel={clearMobileMenuSwipe}
                      >
                          <div className="relative px-4 pb-2">
                              <div
                                  className="select-none text-center pointer-events-none"
                                  style={{ transform: 'translateY(40px)' }}
                              >
                                  <div className="_t-init-title" style={{ fontSize: '24px' }}>
                                      {TEXTS.title}
                                  </div>
                                  <div className="_t-init-subtitle" style={{ fontSize: '8px', letterSpacing: '0.22em' }}>
                                      {TEXTS.subtitle}
                                  </div>
                              </div>
                              <button
                                  type="button"
                                  aria-label="Close menu"
                                  onPointerDown={(e) => {
                                      if (e.pointerType === 'touch') triggerMobileHaptic('light');
                                  }}
                                  onClick={() => closeMobileMenu('right')}
                                  className="absolute top-0 left-4 inline-flex h-9 w-9 items-center justify-center text-zinc-400"
                              >
                                  <svg
                                      aria-hidden="true"
                                      viewBox="0 0 20 20"
                                      fill="none"
                                      className="h-[22px] w-[22px]"
                                  >
                                      <path
                                          d="M12.5 4.5L7 10l5.5 5.5"
                                          stroke="currentColor"
                                          strokeWidth="1.8"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                      />
                                  </svg>
                              </button>
                          </div>
                          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
                              <button
                                  type="button"
                                  onPointerDown={(e) => {
                                      if (e.pointerType === 'touch') triggerMobileHaptic('light');
                                  }}
                                  onClick={() => { handleSave(); closeMobileMenu('right'); }}
                                  className="_t-sub-sect translate-y-0 py-1"
                                  style={{ color: 'var(--color-text-label)' }}
                              >
                                  SAVE PATCH
                              </button>
                              <button
                                  type="button"
                                  onPointerDown={(e) => {
                                      if (e.pointerType === 'touch') triggerMobileHaptic('light');
                                  }}
                                  onClick={() => { handleLoadClick(); closeMobileMenu('right'); }}
                                  className="_t-sub-sect translate-y-0 py-1"
                                  style={{ color: 'var(--color-text-label)' }}
                              >
                                  LOAD PATCH
                              </button>
                              <button
                                  type="button"
                                  onPointerDown={(e) => {
                                      if (e.pointerType === 'touch') triggerMobileHaptic('light');
                                  }}
                                  onClick={() => { openModal('manual'); closeMobileMenu('right'); }}
                                  className="_t-sub-sect translate-y-0 py-1"
                                  style={{ color: 'var(--color-text-label)' }}
                              >
                                  MANUAL
                              </button>
                              <button
                                  type="button"
                                  onPointerDown={(e) => {
                                      if (e.pointerType === 'touch') triggerMobileHaptic('light');
                                  }}
                                  onClick={() => { openModal('about'); closeMobileMenu('right'); }}
                                  className="_t-sub-sect translate-y-0 py-1"
                                  style={{ color: 'var(--color-text-label)' }}
                              >
                                  ABOUT PROJECT
                              </button>
                          </div>
                          <div className="px-4 pt-4 border-t border-zinc-800 flex flex-col gap-1 _t-label text-center">
                              <span>{TEXTS.footer.version}</span>
                              <span>{TEXTS.footer.credit}</span>
                              <span>{TEXTS.footer.license}</span>
                          </div>
                      </div>
                  </div>
              )}

              {isMobileKeyboardOpen && (
                  <MobileKeyboardOverlay
                      controlFaders={mobileKeyboardControlFaders}
                      isOpen={isMobileKeyboardOpen}
                      polyphonic={mobileKeyboardPolyphonic}
                      osc1Mode={params.osc1.drone ? 'drone' : params.osc1.voltOct ? 'kbd' : 'off'}
                      osc2Mode={params.osc2.drone ? 'drone' : params.osc2.voltOct ? 'kbd' : 'off'}
                      onPolyphonicChange={handleMobileKeyboardPolyphonicChange}
                      onClose={closeMobileKeyboard}
                      onNoteOn={handleMobileKeyboardNoteOn}
                      onNoteOff={handleMobileKeyboardNoteOff}
                      osc1Octave={params.osc1.octave}
                      osc2Octave={params.osc2.octave}
                      onOscModeChange={handleMobileKeyboardOscModeChange}
                      onOscOctaveChange={handleMobileKeyboardOscOctaveChange}
                      onControlTargetChange={handleMobileKeyboardControlTargetChange}
                      onControlValueChange={handleMobileKeyboardControlValueChange}
                  />
              )}

              <div
                  className="fixed inset-x-0 top-0 z-40 border-b border-zinc-800 px-3"
                  style={{ paddingTop: 'env(safe-area-inset-top)', backgroundColor: 'var(--color-fader-track)' }}
              >
                  <div className="flex h-12 items-center justify-between">
                      <div
                          className="_t-panel-title select-none leading-none"
                          style={{ fontSize: '14px' }}
                      >
                          TETHER
                      </div>
                      <button
                          type="button"
                          aria-label="Open menu"
                          onPointerDown={(e) => {
                              if (e.pointerType === 'touch') triggerMobileHaptic('light');
                          }}
                          onClick={openMobileMenu}
                          className="inline-flex h-8 w-8 flex-col items-center justify-center gap-1"
                      >
                          <span className="block h-[1px] w-5 bg-zinc-300" />
                          <span className="block h-[1px] w-5 bg-zinc-300" />
                          <span className="block h-[1px] w-5 bg-zinc-300" />
                      </button>
                  </div>
              </div>

              <div
                  className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800"
                  style={{ paddingBottom: 'env(safe-area-inset-bottom)', backgroundColor: 'var(--color-fader-track)' }}
              >
                  <div className="relative grid w-full grid-cols-3 grid-rows-2 overflow-hidden">
                      {MOBILE_TABS.map((tab, index) => {
                          const isLastColumn = index % 3 === 2;
                          const isLastRow = index >= 3;
                          const isActive = mobileActiveTab === tab.key;

                          return (
                              <button
                                  key={tab.key}
                                  type="button"
                                   onPointerDown={(e) => {
                                       if (e.pointerType === 'touch') triggerMobileHaptic('light');
                                   }}
                                   onClick={() => setMobileActiveTab(tab.key)}
                                   className={`h-[37px] _t-label transition-colors ${isLastColumn ? '' : 'border-r border-zinc-800'} ${isLastRow ? '' : 'border-b border-zinc-800'} ${isActive ? 'text-[var(--color-button-active-text)]' : 'bg-transparent text-[var(--color-text-subtitle)] hover:text-[var(--color-text-subtitle)]'}`}
                                   style={isActive ? { backgroundColor: 'var(--color-button-active-bg)', transform: 'none' } : { transform: 'none' }}
                              >
                                  {tab.label}
                              </button>
                          );
                      })}
                  </div>
                  <div className="border-t border-zinc-800">
                      <button
                          type="button"
                          onPointerDown={(e) => {
                              if (e.pointerType === 'touch') triggerMobileHaptic('medium');
                          }}
                          onClick={openMobileKeyboard}
                          className="_t-label h-[36px] w-full transition-colors"
                          style={
                              isMobileKeyboardOpen
                                  ? { backgroundColor: 'var(--color-button-active-bg)', color: 'var(--color-button-active-text)', transform: 'none' }
                                  : { color: 'var(--color-text-subtitle)', transform: 'none' }
                          }
                      >
                          KEYBOARD
                      </button>
                  </div>
              </div>

              <div
                  className={`fixed inset-x-0 z-30 pointer-events-none transition-opacity duration-150 ${isMobileContentAtTop ? 'opacity-0' : 'opacity-100'}`}
                  style={{
                      top: `calc(${MOBILE_TOP_MENU_HEIGHT}px + env(safe-area-inset-top))`,
                      height: '28px',
                      background: 'linear-gradient(to bottom, rgba(0,0,0,0.52), rgba(0,0,0,0))'
                  }}
              />

              <div
                  className={`fixed inset-x-0 z-30 pointer-events-none transition-opacity duration-150 ${isMobileContentAtBottom ? 'opacity-0' : 'opacity-100'}`}
                  style={{
                      bottom: `calc(${MOBILE_BOTTOM_MENU_HEIGHT}px + env(safe-area-inset-bottom))`,
                      height: '28px',
                      background: 'linear-gradient(to top, rgba(0,0,0,0.52), rgba(0,0,0,0))'
                  }}
              />

              <div
                  className="fixed inset-x-0 overflow-y-auto _scroll-thin px-4 py-4"
                  ref={mobileContentRef}
                  onScroll={handleMobileContentScroll}
                  style={{
                      top: `calc(${MOBILE_TOP_MENU_HEIGHT}px + env(safe-area-inset-top))`,
                      bottom: `calc(${MOBILE_BOTTOM_MENU_HEIGHT}px + env(safe-area-inset-bottom))`,
                      WebkitOverflowScrolling: 'touch',
                      overscrollBehaviorY: 'contain',
                      touchAction: 'pan-y'
                  }}
              >
                  {mobileTabContent}
              </div>
          </div>
      );
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-950 overflow-hidden">
      {appNotice && <div className="absolute top-2 right-2 z-50 px-3 py-1 border border-red-800 bg-red-950/30 text-red-300 text-[10px] uppercase tracking-wider">{appNotice}</div>}
      <ScreenSizeWarningModal isOpen={showScreenWarning} onClose={() => setShowScreenWarning(false)} />
      <InstructionsModal isOpen={showInfo} onClose={closeActiveModal} isMobile={isMobileLayout} />
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

