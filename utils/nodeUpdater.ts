
import React from 'react';
import { AudioGraphNodes, SynthState, LfoTarget, VoiceNodes } from '../types';
import {
    mapFreq, mapPortamento, mapCutoff, mapResonance,
    mapLfoRate, mapLfoDepth, mapPan, mapVol, mapChanGain,
    mapFmDeviation, mapFineTuneToCents,
    mapCrossModAmount, mapNoiseFmDepth, mapDelayTime, calculateDelayTime,
    getModulationScale,
    PARAM_MAX_INV
} from './audioMath';
import { AnalogTolerances } from './audioMath';
import { DELAY_FEEDBACK_MAX } from './graph-builders/constants';
import { getParameterRange } from './audio-math/parameterRanges';
import { warnOnceInDev } from './devDiagnostics';
import {
    buildActiveTargetSet,
    buildModulatorMap,
    cleanupSettlingTargets,
    connectModulatorTarget,
    extractBaseTarget,
    stripTargetSuffix
} from './nodeUpdaterHelpers';

const DELAY_TIME_SLEW = 0.02;

/**
 * Main Audio Update Loop.
 * Now supports ParamCache to avoid redundant API calls.
 */
// Settling targets map: tracks recently disconnected targets with timestamps (grace period)
const settlingTargetsMap = new Map<LfoTarget, number>();
const SETTLING_GRACE_PERIOD_MS = 200; // 200ms grace period after disconnection (conservative for BiquadFilter stability)

// NOTE: updateAudioNodes is state-driven (no continuous render loop). Any reconnection logic
// must complete within a single call, otherwise it can "stall" until the user changes a knob.
const RECONNECTION_DELAY_MS = 100; // Hold gain at 0 briefly before ramping back up (prevents target-switch spikes)
const RECONNECTION_DELAY_S = RECONNECTION_DELAY_MS / 1000;

const pwmKnobToWorklet = (value: number): number => {
    const safe = Math.max(0, Math.min(1024, value));
    // One-sided pulse width: 0 => 50%, 1 => 0%
    return safe * PARAM_MAX_INV;
};

const waveToWorklet = (wave: OscillatorType): number => {
    switch (wave) {
        case 'sawtooth': return 0;
        case 'square': return 1;
        case 'triangle': return 2;
        case 'sine':
        default:
            return 3;
    }
};

