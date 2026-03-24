import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LfoTarget } from '../types';
import { LFO_TARGET_VALUES, OCTAVE_FOOTAGE, TARGET_GROUPS, TEXTS } from '../data/constants';
import { Fader, Label, Select, Value } from './library/Controls';
import { triggerMobileHaptic } from '../utils/haptics';

interface MobileKeyboardOverlayProps {
  controlFaders: Array<{ target: LfoTarget; value: number }>;
  isOpen: boolean;
  polyphonic: boolean;
  osc1Mode: 'kbd' | 'drone' | 'off';
  osc2Mode: 'kbd' | 'drone' | 'off';
  onPolyphonicChange: (polyphonic: boolean) => void;
  onClose: () => void;
  onNoteOn: (note: number) => void;
  onNoteOff: (note: number) => void;
  osc1Octave: number;
  osc2Octave: number;
  onOscModeChange: (oscId: 1 | 2, mode: 'kbd' | 'drone' | 'off') => void;
  onOscOctaveChange: (oscId: 1 | 2, octave: number) => void;
  onControlTargetChange: (index: number, target: LfoTarget) => void;
  onControlValueChange: (index: number, value: number) => void;
}

const WHITE_KEYS = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83];
const BLACK_KEYS: Array<{ note: number; afterWhiteIndex: number }> = [
  { note: 61, afterWhiteIndex: 0 },
  { note: 63, afterWhiteIndex: 1 },
  { note: 66, afterWhiteIndex: 3 },
  { note: 68, afterWhiteIndex: 4 },
  { note: 70, afterWhiteIndex: 5 },
  { note: 73, afterWhiteIndex: 7 },
  { note: 75, afterWhiteIndex: 8 },
  { note: 78, afterWhiteIndex: 10 },
  { note: 80, afterWhiteIndex: 11 },
  { note: 82, afterWhiteIndex: 12 }
];

const WARNING_SWIPE_CLOSE_THRESHOLD = 56;
const WARNING_ANIMATION_MS = 180;
const MAX_POLY_NOTES = 6;
const BLACK_KEY_HEIGHT_RATIO = 0.5;
const KEY_COLORS = {
  whiteIdle: 'var(--color-fader-track)',
  whiteActive: 'var(--color-border-dim)',
  blackIdle: 'var(--color-bg)',
  blackActive: 'var(--color-panel)',
  bed: 'var(--color-fader-track)'
} as const;

const isLandscapeOrientation = () => {
  if (typeof window === 'undefined') return true;
  if (typeof window.matchMedia === 'function') {
    const mediaLandscape = window.matchMedia('(orientation: landscape)').matches;
    if (mediaLandscape) return true;
  }
  return window.innerWidth > window.innerHeight;
};

