import React, { useRef, useEffect, useState, useCallback } from 'react';
import { AudioGraphNodes, DelayDivision, SynthState, TriggerTarget } from '../types';
import { mapPortamento, mapSeqRate, calculateDelayTime, getSeqOutputValue, getModSeqValue } from '../utils/audioMath';

// Scheduler timing window for step sequencing.
const LOOKAHEAD = 0.05;
const SCHEDULE_AHEAD = 0.01;
// Lower bound for step period (seconds per step) so extreme modulation cannot collapse scheduler.
const MIN_SPS = 0.02;

export const useSequencerSystem = (
    ctxRef: React.RefObject<AudioContext | null>,
    nodes: React.RefObject<AudioGraphNodes | null>,
    params: SynthState,
    isStarted: boolean,
    triggerPolyVoice: (idx: number, freq: number | null, mode: 'attack' | 'legato' | 'release', target: TriggerTarget, when?: number) => void
) => {
    // Step indicators for UI.
    const [currentStep1, setCurrentStep1] = useState(0);
    const [currentStep2, setCurrentStep2] = useState(0);
    const [currentStepMod1, setCurrentStepMod1] = useState(0);
    const [currentStepMod2, setCurrentStepMod2] = useState(0);

    // Runtime clocks and indexes.
    const nextNoteTime1 = useRef(0);
    const stepIndex1 = useRef(0);
    const nextNoteTime2 = useRef(0);
    const stepIndex2 = useRef(0);
    const nextNoteTimeMod1 = useRef(0);
    const stepIndexMod1 = useRef(0);
    const nextNoteTimeMod2 = useRef(0);
    const stepIndexMod2 = useRef(0);
    
    // Last computed step rates, used to detect hard tempo jumps.
    const lastSps1 = useRef<number | null>(null);
    const lastSps2 = useRef<number | null>(null);
    const lastMSps1 = useRef<number | null>(null);
    const lastMSps2 = useRef<number | null>(null);
    
    // Scheduler control and latest params snapshot.
    const timerID = useRef<number | null>(null);
    const paramsRef = useRef(params);
    paramsRef.current = params;

    // Running-edge flags for start/stop transitions.
    const wasRunning1 = useRef(false);
    const wasRunning2 = useRef(false);
    const wasRunningMod1 = useRef(false);
    const modSampleBuffer = useRef(new Float32Array(1));

    // Keep UI step updates stable during tight schedule loops.
    const displayStep1 = useRef(0);
    const displayStep2 = useRef(0);
    const displayStepMod1 = useRef(0);
    const displayStepMod2 = useRef(0);

    // Cleanup scheduler timer on unmount.
    useEffect(() => {
        return () => {
            if (timerID.current !== null) {
                clearTimeout(timerID.current);
                timerID.current = null;
            }
        };
    }, []);

    // Main scheduler: keeps audio params and gate triggers ahead of current audio time.
    useEffect(() => {
        if (!isStarted || !ctxRef.current) return;

        const scheduler = () => {
            if (!ctxRef.current || !nodes.current) {
                timerID.current = null;
                return;
            }

            const p = paramsRef.current;
            const n = nodes.current;
            const ctx = ctxRef.current;
            const now = ctx.currentTime;

            // Handle run-state transitions for voice sequencers.
            if (p.seq1.isRunning && !wasRunning1.current) nextNoteTime1.current = now + SCHEDULE_AHEAD;
            if (!p.seq1.isRunning) lastSps1.current = null;
            wasRunning1.current = p.seq1.isRunning;

            if (p.seq2.isRunning && !wasRunning2.current) nextNoteTime2.current = now + SCHEDULE_AHEAD;
            if (!p.seq2.isRunning) lastSps2.current = null;
            wasRunning2.current = p.seq2.isRunning;

            // Handle run-state transitions for modulation sequencers.
            if (p.modSeq1.isRunning && !wasRunningMod1.current) {
                const t = now + SCHEDULE_AHEAD;
                nextNoteTimeMod1.current = t;
                nextNoteTimeMod2.current = t;
                const stepIdx1 = stepIndexMod1.current;
                const stepIdx2 = stepIndexMod2.current;
                n.modSeq1Source.offset.cancelScheduledValues(t);
                n.modSeq1Source.offset.setTargetAtTime(getModSeqValue(p.modSeq1.steps[stepIdx1]), t, 0.005);
                n.modSeq2Source.offset.cancelScheduledValues(t);
                n.modSeq2Source.offset.setTargetAtTime(getModSeqValue(p.modSeq2.steps[stepIdx2]), t, 0.005);
            }
            if (!p.modSeq1.isRunning && wasRunningMod1.current) {
                n.modSeq1Source.offset.cancelScheduledValues(now);
                n.modSeq1Source.offset.setValueAtTime(0, now);
                n.modSeq2Source.offset.cancelScheduledValues(now);
                n.modSeq2Source.offset.setValueAtTime(0, now);
                lastMSps1.current = null;
                lastMSps2.current = null;
            }
            wasRunningMod1.current = p.modSeq1.isRunning;

            if (!p.seq1.isRunning && !p.seq2.isRunning && !p.modSeq1.isRunning) {
                timerID.current = null;
                return;
            }

            // Read rate modulation from analyser taps.
            const readMod = (analyser: AnalyserNode) => {
                analyser.getFloatTimeDomainData(modSampleBuffer.current);
                const val = modSampleBuffer.current[0];
                return Number.isFinite(val) ? val : 0;
            };

            const mod1Val = readMod(n.seq1RateAnalyser);
            const mod2Val = readMod(n.seq2RateAnalyser);
            const modM1Val = readMod(n.modSeq1RateAnalyser);
            const modM2Val = readMod(n.modSeq2RateAnalyser);

            // Compute step period and resync if tempo changed too abruptly.
            const calculateAndResyncSps = (
                isSynced: boolean, 
                syncSourceSps: number | null, 
                ratio: number, 
                mode: 'free' | 'sync', 
                bpm: number, 
                div: DelayDivision, 
                baseRate: number, 
                modValue: number,
                lastSpsRef: React.MutableRefObject<number | null>,
                nextTimeRef: React.MutableRefObject<number>,
                stepIdxRef: React.MutableRefObject<number>
            ) => {
                let sps = 0;
                if (isSynced && syncSourceSps !== null) {
                    sps = syncSourceSps / ratio;
                } else if (mode === 'sync') {
                    sps = calculateDelayTime(bpm, div);
                } else {
                    const hz = Math.max(0.125, mapSeqRate(Math.max(0, Math.min(1024, baseRate + (modValue * 100)))));
                    sps = 1 / hz;
                }
                
                // Hard clamp keeps scheduling stable even if input modulation spikes.
                sps = Math.max(MIN_SPS, Math.min(8.0, sps));

                if (lastSpsRef.current !== null) {
                    // Big tempo jump: reset phase so old schedule does not drift against new speed.
                    if (Math.abs(Math.log2(sps / lastSpsRef.current)) > 0.5) {
                        nextTimeRef.current = now + SCHEDULE_AHEAD;
                        stepIdxRef.current = 0;
                    }
                }
                lastSpsRef.current = sps;
                return sps;
            };

            // Voice sequencer rates.
            const sps1 = calculateAndResyncSps(false, null, 1, p.seq1.rateMode, p.seq1.bpm, p.seq1.rateDivision, p.seq1.rate, mod1Val, lastSps1, nextNoteTime1, stepIndex1);
            const sps2 = calculateAndResyncSps(p.seq2.isSynced, sps1, p.seq2.syncRatio, p.seq2.rateMode, p.seq2.bpm, p.seq2.rateDivision, p.seq2.rate, mod2Val, lastSps2, nextNoteTime2, stepIndex2);

            // Small helper for smooth param scheduling.
            const scheduleParam = (param: AudioParam, val: number, time: number, slew: number) => {
                param.cancelScheduledValues(time);
                param.setTargetAtTime(val, time, slew);
            };

            // Schedule seq1 steps and optional gates.
            if (p.seq1.isRunning) {
                if (nextNoteTime1.current < now - 0.2) nextNoteTime1.current = now + SCHEDULE_AHEAD;
                const slew = Math.max(0.001, p.seq1.target.includes('freq') ? mapPortamento(p.osc1.portamento) : 0.002);
                let guard = 0;
                // Guard prevents runaway loop when timing state is corrupted.
                while (nextNoteTime1.current < now + LOOKAHEAD && guard < 16) {
                    const t = nextNoteTime1.current;
                    const stepIdx = stepIndex1.current;
                    const stepVal = p.seq1.steps[stepIdx];
                    
                    scheduleParam(n.seq1Source.offset, getSeqOutputValue(stepVal, p.seq1.target), t, slew);
                    
                    if (p.seq1.gates[stepIdx]) {
                        triggerPolyVoice(0, null, 'attack', 'osc1', t);
                        const gateLen = Math.min(sps1 * 0.5, 0.2);
                        triggerPolyVoice(0, null, 'release', 'osc1', t + gateLen);
                    }
                    
                    if (stepIdx !== displayStep1.current) { displayStep1.current = stepIdx; setCurrentStep1(stepIdx); }
                    nextNoteTime1.current += sps1;
                    stepIndex1.current = getNextStep(stepIdx, p.seq1.direction);
                    guard++;
                }
            }

            // Schedule seq2 steps and optional gates.
            if (p.seq2.isRunning) {
                if (nextNoteTime2.current < now - 0.2) nextNoteTime2.current = now + SCHEDULE_AHEAD;
                const slew = Math.max(0.001, p.seq2.target.includes('freq') ? mapPortamento(p.osc2.portamento) : 0.002);
                let guard = 0;
                // Guard prevents runaway loop when timing state is corrupted.
                while (nextNoteTime2.current < now + LOOKAHEAD && guard < 16) {
                    const t = nextNoteTime2.current;
                    const stepIdx = stepIndex2.current;
                    const stepVal = p.seq2.steps[stepIdx];
                    
                    scheduleParam(n.seq2Source.offset, getSeqOutputValue(stepVal, p.seq2.target), t, slew);
                    
                    if (p.seq2.gates[stepIdx]) {
                        triggerPolyVoice(0, null, 'attack', 'osc2', t);
                        const gateLen = Math.min(sps2 * 0.5, 0.2);
                        triggerPolyVoice(0, null, 'release', 'osc2', t + gateLen);
                    }
                    
                    if (stepIdx !== displayStep2.current) { displayStep2.current = stepIdx; setCurrentStep2(stepIdx); }
                    nextNoteTime2.current += sps2;
                    stepIndex2.current = getNextStep(stepIdx, p.seq2.direction);
                    guard++;
                }
            }

            // Schedule modulation sequencers.
            if (p.modSeq1.isRunning) {
                const mSps1 = calculateAndResyncSps(p.modSeq1.isSynced, sps1, p.modSeq1.syncRatio, p.modSeq1.rateMode, p.modSeq1.bpm, p.modSeq1.rateDivision, p.modSeq1.rate, modM1Val, lastMSps1, nextNoteTimeMod1, stepIndexMod1);
                const mSps2 = calculateAndResyncSps(p.modSeq2.isSynced, mSps1, p.modSeq2.syncRatio, p.modSeq2.rateMode, p.modSeq2.bpm, p.modSeq2.rateDivision, p.modSeq2.rate, modM2Val, lastMSps2, nextNoteTimeMod2, stepIndexMod2);

                if (nextNoteTimeMod1.current < now - 0.2) nextNoteTimeMod1.current = now + SCHEDULE_AHEAD;
                if (nextNoteTimeMod2.current < now - 0.2) nextNoteTimeMod2.current = now + SCHEDULE_AHEAD;

                let guard1 = 0;
                // Guard prevents runaway loop when timing state is corrupted.
                while (nextNoteTimeMod1.current < now + LOOKAHEAD && guard1 < 16) {
                    const t = nextNoteTimeMod1.current;
                    const stepIdx = stepIndexMod1.current;
                    scheduleParam(n.modSeq1Source.offset, getModSeqValue(p.modSeq1.steps[stepIdx]), t, 0.005);
                    if (stepIdx !== displayStepMod1.current) { displayStepMod1.current = stepIdx; setCurrentStepMod1(stepIdx); }
                    nextNoteTimeMod1.current += mSps1;
                    stepIndexMod1.current = getNextStep(stepIdx, p.modSeq1.direction);
                    guard1++;
                }

                let guard2 = 0;
                // Guard prevents runaway loop when timing state is corrupted.
                while (nextNoteTimeMod2.current < now + LOOKAHEAD && guard2 < 16) {
                    const t = nextNoteTimeMod2.current;
                    const stepIdx = stepIndexMod2.current;
                    scheduleParam(n.modSeq2Source.offset, getModSeqValue(p.modSeq2.steps[stepIdx]), t, 0.005);
                    if (stepIdx !== displayStepMod2.current) { displayStepMod2.current = stepIdx; setCurrentStepMod2(stepIdx); }
                    nextNoteTimeMod2.current += mSps2;
                    stepIndexMod2.current = getNextStep(stepIdx, p.modSeq2.direction);
                    guard2++;
                }
            }
            timerID.current = window.setTimeout(scheduler, 25);
        };

        // Start scheduler only when at least one sequencer is running.
        if (timerID.current === null && (params.seq1.isRunning || params.seq2.isRunning || params.modSeq1.isRunning)) scheduler();
    }, [isStarted, ctxRef, nodes, triggerPolyVoice, params.seq1.isRunning, params.seq2.isRunning, params.modSeq1.isRunning]); 

    // Shared step-direction helper.
    const getNextStep = (current: number, direction: 'fwd' | 'rev' | 'rnd') => {
        if (direction === 'rev') return (current - 1 + 8) % 8;
        if (direction === 'rnd') return Math.floor(Math.random() * 8);
        return (current + 1) % 8;
    };

    // Manual controls for voice sequencers.
    const manualSeqStep = useCallback((id: 1 | 2) => {
        if (id === 1) { stepIndex1.current = (stepIndex1.current + 1) % 8; setCurrentStep1(stepIndex1.current); }
        else { stepIndex2.current = (stepIndex2.current + 1) % 8; setCurrentStep2(stepIndex2.current); }
    }, []);
    
    const syncSequencers = useCallback(() => {
        stepIndex1.current = 0; stepIndex2.current = 0; setCurrentStep1(0); setCurrentStep2(0);
        if (ctxRef.current) { const t = ctxRef.current.currentTime + 0.05; nextNoteTime1.current = t; nextNoteTime2.current = t; }
    }, [ctxRef]);
    
    const resetSequencer = useCallback((id: 1 | 2) => {
        if (id === 1) { stepIndex1.current = 0; setCurrentStep1(0); }
        else { stepIndex2.current = 0; setCurrentStep2(0); }
    }, []);
    
    // Manual controls for modulation sequencers.
    const manualModSeqStep = useCallback((id: 1 | 2) => {
        if (id === 1) { stepIndexMod1.current = (stepIndexMod1.current + 1) % 8; setCurrentStepMod1(stepIndexMod1.current); }
        else { stepIndexMod2.current = (stepIndexMod2.current + 1) % 8; setCurrentStepMod2(stepIndexMod2.current); }
    }, []);
    
    const resetModSequencer = useCallback((id: 1 | 2) => {
        if (id === 1) { stepIndexMod1.current = 0; setCurrentStepMod1(0); }
        else { stepIndexMod2.current = 0; setCurrentStepMod2(0); }
    }, []);
    
    // Sync both modulation and voice sequencers to a shared downbeat.
    const syncModToMaster = useCallback(() => {
        stepIndexMod1.current = 0; stepIndexMod2.current = 0; setCurrentStepMod1(0); setCurrentStepMod2(0);
        stepIndex1.current = 0; stepIndex2.current = 0; setCurrentStep1(0); setCurrentStep2(0);
        if (ctxRef.current) {
          const t = ctxRef.current.currentTime + 0.05;
          nextNoteTimeMod1.current = t; nextNoteTimeMod2.current = t;
          nextNoteTime1.current = t; nextNoteTime2.current = t;
        }
    }, [ctxRef]);
    
    // Sync only modulation sequencers.
    const syncModSequencers = useCallback(() => {
        stepIndexMod1.current = 0; stepIndexMod2.current = 0; setCurrentStepMod1(0); setCurrentStepMod2(0);
        if (ctxRef.current) { const t = ctxRef.current.currentTime + 0.05; nextNoteTimeMod1.current = t; nextNoteTimeMod2.current = t; }
    }, [ctxRef]);

    return { currentStep1, currentStep2, currentStepMod1, currentStepMod2, manualSeqStep, syncSequencers, resetSequencer, manualModSeqStep, resetModSequencer, syncModToMaster, syncModSequencers };
};