export const updateAudioNodes = (
    ctx: AudioContext,
    n: AudioGraphNodes,
    params: SynthState,
    tolerances: AnalogTolerances,
    interactionMode: 'smooth' | 'instant',
    controlSource: 'ui' | 'midi',
    activeMidiNotes: number[],
    activeTargetsRef: React.RefObject<Record<string, string>>,
    paramCacheRef?: React.MutableRefObject<WeakMap<AudioParam, number>>
) => {
    const t = ctx.currentTime;
    const ramp = interactionMode === 'instant' ? 0.005 : 0.02;
    const p = params;
    const tol = tolerances;
    const paramSlew = (controlSource === 'midi') ? 0.06 : 0.01; 

    // Keep automation continuity on dense updates (pads/macro sweeps).
    // `cancelAndHoldAtTime` preserves the effective current value and prevents zipper steps.
    const cancelAndHold = (param: AudioParam, time: number) => {
        const withHold = param as AudioParam & { cancelAndHoldAtTime?: (t: number) => void };
        if (typeof withHold.cancelAndHoldAtTime === 'function') {
            withHold.cancelAndHoldAtTime(time);
            return;
        }

        // Fallback for engines without cancelAndHoldAtTime.
        param.cancelScheduledValues(time);
        param.setValueAtTime(param.value, time);
    };

    // --- DIFFERENTIAL UPDATE HELPER ---
    // If paramCacheRef is provided, it checks if value changed before hitting API.
    const setP = (param: AudioParam | undefined, val: number, time: number, timeConst: number) => {
        if (!param || !Number.isFinite(val) || !Number.isFinite(timeConst)) return;
        const boundedVal = Math.min(param.maxValue, Math.max(param.minValue, val));

        // Dirty Check
        if (paramCacheRef) {
            const lastVal = paramCacheRef.current.get(param);
            // Tolerance epsilon to prevent tiny floating point drift updates
            if (lastVal !== undefined && Math.abs(lastVal - boundedVal) < 0.00001) {
                return;
            }
            paramCacheRef.current.set(param, boundedVal);
        }

        // CRITICAL FIX: Increase minimum ramp time to prevent BiquadFilter instability
        // "BiquadFilterNode: state is bad, probably due to unstable filter caused by fast parameter automation"
        // Use 0.08s minimum (80ms) instead of 0.001s to give filters time to stabilize
        // Combined with 200ms settling grace period for maximum stability during target switching
        const safeTimeConst = Math.max(0.08, timeConst);

        try {
          cancelAndHold(param, time);
          param.setTargetAtTime(boundedVal, time, safeTimeConst);
        } catch (e) {
            warnOnceInDev('[nodeUpdater] AudioParam scheduling failed in setP', e);
        }
    };

    // Discrete parameters (waveform selectors) must not be smoothed with setTargetAtTime.
    // Smoothing causes intermediate waveform ids and audible wrong-shape transitions.
    const setDiscreteP = (param: AudioParam | undefined, val: number, time: number) => {
        if (!param || !Number.isFinite(val)) return;
        const boundedVal = Math.min(param.maxValue, Math.max(param.minValue, val));
        const snappedVal = Math.round(boundedVal);

        if (paramCacheRef) {
            const lastVal = paramCacheRef.current.get(param);
            if (lastVal !== undefined && lastVal === snappedVal) {
                return;
            }
            paramCacheRef.current.set(param, snappedVal);
        }

        try {
            param.cancelScheduledValues(time);
            param.setValueAtTime(snappedVal, time);
        } catch (e) {
            warnOnceInDev('[nodeUpdater] AudioParam scheduling failed in setDiscreteP', e);
        }
    };

    const setVoices = (callback: (v: VoiceNodes, i: number) => void) => {
      n.voices.forEach(callback);
    };

    // --- OPTIMIZATION: Batch cleanup expired settling targets once per update cycle ---
    // Previously: checked and deleted on-demand during each protect() call (34x per update)
    // Now: single cleanup pass at start of update (reduces Date.now() calls and Map operations)
    const now = Date.now();
    cleanupSettlingTargets(settlingTargetsMap, now, SETTLING_GRACE_PERIOD_MS);

    // --- OPTIMIZATION: Build active targets Set once per update cycle for O(1) lookup ---
    // Previously: isTargetCurrentlyRouted used Object.values().some() = O(n) scan (34x per update)
    // Now: Build Set once, then O(1) has() check
    const activeTargetSet = buildActiveTargetSet(activeTargetsRef.current);

    // --- OPTIMIZATION: Build modulator lookup map once per update cycle ---
    // This reduces 8 checks per target to a single Map lookup
    // PHASE 2 OPTIMIZATION: Added scale caching to eliminate duplicate getModulationScale calls
    const modulatorMap = buildModulatorMap(p);

    /**
     * OPTIMIZED: Calculates required depth and adjusted base value to prevent clipping/silence.
     * Uses pre-built modulator map instead of checking all modulators every time.
     * PHASE 2: Now uses pre-computed scale from modulatorMap.
     */
    const getReflectiveParams = (target: LfoTarget, baseVal: number, min: number, max: number) => {
        const modDepth = modulatorMap.get(target);
        if (!modDepth) return { base: baseVal, depth: 0 };

        const scale = modDepth.scale; // PHASE 2: Use pre-computed scale
        const bipolarDepth = modDepth.bipolar * scale;
        const unipolarDepth = modDepth.unipolar * scale;
        const totalDepth = bipolarDepth + unipolarDepth;

        if (totalDepth === 0) return { base: baseVal, depth: 0 };

        const totalRange = max - min;
        const safeDepth = Math.min(totalDepth, totalRange / 2);
        const adjustedBase = Math.max(min + safeDepth, Math.min(max - safeDepth, baseVal));

        return { base: adjustedBase, depth: safeDepth };
    };

    /**
     * UNIVERSAL PROTECTION: Build safe depth map for ALL modulatable parameters.
     * This prevents modulation from pushing ANY parameter outside its physical limits.
     */
    const safeDepthMap = new Map<LfoTarget, number>();

    // Calculate safe depths for all parameters that have modulation
    modulatorMap.forEach((_, target) => {
        const range = getParameterRange(target);
        const result = getReflectiveParams(target, 0, range.min, range.max); // baseVal doesn't matter for depth calc
        safeDepthMap.set(target, result.depth);
    });

    /**
     * Check if a target is currently routed (was modulated in previous frame).
     * This prevents base value changes while modulation is still connected.
     * Note: Uses pre-built activeTargetSet for O(1) lookup (see optimization above).
     */
    const isTargetCurrentlyRouted = (target: LfoTarget): boolean => {
        return activeTargetSet.has(target); // O(1) Set lookup instead of O(n) array scan
    };

    /**
     * Check if a target is in "settling" grace period after disconnection.
     * Returns true if target was recently disconnected and should remain protected.
     * Note: Expired entries are now cleaned up once at the start of updateAudioNodes (see batch cleanup above).
     */
    const isTargetSettling = (target: LfoTarget): boolean => {
        return settlingTargetsMap.has(target); // Simple O(1) check - cleanup already done
    };

    /**
     * UNIVERSAL PROTECTION: Automatically applies reflective params using parameter range registry.
     * This ensures ALL modulatable parameters stay within safe bounds regardless of modulation depth.
     * CRITICAL: Also protects targets that are:
     * 1. Currently being modulated (modulatorMap)
     * 2. Were modulated last frame (activeTargetsRef)
     * 3. Recently disconnected and in grace period (settlingTargetsMap)
     *
     * EXCEPTION: Filter cutoff/HP-cutoff parameters are routed to `detune` (cents offset), not `frequency` (Hz).
     * Units mismatch: modulation is in cents, base value is in Hz → skip protection for these targets.
     */
    const protect = (target: LfoTarget, baseVal: number): number => {
        // Skip protection for filter parameters modulated via detune (cents offset)
        // These targets: osc1/2-cutoff, osc1/2-hp-cutoff, noise-cutoff
        // Modulation routes to filt.detune (cents), base sets filt.frequency (Hz) → units don't match
        const isDetuneTarget = target.includes('-cutoff') || target.includes('-hp-cutoff');
        if (isDetuneTarget) return baseVal;

        // If an effect is bypassed, keep its base values literal (no reflective offset).
        // This prevents mix/level params from being lifted above zero by active modulators.
        const isBypassedFxTarget =
            (target.startsWith('fuzz-') && !p.global.fuzzEnabled) ||
            (target.startsWith('delay-') && !p.global.delayEnabled) ||
            (target.startsWith('reverb-') && !p.global.springReverbEnabled) ||
            (target.startsWith('bitcrusher-') && !p.global.bitcrusherEnabled);
        if (isBypassedFxTarget) return baseVal;

        const range = getParameterRange(target);
        // Three-layer protection: current modulation, previous routing, settling grace period
        const needsProtection = modulatorMap.has(target) ||
                                 isTargetCurrentlyRouted(target) ||
                                 isTargetSettling(target);
        if (!needsProtection) return baseVal; // No modulation, return raw value
        const result = getReflectiveParams(target, baseVal, range.min, range.max);
        return result.base;
    };

    // --- CROSSFADE SYSTEM: Smooth target switching without crashes or artifacts ---
    // Problem: LFO oscillates at extreme values (±12000 for filters) during target switch
    // Solution: Scheduled crossfade - fade down → switch (safe, gain=0) → fade up
    // User accepts 250ms delay for crash-free switching
    const CROSSFADE_DOWN_TIME = 0.08; // 80ms exponential fade to zero
    const CROSSFADE_UP_TIME = 0.15; // 150ms exponential fade to final depth (used in routeModulator)

    const scheduleCrossfades = () => {
        // --- OPTIMIZATION: Early exit if no target changes detected ---
        // Prevents 16+ checks and voice iteration when targets are stable (most of the time)
        // CRITICAL FIX: Compare base targets without effect state suffixes
        let hasGlobalChanges = false;
        if (stripTargetSuffix(activeTargetsRef.current['lfo1']) !== p.lfo1.target) hasGlobalChanges = true;
        if (stripTargetSuffix(activeTargetsRef.current['lfo2']) !== p.lfo2.target) hasGlobalChanges = true;
        if (stripTargetSuffix(activeTargetsRef.current['modSeq1']) !== p.modSeq1.target) hasGlobalChanges = true;
        if (stripTargetSuffix(activeTargetsRef.current['modSeq2']) !== p.modSeq2.target) hasGlobalChanges = true;

        // Check voice targets only if no global changes (avoid voice iteration if possible)
        // CRITICAL FIX: Compare base targets without effect state suffixes
        if (!hasGlobalChanges) {
            let hasVoiceChanges = false;
            for (let i = 0; i < n.voices.length; i++) {
                if (stripTargetSuffix(activeTargetsRef.current[`mEnv1_v${i}`]) !== p.modEnv1.target ||
                    stripTargetSuffix(activeTargetsRef.current[`mEnv2_v${i}`]) !== p.modEnv2.target) {
                    hasVoiceChanges = true;
                    break; // Early exit from voice check
                }
            }
            if (!hasVoiceChanges) return; // No changes at all - skip entire crossfade logic
        }

        const now = ctx.currentTime;

        // Helper to schedule smooth exponential fade to zero for changing targets
        const fadeToZero = (param: AudioParam) => {
            param.cancelScheduledValues(now);
            param.setValueAtTime(param.value, now); // Anchor current value
            // Exponential ramp to near-zero (can't use exactly 0 with exponentialRampToValueAtTime)
            param.exponentialRampToValueAtTime(0.0001, now + CROSSFADE_DOWN_TIME);
            // Snap to exactly zero at end
            param.setValueAtTime(0, now + CROSSFADE_DOWN_TIME);
        };

        // Check LFO1 - CRITICAL FIX: Compare base targets without suffixes
        if (activeTargetsRef.current['lfo1'] && stripTargetSuffix(activeTargetsRef.current['lfo1']) !== p.lfo1.target) {
            fadeToZero(n.lfo1Gain.gain);
        }

        // Check LFO2 - CRITICAL FIX: Compare base targets without suffixes
        if (activeTargetsRef.current['lfo2'] && stripTargetSuffix(activeTargetsRef.current['lfo2']) !== p.lfo2.target) {
            fadeToZero(n.lfo2Gain.gain);
        }

        // Check Mod Seq 1 - CRITICAL FIX: Compare base targets without suffixes
        if (activeTargetsRef.current['modSeq1'] && stripTargetSuffix(activeTargetsRef.current['modSeq1']) !== p.modSeq1.target) {
            fadeToZero(n.modSeq1Gain.gain);
        }

        // Check Mod Seq 2 - CRITICAL FIX: Compare base targets without suffixes
        if (activeTargetsRef.current['modSeq2'] && stripTargetSuffix(activeTargetsRef.current['modSeq2']) !== p.modSeq2.target) {
            fadeToZero(n.modSeq2Gain.gain);
        }

        // Check Mod Envelopes (per voice) - CRITICAL FIX: Compare base targets without suffixes
        n.voices.forEach((v, i) => {
            if (activeTargetsRef.current[`mEnv1_v${i}`] && stripTargetSuffix(activeTargetsRef.current[`mEnv1_v${i}`]) !== p.modEnv1.target) {
                fadeToZero(v.modEnv1DepthNode.gain);
            }
            if (activeTargetsRef.current[`mEnv2_v${i}`] && stripTargetSuffix(activeTargetsRef.current[`mEnv2_v${i}`]) !== p.modEnv2.target) {
                fadeToZero(v.modEnv2DepthNode.gain);
            }
        });
    };

    scheduleCrossfades(); // Schedule fades BEFORE disconnect/reconnect

    // --- GLOBAL GAINS ---
    // Boosted Master Volume by 30% (max 1.3)
    setP(n.masterGain.gain, protect('master-vol', mapVol(p.global.masterVolume) * 1.3), t, ramp);
    setP(n.noiseGain.gain, mapChanGain(p.global.noiseLevel), t, ramp);
    
    // --- MASTER EQ GAINS ---
    // Map 0-1024 to +/- 12dB
    const mapEqGain = (v: number) => ((v - 512) / 512) * 12;
    if (n.masterEQ && p.global.eqGains) {
        p.global.eqGains.forEach((gainVal, i) => {
            if (n.masterEQ[i]) {
                setP(n.masterEQ[i].gain, mapEqGain(gainVal), t, ramp);
            }
        });
    }

    // --- DELAY PARAMETERS ---
    const targetDelayTime = p.global.delayMode === 'free' 
      ? mapDelayTime(p.global.delayTime)
      : calculateDelayTime(p.global.bpm, p.global.delayDivision);
    
    setP(n.delayTimeSource.offset, targetDelayTime, t, DELAY_TIME_SLEW);
    
    const baseFB = Math.min(p.global.delayFeedback / 1024, 1.0) * DELAY_FEEDBACK_MAX;
    setP(n.delayFB.gain, protect('delay-feedback', baseFB), t, ramp);

    const mixInput = p.global.delayEnabled ? (p.global.delayMix / 1024) : 0;
    setP(n.delayWet.gain, protect('delay-mix', Math.sqrt(mixInput)), t, ramp);
    setP(n.delayDry.gain, Math.sqrt(1 - mixInput), t, ramp);

    const pt2399Bandwidth = 10000 / (1 + targetDelayTime * 8);
    const clampedBandwidth = Math.max(1800, Math.min(10000, pt2399Bandwidth));
    setP(n.delayFilter.frequency, clampedBandwidth, t, 0.05);

    if (n.wowDepth) setP(n.wowDepth.gain, 0.0005 + targetDelayTime * 0.002, t, 0.1);
    if (n.flutterDepth) setP(n.flutterDepth.gain, 0.0001 + targetDelayTime * 0.0005, t, 0.1);
    if (n.clockNoiseGain) setP(n.clockNoiseGain.gain, 0.01 + targetDelayTime * 0.03, t, 0.1);

    // --- BITCRUSHER ---
    const bitcrusherEnabled = p.global.bitcrusherEnabled ?? false;
    const baseBitsKnob = 5 + (p.global.bitcrusherBits / 1024) * 3;
    const baseRateKnob = 0.005 * Math.pow(200, p.global.bitcrusherRate / 1024);

    // AudioWorklet params: set base values via AudioParams (modulators add on top).
    const baseBits = protect('bitcrusher-bits', baseBitsKnob);
    const baseRate = protect('bitcrusher-rate', baseRateKnob);
    const bitsParam = n.bitcrusher?.parameters?.get('bits');
    const freqParam = n.bitcrusher?.parameters?.get('normfreq');
    setP(bitsParam, baseBits, t, ramp);
    setP(freqParam, baseRate, t, ramp);

    // Keep meta in sync for any legacy/debug usage.
    if (n.bitcrusher && (n.bitcrusher as any).meta) {
        const meta = (n.bitcrusher as any).meta;
        meta.bits = baseBits;
        meta.normfreq = baseRate;
    }

    const bcMixInput = bitcrusherEnabled ? (p.global.bitcrusherMix / 1024) : 0;
    setP(n.bitcrusherDry.gain, Math.sqrt(1 - bcMixInput), t, ramp);
    setP(n.bitcrusherWet.gain, protect('bitcrusher-mix', Math.sqrt(bcMixInput)), t, ramp);

    // --- HARD-CLIP FUZZ ---
    const fuzzDriveNorm = p.global.fuzzDrive / 1024;
    // Drive as a single analog-style pre-gain control (audio taper).
    // 0%: near-clean, 100%: hard overdrive into square-like clipping.
    const driveTaper = Math.pow(fuzzDriveNorm, 2.2);
    const fuzzPreGain = 0.9 + driveTaper * 34.0; // ~0.9..34.9
    setP(n.fuzzInGain.gain, fuzzPreGain, t, ramp);

    // Internal stage gains are fixed architecture, not user-facing controls.
    setP(n.fuzzDrive1.gain, 1.0, t, ramp);
    setP(n.fuzzDrive2.gain, 1.35, t, ramp);
    setP(n.fuzzDrive3.gain, 1.0, t, ramp);

    const toneNorm = p.global.fuzzTone / 1024;
    // Analog-style tone pot behavior:
    // 0.0 -> mostly low-pass branch, 1.0 -> mostly high-pass branch.
    // Equal-power law keeps transition smooth and predictable.
    const bassBlend = Math.cos(toneNorm * Math.PI * 0.5);
    const trebleBlend = Math.sin(toneNorm * Math.PI * 0.5);
    setP(n.fuzzBassGain.gain, bassBlend, t, ramp);
    setP(n.fuzzTrebleGain.gain, trebleBlend, t, ramp);

    // Drive loudness compensation curve, calibrated so 0% and 100% drive
    // stay close in perceived level while timbre still changes.
    const fuzzOutputComp = 0.055 + 0.025 * driveTaper;
    setP(n.fuzzToneSum.gain, fuzzOutputComp, t, ramp);
    
    const fuzzMixRaw = p.global.fuzzMix / 1024;
    const fuzzEnabled = p.global.fuzzEnabled ?? false;
    const activeFuzzMix = fuzzEnabled ? fuzzMixRaw : 0;
    // Intuitive blend law:
    // 0% mix = full dry, 100% mix = full wet.
    // Modulation still acts on wet level param directly.
    setP(n.fuzzDry.gain, 1.0 - activeFuzzMix, t, ramp);
    setP(n.fuzzWet.gain, protect('fuzz-mix', activeFuzzMix), t, ramp);

    // --- SPRING REVERB ---
    const revMixRaw = p.global.springReverbMix / 1024;
    const revEnabled = p.global.springReverbEnabled ?? false;
    if (n.springReverbInputGate) {
        setP(n.springReverbInputGate.gain, revEnabled ? 1 : 0, t, 0.03);
    }
    const revMix = revEnabled ? revMixRaw : 0;
    const reverbBoost = 1.35;
    setP(n.springReverbDry.gain, Math.sqrt(1 - revMix), t, ramp);
    setP(n.springReverbWet.gain, protect('reverb-mix', Math.sqrt(revMix) * reverbBoost), t, ramp);
    
    const revToneDb = ((p.global.springReverbTone / 1024) * 24) - 12;
    setP(n.springReverbFilter.gain, revToneDb, t, ramp);

    if (n.springReverbInputDrive) {
        const driveAmount = 1.5 + revMix * 2.5; 
        setP(n.springReverbInputDrive.gain, driveAmount, t, 0.05);
    }

    // --- NOISE ---
    const noise = p.noise;
    setP(n.noiseFilter.frequency, protect('noise-cutoff', mapCutoff(noise.cutoff)), t, paramSlew);
    setP(n.noiseFilter.Q, protect('noise-res', mapResonance(noise.resonance)), t, paramSlew);
    setP(n.noiseSendAGain.gain, protect('noise-sendA', mapChanGain(noise.sendA)), t, paramSlew);
    setP(n.noiseSendBGain.gain, protect('noise-sendB', mapChanGain(noise.sendB)), t, paramSlew);
    setP(n.noiseFmSendAGain.gain, protect('noise-fmA', mapNoiseFmDepth(noise.fmSendA)), t, paramSlew);
    setP(n.noiseFmSendBGain.gain, protect('noise-fmB', mapNoiseFmDepth(noise.fmSendB)), t, paramSlew);
    setP(n.whiteNoiseGain.gain, noise.type === 'white' ? 1 : 0, t, ramp);
    setP(n.pinkNoiseGain.gain, noise.type === 'pink' ? 1 : 0, t, ramp);
    setP(n.brownNoiseGain.gain, noise.type === 'brown' ? 1 : 0, t, ramp);

    // --- PHASE 2 OPTIMIZATION: Pre-calculate voice parameters ONCE before voice loop ---
    // Previously: protect() called 6x per parameter (once per voice)
    // Now: Calculated once, reused across all voices (20-30% CPU reduction)
    const protected_osc1Gain = protect('osc1-gain', mapChanGain(p.osc1.gain));
    const protected_osc2Gain = protect('osc2-gain', mapChanGain(p.osc2.gain));
    const osc1PwmEnabled = p.osc1.wave === 'square';
    const osc2PwmEnabled = p.osc2.wave === 'square';
    const protected_osc1Pwm = osc1PwmEnabled
        ? protect('osc1-pwm', pwmKnobToWorklet(p.osc1.pwm))
        : 0;
    const protected_osc2Pwm = osc2PwmEnabled
        ? protect('osc2-pwm', pwmKnobToWorklet(p.osc2.pwm))
        : 0;
    const protected_osc1Cutoff = protect('osc1-cutoff', mapCutoff(p.osc1.cutoff));
    const protected_osc1Res = protect('osc1-res', mapResonance(p.osc1.resonance));
    const protected_osc1HpCutoff = protect('osc1-hp-cutoff', mapCutoff(p.osc1.hpCutoff));
    const protected_osc1HpRes = protect('osc1-hp-res', mapResonance(p.osc1.hpResonance));
    const protected_osc2Cutoff = protect('osc2-cutoff', mapCutoff(p.osc2.cutoff));
    const protected_osc2Res = protect('osc2-res', mapResonance(p.osc2.resonance));
    const protected_osc2HpCutoff = protect('osc2-hp-cutoff', mapCutoff(p.osc2.hpCutoff));
    const protected_osc2HpRes = protect('osc2-hp-res', mapResonance(p.osc2.hpResonance));
    const protected_osc1Freq = protect('osc1-freq', mapFreq(p.osc1.freq));
    const protected_osc2Freq = protect('osc2-freq', mapFreq(p.osc2.freq));

    // Pre-calculate detune values (same for all voices)
    const osc1DetuneVal = (p.osc1.octave * 1200) + mapFineTuneToCents(p.osc1.fineTune);
    const osc2DetuneVal = (p.osc2.octave * 1200) + mapFineTuneToCents(p.osc2.fineTune);
    const protected_osc1Fine = protect('osc1-fine', osc1DetuneVal);
    const protected_osc2Fine = protect('osc2-fine', osc2DetuneVal);

    // Pre-calculate ModEnv depth (cubic curve, same for all voices)
    // OPTIMIZATION: Avoid Math.pow in voice loop (30-40% CPU reduction)
    const modEnv1DepthNorm = p.modEnv1.depth * PARAM_MAX_INV;
    const protected_modEnv1Depth = modEnv1DepthNorm * modEnv1DepthNorm * modEnv1DepthNorm; // x³
    const modEnv2DepthNorm = p.modEnv2.depth * PARAM_MAX_INV;
    const protected_modEnv2Depth = modEnv2DepthNorm * modEnv2DepthNorm * modEnv2DepthNorm; // x³

    // Worklet waveform mapping for both oscillators.
    const osc1Waveform = waveToWorklet(p.osc1.wave);
    const osc2Waveform = waveToWorklet(p.osc2.wave);

    // --- PRE-COMPUTE CROSS-MOD VALUES (constant across voices) ---
    const m12 = p.oscMod.osc1to2; const amount12 = mapCrossModAmount(m12.amount);
    const m21 = p.oscMod.osc2to1; const amount21 = mapCrossModAmount(m21.amount);
    let o1D = 1, o1W = 0, f12 = 0, a12 = 0, o2D = 1, o2W = 0, f21 = 0, a21 = 0;
    if (m12.type === 'fm') f12 = amount12 * mapFmDeviation(m12.range);
    else { o2D = 0; o2W = m12.type === 'am' ? 0.5 : 0; a12 = amount12; }
    if (m21.type === 'fm') f21 = amount21 * mapFmDeviation(m21.range);
    else { o1D = 0; o1W = m21.type === 'am' ? 0.5 : 0; a21 = amount21; }
    const mod1Raw = m12.source === 'raw' ? 1 : 0; const mod1Flt = m12.source === 'filter' ? 1 : 0;
    const mod2Raw = m21.source === 'raw' ? 1 : 0; const mod2Flt = m21.source === 'filter' ? 1 : 0;
    const isDirect = noise.routing === 'direct';
    const noiseFilterVal = isDirect ? 0 : 1; const noiseDirectVal = isDirect ? 1 : 0;

    // --- PRE-COMPUTE GLIDE (constant across voices) ---
    const glide1 = (p.osc1.voltOct || p.osc1.midi || activeMidiNotes.length > 0 || p.seq1.isRunning) ? mapPortamento(p.osc1.portamento) : paramSlew;
    const glide2 = (p.osc2.voltOct || p.osc2.midi || activeMidiNotes.length > 0 || p.seq2.isRunning) ? mapPortamento(p.osc2.portamento) : paramSlew;

    // --- VOICES ---
    setVoices((v, i) => {
        const panOffset1 = tol.voice?.panOffset1?.[i] ?? 0;
        const panOffset2 = tol.voice?.panOffset2?.[i] ?? 0;
        setP(v.mixGain1.gain, protected_osc1Gain, t, paramSlew);
        setP(v.mixGain2.gain, protected_osc2Gain, t, paramSlew);
        setP(v.pan1.pan, protect('osc1-pan', mapPan(p.osc1.pan) + panOffset1), t, paramSlew);
        setP(v.pan2.pan, protect('osc2-pan', mapPan(p.osc2.pan) + panOffset2), t, paramSlew);

        // === OSC 1 PARAMETERS (WORKLET) ===
        setP(v.osc1.pulseWidth, protected_osc1Pwm, t, paramSlew);
        setDiscreteP(v.osc1.waveform, osc1Waveform, t);
        v.osc1.waveType = p.osc1.wave;

        setP(v.osc1.detune, protected_osc1Fine, t, paramSlew);
        if (p.seq1.isRunning) { setP(v.osc1.frequency, 261.63, t, glide1); }
        else if (!p.osc1.midi && !p.osc1.voltOct) { setP(v.osc1.frequency, protected_osc1Freq, t, glide1); }

        setP(v.filt1.frequency, protected_osc1Cutoff, t, paramSlew);
        setP(v.filt1.Q, protected_osc1Res, t, paramSlew);
        setP(v.hpFilt1.frequency, protected_osc1HpCutoff, t, paramSlew);
        setP(v.hpFilt1.Q, protected_osc1HpRes, t, paramSlew);

        // === OSC 2 PARAMETERS (WORKLET) ===
        setP(v.osc2.pulseWidth, protected_osc2Pwm, t, paramSlew);
        setDiscreteP(v.osc2.waveform, osc2Waveform, t);
        v.osc2.waveType = p.osc2.wave;

        setP(v.osc2.detune, protected_osc2Fine, t, paramSlew);
        if (p.seq2.isRunning) { setP(v.osc2.frequency, 261.63, t, glide2); }
        else if (!p.osc2.midi && !p.osc2.voltOct) { setP(v.osc2.frequency, protected_osc2Freq, t, glide2); }

        setP(v.filt2.frequency, protected_osc2Cutoff, t, paramSlew);
        setP(v.filt2.Q, protected_osc2Res, t, paramSlew);
        setP(v.hpFilt2.frequency, protected_osc2HpCutoff, t, paramSlew);
        setP(v.hpFilt2.Q, protected_osc2HpRes, t, paramSlew);

        // Cross-modulation (pre-computed values)
        setP(v.fmGain1to2.gain, f12, t, paramSlew); setP(v.osc2Dry.gain, o2D, t, paramSlew); setP(v.osc2Wet.gain, o2W, t, paramSlew); setP(v.amGain1to2.gain, a12, t, paramSlew);
        setP(v.fmGain2to1.gain, f21, t, paramSlew); setP(v.osc1Dry.gain, o1D, t, paramSlew); setP(v.osc1Wet.gain, o1W, t, paramSlew); setP(v.amGain2to1.gain, a21, t, paramSlew);
        setP(v.mod1RawGain.gain, mod1Raw, t, ramp); setP(v.mod1FltGain.gain, mod1Flt, t, ramp);
        setP(v.mod2RawGain.gain, mod2Raw, t, ramp); setP(v.mod2FltGain.gain, mod2Flt, t, ramp);

        setP(v.noiseFilterGainA.gain, noiseFilterVal, t, ramp); setP(v.noiseDirectGainA.gain, noiseDirectVal, t, ramp);
        setP(v.noiseFilterGainB.gain, noiseFilterVal, t, ramp); setP(v.noiseDirectGainB.gain, noiseDirectVal, t, ramp);
    });

    // --- MODULATION ROUTING HELPERS ---
    const routeModulator = (gainNode: GainNode, target: LfoTarget, depth: number, key: string, targetVoiceIdx?: number) => {
        let targetToRoute = target;
        if (targetToRoute === 'osc1-pwm' && p.osc1.wave !== 'square') targetToRoute = 'none';
        if (targetToRoute === 'osc2-pwm' && p.osc2.wave !== 'square') targetToRoute = 'none';

        const pId = (targetVoiceIdx !== undefined ? `${key}_v${targetVoiceIdx}` : key);
        let effectiveTarget = targetToRoute;
        if (targetToRoute === 'fm-1to2') effectiveTarget += `:${p.oscMod.osc1to2.type}`;
        if (targetToRoute === 'fm-2to1') effectiveTarget += `:${p.oscMod.osc2to1.type}`;
        if (targetToRoute.startsWith('reverb-')) effectiveTarget += `:${p.global.springReverbEnabled}`;
        if (targetToRoute.startsWith('fuzz-')) effectiveTarget += `:${p.global.fuzzEnabled}`;
        if (targetToRoute.startsWith('delay-')) effectiveTarget += `:${p.global.delayEnabled}`;
        if (targetToRoute.startsWith('bitcrusher-')) effectiveTarget += `:${p.global.bitcrusherEnabled}`;
        
        const currentTargets = activeTargetsRef.current;
        const needsReconnect = currentTargets[pId] !== effectiveTarget;

        // Target switching policy:
        // - Rewire immediately (updateAudioNodes is state-driven; there is no continuous update loop).
        // - Force depth gain to 0 before reconnecting to prevent spikes.

        if (needsReconnect) {
            const now = Date.now();

            // Track old target for settling grace period
            const oldTargetStr = currentTargets[pId];
            if (oldTargetStr && typeof oldTargetStr === 'string') {
                const oldTarget = extractBaseTarget(oldTargetStr);
                if (oldTarget !== 'none') settlingTargetsMap.set(oldTarget, now);
            }

            // Silence modulation before switching targets.
            try {
                gainNode.gain.cancelScheduledValues(t);
                gainNode.gain.setValueAtTime(0, t);
            } catch (e) {
                warnOnceInDev('[nodeUpdater] Failed to silence modulation gain before reconnect', e);
            }

            // Rewire immediately. updateAudioNodes is state-driven; do not rely on a "next call" to complete switching.
            try { gainNode.disconnect(); } catch(e) {
                warnOnceInDev('[nodeUpdater] Failed to disconnect modulation gain node', e);
            }

            if (targetToRoute === 'none') {
                delete currentTargets[pId];
                return;
            }

            currentTargets[pId] = effectiveTarget;
            connectModulatorTarget(gainNode, targetToRoute, n, p, targetVoiceIdx);
        } // closes if (needsReconnect)

        if (targetToRoute !== 'none') {
            let isTargetBypassed = false;
            if (targetToRoute.startsWith('reverb-') && !p.global.springReverbEnabled) isTargetBypassed = true;
            else if (targetToRoute.startsWith('fuzz-') && !p.global.fuzzEnabled) isTargetBypassed = true;
            else if (targetToRoute.startsWith('delay-') && !p.global.delayEnabled) isTargetBypassed = true;
            else if (targetToRoute.startsWith('bitcrusher-') && !p.global.bitcrusherEnabled) isTargetBypassed = true;

            // CRITICAL: Use safe depth from protection system to prevent parameter overflow!
            // Calculate proportional scale reduction to keep ALL modulators within safe bounds.
            // PHASE 2 OPTIMIZATION: Use pre-computed scale from modulatorMap instead of calling getModulationScale
            const modDepth = modulatorMap.get(targetToRoute);
            let scale = modDepth ? modDepth.scale : getModulationScale(targetToRoute, p); // Fallback for safety

            const safeDe = safeDepthMap.get(targetToRoute);
            if (safeDe !== undefined && modDepth) {
                const originalTotalDepth = (modDepth.bipolar + modDepth.unipolar) * scale;
                if (originalTotalDepth > 0) {
                    // Scale down ALL modulators proportionally to stay within safe limits
                    const scaleMultiplier = Math.min(1.0, safeDe / originalTotalDepth);
                    scale = scale * scaleMultiplier;
                }
            }

            let depthMultiplier = (key.startsWith('modSeq') || key.startsWith('seq')) ? 2.0 : 1.0;
            const finalDepth = isTargetBypassed ? 0 : (depth * scale * depthMultiplier);

            if (needsReconnect) {
                // When switching targets, explicitly ramp up from 0 to avoid anchoring from a stale param.value.
                const tUp = t + RECONNECTION_DELAY_S;
                try {
                    gainNode.gain.cancelScheduledValues(t);
                    gainNode.gain.setValueAtTime(0, t);
                    gainNode.gain.setTargetAtTime(finalDepth, tUp, CROSSFADE_UP_TIME);
                } catch (e) {
                    warnOnceInDev('[nodeUpdater] Failed to ramp modulation gain after reconnect', e);
                }
            } else {
                setP(gainNode.gain, finalDepth, t, ramp);
            }
        }
    };

    // --- SETUP MODULATIONS ---
    if (n.lfo1.type !== p.lfo1.wave) n.lfo1.type = p.lfo1.wave;
    const lfo1Freq = p.lfo1.rateMode === 'sync' ? 1 / calculateDelayTime(p.lfo1.bpm, p.lfo1.rateDivision) : mapLfoRate(p.lfo1.rate);
    // Apply reflective protection so mutual LFO rate modulation cannot drive frequency out of bounds (e.g., to 0 Hz).
    setP(n.lfo1.frequency, protect('lfo1-rate', lfo1Freq * tol.lfo1Rate), t, ramp);
    routeModulator(n.lfo1Gain, p.lfo1.target, mapLfoDepth(p.lfo1.depth), 'lfo1');

    if (n.lfo2.type !== p.lfo2.wave) n.lfo2.type = p.lfo2.wave;
    const lfo2Freq = p.lfo2.rateMode === 'sync' ? 1 / calculateDelayTime(p.lfo2.bpm, p.lfo2.rateDivision) : mapLfoRate(p.lfo2.rate);
    setP(n.lfo2.frequency, protect('lfo2-rate', lfo2Freq * tol.lfo2Rate), t, ramp);
    routeModulator(n.lfo2Gain, p.lfo2.target, mapLfoDepth(p.lfo2.depth), 'lfo2');
    
    n.voices.forEach((v, i) => {
        routeModulator(v.modEnv1DepthNode, p.modEnv1.target, protected_modEnv1Depth, 'mEnv1', i);
        routeModulator(v.modEnv2DepthNode, p.modEnv2.target, protected_modEnv2Depth, 'mEnv2', i);
    });

    const configSeqRouting = (target: LfoTarget, freqGain: GainNode, detuneGain: GainNode, key: string) => {
        const currentTargets = activeTargetsRef.current;
        const needsReconnect = !currentTargets || currentTargets[key] !== target;
        if (needsReconnect && currentTargets) {
            try { freqGain.disconnect(); detuneGain.disconnect(); } catch(e) {
                warnOnceInDev('[nodeUpdater] Failed to disconnect sequencer routing gains', e);
            }
            if (target === 'none') { delete currentTargets[key]; return; }
            if (target.includes('freq')) {
              currentTargets[key] = target;
              n.voices.forEach(v => {
                  // Connect to voice oscillator detune for freq targets
                  if (target.includes('osc1')) detuneGain.connect(v.osc1.detune);
                  if (target.includes('osc2')) detuneGain.connect(v.osc2.detune);
              });
              setP(freqGain.gain, 0, t, ramp); setP(detuneGain.gain, 1, t, ramp); 
            } else { routeModulator(freqGain, target, 1.0, key); setP(detuneGain.gain, 0, t, ramp); }
        }
    };
    // Only route sequencers when actively running, disconnect when stopped
    if (p.seq1.isRunning) {
        configSeqRouting(p.seq1.target, n.seq1FreqGain, n.seq1DetuneGain, 'seq1');
    } else {
        configSeqRouting('none', n.seq1FreqGain, n.seq1DetuneGain, 'seq1');
    }

    if (p.seq2.isRunning) {
        configSeqRouting(p.seq2.target, n.seq2FreqGain, n.seq2DetuneGain, 'seq2');
    } else {
        configSeqRouting('none', n.seq2FreqGain, n.seq2DetuneGain, 'seq2');
    }

    // Always keep routing connected - control modulation via offset instead
    routeModulator(n.modSeq1Gain, p.modSeq1.target, 1.0, 'modSeq1');
    routeModulator(n.modSeq2Gain, p.modSeq2.target, 1.0, 'modSeq2');
};