const MobileKeyboardOverlay: React.FC<MobileKeyboardOverlayProps> = ({
  controlFaders,
  isOpen,
  polyphonic,
  osc1Mode,
  osc2Mode,
  onPolyphonicChange,
  onClose,
  onNoteOn,
  onNoteOff,
  osc1Octave,
  osc2Octave,
  onOscModeChange,
  onOscOctaveChange,
  onControlTargetChange,
  onControlValueChange
}) => {
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [holdEnabled, setHoldEnabled] = useState(false);
  const [isLandscape, setIsLandscape] = useState<boolean>(isLandscapeOrientation);
  const [warningVisualState, setWarningVisualState] = useState<'hidden' | 'entering' | 'open' | 'closing-right'>('hidden');
  const inputToNoteRef = useRef<Map<string, number>>(new Map());
  const notePressCountRef = useRef<Map<number, number>>(new Map());
  const heldNotesRef = useRef<Set<number>>(new Set());
  const holdEnabledRef = useRef(false);
  const lastPressedNoteRef = useRef<number | null>(null);
  const lastHeldNoteRef = useRef<number | null>(null);
  const warningSwipeRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const warningCloseTimerRef = useRef<number | null>(null);
  const warningRafRef = useRef<number | null>(null);
  const keyboardSurfaceRef = useRef<HTMLDivElement | null>(null);

  const pointerKey = useCallback((pointerId: number) => `p:${pointerId}`, []);
  const touchKey = useCallback((touchId: number) => `t:${touchId}`, []);

  const resolveNoteFromGeometry = useCallback((clientX: number, clientY: number): number | null => {
    const surface = keyboardSurfaceRef.current;
    if (!surface) return null;
    const rect = surface.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;

    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const whiteWidth = rect.width / WHITE_KEYS.length;
    const blackHeight = rect.height * BLACK_KEY_HEIGHT_RATIO;

    if (localY <= blackHeight) {
      for (const { note, afterWhiteIndex } of BLACK_KEYS) {
        const left = whiteWidth * (afterWhiteIndex + 1) - whiteWidth * 0.32;
        const width = whiteWidth * 0.64;
        const tolerance = Math.max(2, whiteWidth * 0.05);
        if (localX >= left - tolerance && localX <= left + width + tolerance) {
          return note;
        }
      }
    }

    const whiteIndex = Math.min(
      WHITE_KEYS.length - 1,
      Math.max(0, Math.floor(localX / whiteWidth))
    );
    return WHITE_KEYS[whiteIndex] ?? null;
  }, []);

  const resolveNoteFromPoint = useCallback((clientX: number, clientY: number): number | null => {
    if (typeof document === 'undefined') return null;
    const node = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    if (node) {
      const keyNode = node.closest<HTMLElement>('[data-kbd-note]');
      if (keyNode) {
        const raw = keyNode.dataset.kbdNote;
        if (raw) {
          const parsed = Number(raw);
          if (Number.isFinite(parsed)) return parsed;
        }
      }
    }
    return resolveNoteFromGeometry(clientX, clientY);
  }, [resolveNoteFromGeometry]);

  useEffect(() => {
    holdEnabledRef.current = holdEnabled;
  }, [holdEnabled]);

  useEffect(() => {
    return () => {
      if (warningCloseTimerRef.current !== null) {
        window.clearTimeout(warningCloseTimerRef.current);
        warningCloseTimerRef.current = null;
      }
      if (warningRafRef.current !== null) {
        window.cancelAnimationFrame(warningRafRef.current);
        warningRafRef.current = null;
      }
    };
  }, []);

  const syncActiveNotes = useCallback((preferredMonoNote?: number) => {
    const pressedNotes = Array.from<number>(notePressCountRef.current.keys());
    const heldNotes = Array.from<number>(heldNotesRef.current.values());

    if (polyphonic) {
      const ordered: number[] = [];
      for (const note of pressedNotes) {
        if (!ordered.includes(note)) ordered.push(note);
      }
      for (const note of heldNotes) {
        if (!ordered.includes(note)) ordered.push(note);
      }
      const tail = ordered.slice(-MAX_POLY_NOTES);
      setActiveNotes(new Set(tail));
      return;
    }

    let monoNote: number | null = null;
    if (preferredMonoNote !== undefined && (notePressCountRef.current.has(preferredMonoNote) || heldNotesRef.current.has(preferredMonoNote))) {
      monoNote = preferredMonoNote;
    }
    if (monoNote === null) {
      const lastPressed = lastPressedNoteRef.current;
      if (lastPressed !== null && notePressCountRef.current.has(lastPressed)) {
        monoNote = lastPressed;
      } else if (pressedNotes.length > 0) {
        monoNote = pressedNotes[pressedNotes.length - 1];
      }
    }
    if (monoNote === null) {
      const lastHeld = lastHeldNoteRef.current;
      if (lastHeld !== null && heldNotesRef.current.has(lastHeld)) {
        monoNote = lastHeld;
      } else if (heldNotes.length > 0) {
        monoNote = heldNotes[heldNotes.length - 1];
      }
    }
    setActiveNotes(monoNote === null ? new Set() : new Set([monoNote]));
  }, [polyphonic]);

  useEffect(() => {
    syncActiveNotes();
  }, [polyphonic, syncActiveNotes]);

  const pressNote = useCallback((note: number): boolean => {
    const activeCount = notePressCountRef.current.get(note) ?? 0;
    if (holdEnabledRef.current && heldNotesRef.current.has(note) && activeCount === 0) {
      // Repeat tap on a held note toggles HOLD latch off for that note.
      heldNotesRef.current.delete(note);
      if (lastHeldNoteRef.current === note) lastHeldNoteRef.current = null;
      onNoteOff(note);
      syncActiveNotes();
      return false;
    }

    if (!polyphonic && holdEnabledRef.current && heldNotesRef.current.size > 0) {
      const oldHeld = Array.from(heldNotesRef.current.values());
      heldNotesRef.current.clear();
      oldHeld.forEach((heldNote) => {
        if (heldNote === note) return;
        if ((notePressCountRef.current.get(heldNote) ?? 0) > 0) return;
        onNoteOff(heldNote);
      });
      lastHeldNoteRef.current = null;
    } else {
      heldNotesRef.current.delete(note);
    }
    const count = notePressCountRef.current.get(note) ?? 0;
    notePressCountRef.current.set(note, count + 1);
    lastPressedNoteRef.current = note;
    if (count === 0) {
      onNoteOn(note);
    }
    syncActiveNotes(note);
    return true;
  }, [onNoteOff, onNoteOn, polyphonic, syncActiveNotes]);

  const releaseNote = useCallback((note: number) => {
    const count = notePressCountRef.current.get(note);
    if (!count) return;
    if (count <= 1) {
      notePressCountRef.current.delete(note);
      if (holdEnabledRef.current) {
        if (polyphonic) {
          heldNotesRef.current.add(note);
          lastHeldNoteRef.current = note;
        } else {
          const oldHeld = Array.from(heldNotesRef.current.values());
          heldNotesRef.current.clear();
          oldHeld.forEach((heldNote) => {
            if (heldNote === note) return;
            if ((notePressCountRef.current.get(heldNote) ?? 0) > 0) return;
            onNoteOff(heldNote);
          });
          heldNotesRef.current.add(note);
          lastHeldNoteRef.current = note;
        }
        syncActiveNotes(note);
        return;
      }
      onNoteOff(note);
      syncActiveNotes();
      return;
    }
    notePressCountRef.current.set(note, count - 1);
    syncActiveNotes();
  }, [onNoteOff, polyphonic, syncActiveNotes]);

  const endInput = useCallback((id: string) => {
    const note = inputToNoteRef.current.get(id);
    if (note === undefined) return;
    inputToNoteRef.current.delete(id);
    releaseNote(note);
  }, [releaseNote]);

  const releaseAll = useCallback(() => {
    inputToNoteRef.current.clear();
    const pressedNotes = Array.from(notePressCountRef.current.keys());
    notePressCountRef.current.clear();
    heldNotesRef.current.clear();
    lastPressedNoteRef.current = null;
    lastHeldNoteRef.current = null;
    pressedNotes.forEach(note => onNoteOff(note));
    setActiveNotes(new Set());
  }, [onNoteOff]);

  const releaseHeldNotes = useCallback(() => {
    if (heldNotesRef.current.size === 0) return;
    const notes = Array.from(heldNotesRef.current.values());
    heldNotesRef.current.clear();
    lastHeldNoteRef.current = null;
    notes.forEach(note => {
      if ((notePressCountRef.current.get(note) ?? 0) > 0) return;
      onNoteOff(note);
    });
    syncActiveNotes();
  }, [onNoteOff, syncActiveNotes]);

  useEffect(() => {
    if (isOpen) return;
    releaseAll();
  }, [isOpen, releaseAll]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const syncOrientation = () => {
      setIsLandscape(isLandscapeOrientation());
    };

    syncOrientation();

    const media = typeof window.matchMedia === 'function'
      ? window.matchMedia('(orientation: landscape)')
      : null;

    window.addEventListener('resize', syncOrientation);
    window.addEventListener('orientationchange', syncOrientation);
    if (media) {
      if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', syncOrientation);
      } else if (typeof media.addListener === 'function') {
        media.addListener(syncOrientation);
      }
    }

    return () => {
      window.removeEventListener('resize', syncOrientation);
      window.removeEventListener('orientationchange', syncOrientation);
      if (media) {
        if (typeof media.removeEventListener === 'function') {
          media.removeEventListener('change', syncOrientation);
        } else if (typeof media.removeListener === 'function') {
          media.removeListener(syncOrientation);
        }
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || isLandscape) return;
    releaseAll();
  }, [isLandscape, isOpen, releaseAll]);

  useEffect(() => {
    if (warningRafRef.current !== null) {
      window.cancelAnimationFrame(warningRafRef.current);
      warningRafRef.current = null;
    }
    if (!isOpen || isLandscape) {
      setWarningVisualState('hidden');
      return;
    }
    setWarningVisualState('entering');
    warningRafRef.current = window.requestAnimationFrame(() => {
      warningRafRef.current = null;
      setWarningVisualState('open');
    });
  }, [isLandscape, isOpen]);

  useEffect(() => {
    return () => releaseAll();
  }, [releaseAll]);

  const closeKeyboard = useCallback(() => {
    releaseAll();
    onClose();
  }, [onClose, releaseAll]);

  const dismissWarning = useCallback(() => {
    if (warningVisualState === 'closing-right') return;
    if (warningCloseTimerRef.current !== null) {
      window.clearTimeout(warningCloseTimerRef.current);
    }
    setWarningVisualState('closing-right');
    warningCloseTimerRef.current = window.setTimeout(() => {
      warningCloseTimerRef.current = null;
      closeKeyboard();
    }, WARNING_ANIMATION_MS);
  }, [closeKeyboard, warningVisualState]);

  const onWarningPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.pointerType !== 'touch') return;
    warningSwipeRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
  }, []);

  const onWarningPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (warningVisualState === 'closing-right') return;
    const swipe = warningSwipeRef.current;
    if (!swipe || event.pointerType !== 'touch' || swipe.pointerId !== event.pointerId) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    if (dx >= WARNING_SWIPE_CLOSE_THRESHOLD && dx > Math.abs(dy) + 12) {
      warningSwipeRef.current = null;
      triggerMobileHaptic('medium');
      dismissWarning();
    }
  }, [dismissWarning, warningVisualState]);

  const onWarningPointerEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    warningSwipeRef.current = null;
  }, []);

  const beginInputOnNote = useCallback((id: string, note: number) => {
    const applied = pressNote(note);
    if (applied) {
      inputToNoteRef.current.set(id, note);
    } else {
      inputToNoteRef.current.delete(id);
    }
  }, [pressNote]);

  const moveInputToNote = useCallback((id: string, clientX: number, clientY: number) => {
    const currentNote = inputToNoteRef.current.get(id);
    if (currentNote === undefined) return;
    const nextNote = resolveNoteFromPoint(clientX, clientY);
    if (nextNote === null) {
      inputToNoteRef.current.delete(id);
      releaseNote(currentNote);
      return;
    }
    if (currentNote !== nextNote) {
      const applied = pressNote(nextNote);
      if (applied) {
        inputToNoteRef.current.set(id, nextNote);
      } else {
        inputToNoteRef.current.delete(id);
      }
      releaseNote(currentNote);
    }
  }, [pressNote, releaseNote, resolveNoteFromPoint]);

  const onKeyPointerDown = useCallback((note: number, event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return;
    beginInputOnNote(pointerKey(event.pointerId), note);
  }, [beginInputOnNote, pointerKey]);

  const onKeyPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return;
    moveInputToNote(pointerKey(event.pointerId), event.clientX, event.clientY);
  }, [moveInputToNote, pointerKey]);

  const onKeyPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return;
    endInput(pointerKey(event.pointerId));
  }, [endInput, pointerKey]);

  useLayoutEffect(() => {
    if (!isOpen || !isLandscape) return;
    const node = keyboardSurfaceRef.current;
    if (!node) return;

    const onTouchStartNative = (event: TouchEvent) => {
      let consumed = false;
      const changed = event.changedTouches;
      for (let i = 0; i < changed.length; i += 1) {
        const touch = changed.item(i);
        if (!touch) continue;
        const note = resolveNoteFromPoint(touch.clientX, touch.clientY);
        if (note === null) continue;
        beginInputOnNote(touchKey(touch.identifier), note);
        consumed = true;
      }
      if (consumed && event.cancelable) {
        event.preventDefault();
      }
    };

    const onTouchMoveNative = (event: TouchEvent) => {
      let consumed = false;
      const changed = event.changedTouches;
      for (let i = 0; i < changed.length; i += 1) {
        const touch = changed.item(i);
        if (!touch) continue;
        const id = touchKey(touch.identifier);
        if (!inputToNoteRef.current.has(id)) continue;
        moveInputToNote(id, touch.clientX, touch.clientY);
        consumed = true;
      }
      if (consumed && event.cancelable) {
        // Prevent page-gesture stealing only while dragging active keyboard touches.
        event.preventDefault();
      }
    };

    const onTouchEndNative = (event: TouchEvent) => {
      const changed = event.changedTouches;
      for (let i = 0; i < changed.length; i += 1) {
        const touch = changed.item(i);
        if (!touch) continue;
        const id = touchKey(touch.identifier);
        if (!inputToNoteRef.current.has(id)) continue;
        endInput(id);
      }
    };

    const opts: AddEventListenerOptions = { passive: false };
    node.addEventListener('touchstart', onTouchStartNative, opts);
    window.addEventListener('touchmove', onTouchMoveNative, opts);
    window.addEventListener('touchend', onTouchEndNative, opts);
    window.addEventListener('touchcancel', onTouchEndNative, opts);

    return () => {
      node.removeEventListener('touchstart', onTouchStartNative);
      window.removeEventListener('touchmove', onTouchMoveNative);
      window.removeEventListener('touchend', onTouchEndNative);
      window.removeEventListener('touchcancel', onTouchEndNative);
    };
  }, [beginInputOnNote, endInput, isLandscape, isOpen, moveInputToNote, resolveNoteFromPoint, touchKey]);

  const renderTargetOptions = useCallback(() => (
    <>
      <option value="none" className="text-zinc-500 bg-black font-normal">
        {TEXTS.options.lfoTargets.none}
      </option>
      {TARGET_GROUPS.map(group => {
        const targets = LFO_TARGET_VALUES.filter(group.check);
        if (targets.length === 0) return null;
        return (
          <optgroup key={group.label} label={group.label} className="font-bold text-zinc-500 bg-zinc-900">
            {targets.map(target => (
              <option key={target} value={target} className="text-zinc-300 bg-black font-normal">
                {TEXTS.options.lfoTargets[target]}
              </option>
            ))}
          </optgroup>
        );
      })}
    </>
  ), []);

  const getOctaveLabel = useCallback((octave: number) => {
    return OCTAVE_FOOTAGE.find(opt => opt.value === octave)?.label ?? "8'";
  }, []);

  const shiftOctave = useCallback((oscId: 1 | 2, current: number, delta: -1 | 1) => {
    const min = OCTAVE_FOOTAGE[0].value;
    const max = OCTAVE_FOOTAGE[OCTAVE_FOOTAGE.length - 1].value;
    const next = Math.max(min, Math.min(max, current + delta));
    if (next === current) return;
    onOscOctaveChange(oscId, next);
  }, [onOscOctaveChange]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[170] bg-black/95 flex flex-col"
      style={{
        paddingTop: 'calc(10px + env(safe-area-inset-top))',
        paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
        paddingLeft: 'max(15px, env(safe-area-inset-left))',
        paddingRight: 'max(15px, env(safe-area-inset-right))'
      }}
      onPointerUp={(event) => {
        if (event.pointerType !== 'touch') {
          endInput(pointerKey(event.pointerId));
        }
      }}
      onPointerCancel={(event) => {
        if (event.pointerType !== 'touch') {
          endInput(pointerKey(event.pointerId));
        }
      }}
    >
      {isLandscape && (
      <>
      <div className="px-0 pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Close keyboard"
            onPointerDown={(e) => {
              if (e.pointerType === 'touch') triggerMobileHaptic('light');
            }}
            onClick={closeKeyboard}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-zinc-400 select-none touch-manipulation"
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

          <div className="min-w-0 flex-1 overflow-x-auto pl-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="flex min-w-max items-center justify-between gap-3 whitespace-nowrap">
              <div className="inline-flex items-center gap-1.5">
                <Label className="translate-y-0">OSC A</Label>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    if (e.pointerType === 'touch') triggerMobileHaptic('light');
                  }}
                  onClick={() => onOscModeChange(1, 'kbd')}
                  className={`px-2 _c-btn _t-btn border transition-colors ${osc1Mode === 'kbd' ? '_s-active' : '_s-inactive'}`}
                >
                  KBD
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    if (e.pointerType === 'touch') triggerMobileHaptic('light');
                  }}
                  onClick={() => onOscModeChange(1, 'drone')}
                  className={`px-2 _c-btn _t-btn border transition-colors ${osc1Mode === 'drone' ? '_s-active' : '_s-inactive'}`}
                >
                  DRONE
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    if (e.pointerType === 'touch') triggerMobileHaptic('light');
                  }}
                  onClick={() => onOscModeChange(1, 'off')}
                  className={`px-2 _c-btn _t-btn border transition-colors ${osc1Mode === 'off' ? '_s-active' : '_s-inactive'}`}
                >
                  OFF
                </button>
                <div className="inline-flex items-center gap-1.5">
                  <Label className="translate-y-0">OCT</Label>
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      if (e.pointerType === 'touch') triggerMobileHaptic('light');
                    }}
                    onClick={() => shiftOctave(1, osc1Octave, -1)}
                    className="px-2 _c-btn _t-btn border _s-inactive"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      if (e.pointerType === 'touch') triggerMobileHaptic('light');
                    }}
                    onClick={() => shiftOctave(1, osc1Octave, 1)}
                    className="px-2 _c-btn _t-btn border _s-inactive"
                  >
                    +
                  </button>
                  <Value className="translate-y-0">{getOctaveLabel(osc1Octave)}</Value>
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5">
                <Label className="translate-y-0">OSC B</Label>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    if (e.pointerType === 'touch') triggerMobileHaptic('light');
                  }}
                  onClick={() => onOscModeChange(2, 'kbd')}
                  className={`px-2 _c-btn _t-btn border transition-colors ${osc2Mode === 'kbd' ? '_s-active' : '_s-inactive'}`}
                >
                  KBD
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    if (e.pointerType === 'touch') triggerMobileHaptic('light');
                  }}
                  onClick={() => onOscModeChange(2, 'drone')}
                  className={`px-2 _c-btn _t-btn border transition-colors ${osc2Mode === 'drone' ? '_s-active' : '_s-inactive'}`}
                >
                  DRONE
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    if (e.pointerType === 'touch') triggerMobileHaptic('light');
                  }}
                  onClick={() => onOscModeChange(2, 'off')}
                  className={`px-2 _c-btn _t-btn border transition-colors ${osc2Mode === 'off' ? '_s-active' : '_s-inactive'}`}
                >
                  OFF
                </button>
                <div className="inline-flex items-center gap-1.5">
                  <Label className="translate-y-0">OCT</Label>
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      if (e.pointerType === 'touch') triggerMobileHaptic('light');
                    }}
                    onClick={() => shiftOctave(2, osc2Octave, -1)}
                    className="px-2 _c-btn _t-btn border _s-inactive"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      if (e.pointerType === 'touch') triggerMobileHaptic('light');
                    }}
                    onClick={() => shiftOctave(2, osc2Octave, 1)}
                    className="px-2 _c-btn _t-btn border _s-inactive"
                  >
                    +
                  </button>
                  <Value className="translate-y-0">{getOctaveLabel(osc2Octave)}</Value>
                </div>
              </div>
            </div>
          </div>

          <div className="inline-flex shrink-0 items-center gap-1.5 pl-2">
            <button
              type="button"
              onPointerDown={(e) => {
                if (e.pointerType === 'touch') triggerMobileHaptic('light');
              }}
              onClick={() => onPolyphonicChange(false)}
              className={`px-2 _c-btn _t-btn border transition-colors ${polyphonic ? '_s-inactive' : '_s-active'}`}
            >
              MONO
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                if (e.pointerType === 'touch') triggerMobileHaptic('light');
              }}
              onClick={() => onPolyphonicChange(true)}
              className={`px-2 _c-btn _t-btn border transition-colors ${polyphonic ? '_s-active' : '_s-inactive'}`}
            >
              POLY
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                if (e.pointerType === 'touch') triggerMobileHaptic('light');
              }}
              onClick={() => {
                setHoldEnabled(prev => {
                  const next = !prev;
                  if (!next) {
                    releaseHeldNotes();
                  }
                  return next;
                });
              }}
              className={`px-2 _c-btn _t-btn border transition-colors ${holdEnabled ? '_s-active' : '_s-inactive'}`}
            >
              HOLD
            </button>
          </div>
        </div>
      </div>

      <div
        data-kbd-controls
        className="px-0 py-2"
        onPointerDown={(event) => event.stopPropagation()}
        onPointerMove={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
      >
        <div className="grid grid-cols-4 gap-2 w-full">
          {controlFaders.map((fader, index) => (
            <div key={index} className="min-w-0 p-2">
              <div className="flex items-center justify-between mb-1.5">
                <Label className="translate-y-0">F{index + 1}</Label>
                <Value className="translate-y-0">{Math.round(fader.value / 10.24)}%</Value>
              </div>
              <Fader
                value={fader.value}
                onChange={(value) => onControlValueChange(index, value)}
                className="mb-2"
              />
              <Select
                value={fader.target}
                onChange={(value) => onControlTargetChange(index, value as LfoTarget)}
                className=""
              >
                {renderTargetOptions()}
              </Select>
            </div>
          ))}
        </div>
      </div>

      <div
        className="flex-1 flex items-stretch justify-center px-0 py-0"
        style={{ paddingLeft: '7px', paddingRight: '7px' }}
      >
        <div
          ref={keyboardSurfaceRef}
          className="relative w-full max-w-[1200px] h-full min-h-[170px] border border-zinc-800 _b-widget overflow-hidden touch-none"
          onContextMenu={(event) => event.preventDefault()}
        >
          <div className="absolute inset-0 flex" style={{ backgroundColor: KEY_COLORS.bed }}>
            {WHITE_KEYS.map((note, idx) => {
              const isActive = activeNotes.has(note);
              return (
                <div
                  key={note}
                  data-kbd-note={note}
                  className={`relative flex-1 border-r border-zinc-700 ${idx === WHITE_KEYS.length - 1 ? '' : ''}`}
                  style={{ backgroundColor: isActive ? KEY_COLORS.whiteActive : KEY_COLORS.whiteIdle }}
                  onPointerDown={(event) => onKeyPointerDown(note, event)}
                  onPointerMove={onKeyPointerMove}
                  onPointerUp={onKeyPointerUp}
                  onPointerCancel={onKeyPointerUp}
                />
              );
            })}
          </div>

          {BLACK_KEYS.map(({ note, afterWhiteIndex }) => {
            const isActive = activeNotes.has(note);
            const left = `calc((100% / ${WHITE_KEYS.length}) * ${afterWhiteIndex + 1} - ((100% / ${WHITE_KEYS.length}) * 0.32))`;
            const width = `calc((100% / ${WHITE_KEYS.length}) * 0.64)`;
            return (
              <div
                key={note}
                data-kbd-note={note}
                className="absolute top-0 border border-zinc-700"
                style={{
                  left,
                  width,
                  height: `${BLACK_KEY_HEIGHT_RATIO * 100}%`,
                  backgroundColor: isActive ? KEY_COLORS.blackActive : KEY_COLORS.blackIdle
                }}
                onPointerDown={(event) => onKeyPointerDown(note, event)}
                onPointerMove={onKeyPointerMove}
                onPointerUp={onKeyPointerUp}
                onPointerCancel={onKeyPointerUp}
              />
            );
          })}
        </div>
      </div>
      </>
      )}

      {!isLandscape && (
        <div
          className={`absolute inset-0 z-[190] flex items-center justify-center px-5 transition-all duration-200 ${
            warningVisualState === 'closing-right'
              ? 'opacity-0 translate-x-10'
              : warningVisualState === 'open'
                ? 'opacity-100 translate-x-0'
                : 'opacity-0 translate-x-12'
          }`}
          style={{ backgroundColor: 'var(--color-bg)' }}
          onPointerDown={onWarningPointerDown}
          onPointerMove={onWarningPointerMove}
          onPointerUp={onWarningPointerEnd}
          onPointerCancel={onWarningPointerEnd}
        >
          <div className={`w-full max-w-[360px] px-5 py-6 text-center transition-all duration-200 ${
            warningVisualState === 'closing-right'
              ? 'opacity-0 translate-x-8 scale-95'
              : warningVisualState === 'open'
                ? 'opacity-100 translate-x-0 scale-100'
                : 'opacity-0 translate-x-10 scale-95'
          }`}>
            <div className="_t-panel-title mb-3">ROTATE DEVICE</div>
            <div className="_t-sub-sect leading-5 mb-6">
              TURN YOUR PHONE 90 DEGREES TO USE KEYBOARD
            </div>
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                if (e.pointerType === 'touch') triggerMobileHaptic('light');
              }}
              onClick={(e) => {
                e.stopPropagation();
                dismissWarning();
              }}
              className="w-full _c-btn-init _t-init-btn _s-inactive _b-panel border"
            >
              {'< BACK'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileKeyboardOverlay;
