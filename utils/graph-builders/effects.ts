
import { BitcrusherNode } from '../../types';
import {
    CACHED_PT2399_SAT,
    CACHED_BIG_MUFF,
    CACHED_CONSOLE_SAT,
    CACHED_SPRING_INPUT,
    CACHED_SPRING_OUTPUT,
    createSpringImpulseResponse
} from '../audioMath';
import { 
    DELAY_MAX_TIME_S, 
    DELAY_INPUT_GAIN, 
    DELAY_FILTER_FREQ, 
    DELAY_FILTER_Q, 
    LIMITER_THRESHOLD_DB,
    LIMITER_KNEE_DB,
    LIMITER_RATIO,
    LIMITER_ATTACK_S,
    LIMITER_RELEASE_S
} from './constants';

export interface LimiterNodes {
    input: GainNode;
    compressor: DynamicsCompressorNode;
    output: GainNode;
}

export const createLimiter = (ctx: AudioContext): LimiterNodes => {
    const input = ctx.createGain();
    input.gain.value = 1.02; 
    
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = LIMITER_THRESHOLD_DB;
    compressor.knee.value = LIMITER_KNEE_DB;
    compressor.ratio.value = LIMITER_RATIO;
    compressor.attack.value = LIMITER_ATTACK_S;
    compressor.release.value = LIMITER_RELEASE_S;
    
    const output = ctx.createGain();
    output.gain.value = 1; 
    
    input.connect(compressor);
    compressor.connect(output);
    
    return { input, compressor, output };
};

export const createBitcrusher = (
    ctx: AudioContext
): BitcrusherNode => {
    const bitcrusher = new AudioWorkletNode(ctx, 'tether-bitcrusher-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2]
    }) as BitcrusherNode;
    
    bitcrusher.meta = { bits: 8, normfreq: 1 };

    const bitsParam = bitcrusher.parameters.get('bits');
    const freqParam = bitcrusher.parameters.get('normfreq');
    
    if (bitsParam) bitsParam.value = 8;
    if (freqParam) freqParam.value = 1;

    return bitcrusher;
};

export const createDelayBlock = (ctx: AudioContext) => {
    const blockInput = ctx.createGain();
    const blockOutput = ctx.createGain();
    
    const input = ctx.createGain();
    input.gain.value = DELAY_INPUT_GAIN;
    
    const delay = ctx.createDelay(DELAY_MAX_TIME_S);
    
    const timeSource = ctx.createConstantSource();
    timeSource.offset.value = 0.35; 
    const timeSmoother = ctx.createBiquadFilter();
    timeSmoother.type = 'lowpass';
    timeSmoother.frequency.value = 5.0; 
    timeSmoother.Q.value = 0.5; 
    timeSource.connect(timeSmoother);
    timeSmoother.connect(delay.delayTime);
    timeSource.start();

    const wowLfo = ctx.createOscillator();
    wowLfo.type = 'sine';
    wowLfo.frequency.value = 0.5 + Math.random() * 0.3;
    const wowDepth = ctx.createGain();
    wowDepth.gain.value = 0.0008; 
    wowLfo.connect(wowDepth);
    wowDepth.connect(delay.delayTime);
    wowLfo.start();
    
    const flutterLfo = ctx.createOscillator();
    flutterLfo.type = 'triangle';
    flutterLfo.frequency.value = 3 + Math.random() * 2;
    const flutterDepth = ctx.createGain();
    flutterDepth.gain.value = 0.00015;
    flutterLfo.connect(flutterDepth);
    flutterDepth.connect(delay.delayTime);
    flutterLfo.start();

    const fb = ctx.createGain();
    const wet = ctx.createGain(); 
    const dry = ctx.createGain(); 
    
    const lpFilter = ctx.createBiquadFilter();
    const hpFilter = ctx.createBiquadFilter();
    
    lpFilter.type = "lowpass";
    lpFilter.frequency.value = DELAY_FILTER_FREQ; 
    lpFilter.Q.value = DELAY_FILTER_Q;

    hpFilter.type = "highpass";
    hpFilter.frequency.value = 120; 
    hpFilter.Q.value = 0.5;

    const shaper = ctx.createWaveShaper();
    shaper.curve = CACHED_PT2399_SAT as Float32Array<ArrayBuffer>;
    shaper.oversample = '4x';
    
    const preDrive = ctx.createGain();
    preDrive.gain.value = 8.0; 
    const postDrive = ctx.createGain();
    postDrive.gain.value = 1.0 / 8.0;

    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
        noiseData[i] = (Math.random() * 2 - 1) * 0.008;
    }
    const clockNoise = ctx.createBufferSource();
    clockNoise.buffer = noiseBuffer;
    clockNoise.loop = true;
    
    const clockNoiseFilter = ctx.createBiquadFilter();
    clockNoiseFilter.type = 'highpass';
    clockNoiseFilter.frequency.value = 4000;
    
    const clockNoiseGain = ctx.createGain();
    clockNoiseGain.gain.value = 0.015;
    
    clockNoise.connect(clockNoiseFilter);
    clockNoiseFilter.connect(clockNoiseGain);
    clockNoise.start();
    
    wet.gain.value = 0;
    dry.gain.value = 1;
    fb.gain.value = 0;

    blockInput.connect(dry);
    blockInput.connect(input);
    input.connect(delay);
    delay.connect(wet);
    
    delay.connect(fb);
    fb.connect(hpFilter);
    clockNoiseGain.connect(hpFilter); 
    hpFilter.connect(lpFilter);
    lpFilter.connect(preDrive);
    preDrive.connect(shaper);
    shaper.connect(postDrive);
    postDrive.connect(delay);
    
    dry.connect(blockOutput);
    wet.connect(blockOutput);

    return {
        blockInput, blockOutput,
        input, delay, timeSource, timeSmoother, fb, wet, dry, filter: lpFilter, hpFilter, shaper,
        wowLfo, wowDepth, flutterLfo, flutterDepth, clockNoiseGain
    };
};

