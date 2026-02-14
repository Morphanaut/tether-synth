import { VoiceNodes, VoiceOscillatorNode } from '../../types';
import {
    AnalogTolerances,
    RESONANCE_MIN,
    CACHED_WARMTH_006,
    CACHED_WARMTH_007,
    CACHED_WARMTH_010
} from '../audioMath';

const ANALOG_WORKLET_PROCESSOR = 'tether-analog-vco-optimized';

const requireWorkletParam = (node: AudioWorkletNode, name: string): AudioParam => {
    const param = node.parameters.get(name);
    if (!param) {
        throw new Error(`[voice] missing AudioWorklet parameter: ${name}`);
    }
    return param;
};

const createWorkletOscillator = (ctx: AudioContext): VoiceOscillatorNode => {
    const osc = new AudioWorkletNode(ctx, ANALOG_WORKLET_PROCESSOR, {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [1]
    }) as VoiceOscillatorNode;

    osc.frequency = requireWorkletParam(osc, 'frequency');
    osc.detune = requireWorkletParam(osc, 'detune');
    osc.waveform = requireWorkletParam(osc, 'waveform');
    osc.pulseWidth = requireWorkletParam(osc, 'pulseWidth');
    osc.waveType = 'triangle';
    osc.waveform.value = 2;
    osc.pulseWidth.value = 0;

    return osc;
};