export const createFuzzBlock = (ctx: AudioContext) => {
    const blockInput = ctx.createGain();
    const blockOutput = ctx.createGain();

    const inGain = ctx.createGain();
    inGain.gain.value = 1.0;

    const muffCurve = CACHED_BIG_MUFF;

    const rc1 = ctx.createBiquadFilter();
    rc1.type = 'highpass';
    rc1.frequency.value = 45;
    rc1.Q.value = 0.6;

    const drive1 = ctx.createGain();
    drive1.gain.value = 1.0;
    const clip1 = ctx.createWaveShaper();
    clip1.curve = muffCurve as Float32Array<ArrayBuffer>;
    clip1.oversample = '4x';

    const drive2 = ctx.createGain();
    drive2.gain.value = 1.35;
    const clip2 = ctx.createWaveShaper();
    clip2.curve = muffCurve as Float32Array<ArrayBuffer>;
    clip2.oversample = '4x';

    const rc2 = ctx.createBiquadFilter();
    rc2.type = 'lowpass';
    rc2.frequency.value = 9200;
    rc2.Q.value = 0.7;

    const drive3 = ctx.createGain();
    drive3.gain.value = 1.0;
    const clip3 = ctx.createWaveShaper();
    clip3.curve = muffCurve as Float32Array<ArrayBuffer>;
    clip3.oversample = '4x';

    const toneSplit = ctx.createGain();

    const bassFilter = ctx.createBiquadFilter();
    bassFilter.type = 'lowpass';
    bassFilter.frequency.value = 650;
    bassFilter.Q.value = 0.707;
    const bassGain = ctx.createGain();

    const trebleFilter = ctx.createBiquadFilter();
    trebleFilter.type = 'highpass';
    trebleFilter.frequency.value = 1400;
    trebleFilter.Q.value = 0.707;
    const trebleGain = ctx.createGain();

    const toneSum = ctx.createGain();
    toneSum.gain.value = 1.0;

    const toneInverter = ctx.createGain();
    toneInverter.gain.value = -1.0;
    toneInverter.connect(bassGain.gain);

    const wet = ctx.createGain();
    const dry = ctx.createGain();
    dry.gain.value = 1;
    wet.gain.value = 0;

    const sustainComp = ctx.createDynamicsCompressor();
    sustainComp.threshold.value = -44;
    sustainComp.knee.value = 24;
    sustainComp.ratio.value = 3.6;
    sustainComp.attack.value = 0.006;
    sustainComp.release.value = 0.65;
    const sustainMakeup = ctx.createGain();
    sustainMakeup.gain.value = 1.6;

    const outputComp = ctx.createGain();
    outputComp.gain.value = 0.09;
    const analogShaper = ctx.createWaveShaper();
    analogShaper.curve = CACHED_CONSOLE_SAT as Float32Array<ArrayBuffer>;
    analogShaper.oversample = '4x';

    blockInput.connect(dry);
    dry.connect(blockOutput);

    blockInput.connect(inGain);
    inGain.connect(rc1);
    rc1.connect(drive1);
    drive1.connect(clip1);
    clip1.connect(drive2);
    drive2.connect(clip2);
    clip2.connect(rc2);
    rc2.connect(drive3);
    drive3.connect(clip3);

    clip3.connect(toneSplit);
    toneSplit.connect(bassFilter);
    bassFilter.connect(bassGain);
    bassGain.connect(toneSum);

    toneSplit.connect(trebleFilter);
    trebleFilter.connect(trebleGain);
    trebleGain.connect(toneSum);

    toneSum.connect(analogShaper);
    analogShaper.connect(sustainComp);
    sustainComp.connect(sustainMakeup);
    sustainMakeup.connect(outputComp);
    outputComp.connect(wet);
    wet.connect(blockOutput);

    return {
        blockInput, blockOutput,
        inGain, 
        fuzzDrive1: drive1, fuzzDrive2: drive2, fuzzDrive3: drive3,
        fuzzClip1: clip1, fuzzClip2: clip2, fuzzClip3: clip3,
        fuzzRc1: rc1, fuzzRc2: rc2,
        fuzzBassFilter: bassFilter, fuzzBassGain: bassGain,
        fuzzTrebleFilter: trebleFilter, fuzzTrebleGain: trebleGain,
        fuzzToneSum: toneSum,
        fuzzToneInverter: toneInverter,
        analogShaper,
        wet, dry
    };
};