export const createVoice = (
    ctx: AudioContext,
    _tolerances: AnalogTolerances,
    destination: AudioNode
): VoiceNodes => {
    // Oscillators (optimized worklet backend)
    const osc1 = createWorkletOscillator(ctx);
    const osc2 = createWorkletOscillator(ctx);

    // Mixing and gains
    const osc1Dry = ctx.createGain();
    osc1Dry.gain.value = 1;
    const osc1Wet = ctx.createGain();
    osc1Wet.gain.value = 0;
    const osc2Dry = ctx.createGain();
    osc2Dry.gain.value = 1;
    const osc2Wet = ctx.createGain();
    osc2Wet.gain.value = 0;

    const gain1 = ctx.createGain();
    gain1.gain.value = 0;
    const gain2 = ctx.createGain();
    gain2.gain.value = 0;

    const mixGain1 = ctx.createGain();
    mixGain1.gain.value = 0;
    const mixGain2 = ctx.createGain();
    mixGain2.gain.value = 0;

    // Gain staging and drive controls
    const preDriveGain1 = ctx.createGain();
    preDriveGain1.gain.value = 1.12;
    const preDriveGain2 = ctx.createGain();
    preDriveGain2.gain.value = 1.12;

    const postDriveGain1 = ctx.createGain();
    postDriveGain1.gain.value = 0.98;
    const postDriveGain2 = ctx.createGain();
    postDriveGain2.gain.value = 0.98;

    const filt1FbGain = ctx.createGain();
    filt1FbGain.gain.value = 0.0;
    const filt2FbGain = ctx.createGain();
    filt2FbGain.gain.value = 0.0;

    // Analog drive stages
    const preFilterCurve = CACHED_WARMTH_010 as Float32Array<ArrayBuffer>;
    const postFilterCurve = CACHED_WARMTH_007 as Float32Array<ArrayBuffer>;
    const feedbackCurve = CACHED_WARMTH_006 as Float32Array<ArrayBuffer>;

    const preDrive1 = ctx.createWaveShaper();
    preDrive1.curve = preFilterCurve;
    preDrive1.oversample = '4x';
    const postDrive1 = ctx.createWaveShaper();
    postDrive1.curve = postFilterCurve;
    postDrive1.oversample = '4x';

    const preDrive2 = ctx.createWaveShaper();
    preDrive2.curve = preFilterCurve;
    preDrive2.oversample = '4x';
    const postDrive2 = ctx.createWaveShaper();
    postDrive2.curve = postFilterCurve;
    postDrive2.oversample = '4x';

    const filt1FbShaper = ctx.createWaveShaper();
    filt1FbShaper.curve = feedbackCurve;
    filt1FbShaper.oversample = '4x';

    const filt2FbShaper = ctx.createWaveShaper();
    filt2FbShaper.curve = feedbackCurve;
    filt2FbShaper.oversample = '4x';

    // Filters
    const filt1 = ctx.createBiquadFilter();
    filt1.type = 'lowpass';
    filt1.frequency.value = 12000;
    filt1.Q.value = 0.7;

    const filt2 = ctx.createBiquadFilter();
    filt2.type = 'lowpass';
    filt2.frequency.value = 12000;
    filt2.Q.value = 0.7;

    const hpFilt1 = ctx.createBiquadFilter();
    hpFilt1.type = 'highpass';
    hpFilt1.frequency.value = 40;
    hpFilt1.Q.value = RESONANCE_MIN;

    const hpFilt2 = ctx.createBiquadFilter();
    hpFilt2.type = 'highpass';
    hpFilt2.frequency.value = 40;
    hpFilt2.Q.value = RESONANCE_MIN;

    // Panning
    const pan1 = ctx.createStereoPanner();
    const pan2 = ctx.createStereoPanner();

    // Modulation matrix gains
    const fmGain1to2 = ctx.createGain();
    fmGain1to2.gain.value = 0;
    const fmGain2to1 = ctx.createGain();
    fmGain2to1.gain.value = 0;
    const amGain1to2 = ctx.createGain();
    amGain1to2.gain.value = 0;
    const amGain2to1 = ctx.createGain();
    amGain2to1.gain.value = 0;

    const mod1RawGain = ctx.createGain();
    mod1RawGain.gain.value = 1;
    const mod1FltGain = ctx.createGain();
    mod1FltGain.gain.value = 0;
    const mod2RawGain = ctx.createGain();
    mod2RawGain.gain.value = 1;
    const mod2FltGain = ctx.createGain();
    mod2FltGain.gain.value = 0;

    // Mod envelopes
    const modEnv1Source = ctx.createConstantSource();
    modEnv1Source.offset.value = 1;
    const modEnv1Gain = ctx.createGain();
    modEnv1Gain.gain.value = 0;
    const modEnv1DepthNode = ctx.createGain();

    const modEnv2Source = ctx.createConstantSource();
    modEnv2Source.offset.value = 1;
    const modEnv2Gain = ctx.createGain();
    modEnv2Gain.gain.value = 0;
    const modEnv2DepthNode = ctx.createGain();

    // Noise routing
    const noiseInputA = ctx.createGain();
    const noiseInputB = ctx.createGain();

    const noiseFilterGainA = ctx.createGain();
    noiseFilterGainA.gain.value = 1;
    const noiseDirectGainA = ctx.createGain();
    noiseDirectGainA.gain.value = 0;

    const noiseFilterGainB = ctx.createGain();
    noiseFilterGainB.gain.value = 1;
    const noiseDirectGainB = ctx.createGain();
    noiseDirectGainB.gain.value = 0;

    // Routing osc1
    osc1.connect(mod1RawGain);
    osc1.connect(osc1Dry);
    osc1.connect(osc1Wet);
    filt1.connect(mod1FltGain);

    // Routing osc2
    osc2.connect(mod2RawGain);
    osc2.connect(osc2Dry);
    osc2.connect(osc2Wet);
    filt2.connect(mod2FltGain);

    // Cross modulation routing
    mod1RawGain.connect(fmGain1to2);
    mod1FltGain.connect(fmGain1to2);
    mod1RawGain.connect(amGain1to2);
    mod1FltGain.connect(amGain1to2);

    mod2RawGain.connect(fmGain2to1);
    mod2FltGain.connect(fmGain2to1);
    mod2RawGain.connect(amGain2to1);
    mod2FltGain.connect(amGain2to1);

    fmGain1to2.connect(osc2.frequency);
    amGain1to2.connect(osc2Wet.gain);

    fmGain2to1.connect(osc1.frequency);
    amGain2to1.connect(osc1Wet.gain);

    // Osc1 signal path
    osc1Dry.connect(hpFilt1);
    osc1Wet.connect(hpFilt1);

    hpFilt1.connect(preDriveGain1);
    preDriveGain1.connect(preDrive1);
    preDrive1.connect(filt1);
    filt1.connect(postDrive1);
    postDrive1.connect(postDriveGain1);
    postDriveGain1.connect(gain1);

    filt1.connect(filt1FbGain);
    filt1FbGain.connect(filt1FbShaper);
    filt1FbShaper.connect(preDriveGain1);

    gain1.connect(mixGain1);
    mixGain1.connect(pan1);
    pan1.connect(destination);

    // Osc2 signal path
    osc2Dry.connect(hpFilt2);
    osc2Wet.connect(hpFilt2);

    hpFilt2.connect(preDriveGain2);
    preDriveGain2.connect(preDrive2);
    preDrive2.connect(filt2);
    filt2.connect(postDrive2);
    postDrive2.connect(postDriveGain2);
    postDriveGain2.connect(gain2);

    filt2.connect(filt2FbGain);
    filt2FbGain.connect(filt2FbShaper);
    filt2FbShaper.connect(preDriveGain2);

    gain2.connect(mixGain2);
    mixGain2.connect(pan2);
    pan2.connect(destination);

    // Noise routing logic
    noiseInputA.connect(noiseFilterGainA);
    noiseInputA.connect(noiseDirectGainA);
    noiseFilterGainA.connect(hpFilt1);
    noiseDirectGainA.connect(gain1);

    noiseInputB.connect(noiseFilterGainB);
    noiseInputB.connect(noiseDirectGainB);
    noiseFilterGainB.connect(hpFilt2);
    noiseDirectGainB.connect(gain2);

    modEnv1Source.connect(modEnv1Gain);
    modEnv1Gain.connect(modEnv1DepthNode);
    modEnv2Source.connect(modEnv2Gain);
    modEnv2Gain.connect(modEnv2DepthNode);

    modEnv1Source.start();
    modEnv2Source.start();

    return {
        osc1,
        osc2,
        gain1,
        gain2,
        mixGain1,
        mixGain2,
        filt1,
        filt2,
        hpFilt1,
        hpFilt2,
        preDriveGain1,
        postDriveGain1,
        filt1FbGain,
        preDriveGain2,
        postDriveGain2,
        filt2FbGain,
        pan1,
        pan2,
        osc1Dry,
        osc1Wet,
        osc2Dry,
        osc2Wet,
        fmGain1to2,
        fmGain2to1,
        amGain1to2,
        amGain2to1,
        mod1RawGain,
        mod1FltGain,
        mod2RawGain,
        mod2FltGain,
        modEnv1Source,
        modEnv1Gain,
        modEnv1DepthNode,
        modEnv2Source,
        modEnv2Gain,
        modEnv2DepthNode,
        noiseInputA,
        noiseInputB,
        noiseFilterGainA,
        noiseDirectGainA,
        noiseFilterGainB,
        noiseDirectGainB
    };
};