export const createReverbBlock = (ctx: AudioContext) => {
    const blockInput = ctx.createGain();
    const blockOutput = ctx.createGain();
    const inputGate = ctx.createGain();
    inputGate.gain.value = 1;

    const preEmphasis = ctx.createBiquadFilter();
    preEmphasis.type = 'highshelf';
    preEmphasis.frequency.value = 1800;
    preEmphasis.gain.value = 4.5;

    const inputDrive = ctx.createGain();
    inputDrive.gain.value = 2.0;
    const inputSat = ctx.createWaveShaper();
    inputSat.curve = CACHED_SPRING_INPUT as Float32Array<ArrayBuffer>;
    inputSat.oversample = '4x';
    const inputComp = ctx.createGain();
    inputComp.gain.value = 0.5;

    const reverb = ctx.createConvolver();
    try {
        const impulse = createSpringImpulseResponse(ctx, 512);
        if (impulse) reverb.buffer = impulse;
    } catch (e) { console.warn('Failed to create spring reverb IR:', e); }

    const deEmphasis = ctx.createBiquadFilter();
    deEmphasis.type = 'lowpass';
    deEmphasis.frequency.value = 6500;
    deEmphasis.Q.value = 0.5;

    const toneFilter = ctx.createBiquadFilter();
    toneFilter.type = 'highshelf';
    toneFilter.frequency.value = 2200;
    toneFilter.gain.value = 0;

    const outputSat = ctx.createWaveShaper();
    outputSat.curve = CACHED_SPRING_OUTPUT as Float32Array<ArrayBuffer>;
    outputSat.oversample = '4x';

    const dry = ctx.createGain();
    const wet = ctx.createGain();
    dry.gain.value = 1;
    wet.gain.value = 0;

    blockInput.connect(dry);
    blockInput.connect(inputGate);
    inputGate.connect(preEmphasis);
    preEmphasis.connect(inputDrive);
    inputDrive.connect(inputSat);
    inputSat.connect(inputComp);
    inputComp.connect(reverb);
    reverb.connect(deEmphasis);
    deEmphasis.connect(toneFilter);
    toneFilter.connect(outputSat);
    outputSat.connect(wet);

    dry.connect(blockOutput);
    wet.connect(blockOutput);

    return {
        blockInput, blockOutput,
        reverb, 
        filter: toneFilter,
        inputGate,
        preEmphasis,
        inputDrive,
        inputSat,
        deEmphasis,
        outputSat,
        dry, wet
    };
};


