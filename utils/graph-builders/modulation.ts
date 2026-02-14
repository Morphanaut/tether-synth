
import { 
    createBrownNoiseBuffer, 
    createWhiteNoiseBuffer, 
    createPinkNoiseBuffer, 
    createCrackleBuffer 
} from '../audioMath';
import { 
    AMBIENCE_NOISE_LEVEL, 
    AMBIENCE_HUM_LEVEL, 
    AMBIENCE_CRACKLE_LEVEL,
    DRIFT_DEPTH,
    JITTER_DEPTH
} from './constants';
import { warnOnceInDev } from '../devDiagnostics';

export const createGlobalModulators = (ctx: AudioContext) => {
    const lfo1 = ctx.createOscillator();
    const lfo1Smoother = ctx.createBiquadFilter();
    lfo1Smoother.type = 'lowpass';
    lfo1Smoother.frequency.value = 70;
    const lfo1Gain = ctx.createGain();
    
    const lfo2 = ctx.createOscillator();
    const lfo2Smoother = ctx.createBiquadFilter();
    lfo2Smoother.type = 'lowpass';
    lfo2Smoother.frequency.value = 70;
    const lfo2Gain = ctx.createGain();

    lfo1.connect(lfo1Smoother);
    lfo1Smoother.connect(lfo1Gain);
    lfo2.connect(lfo2Smoother);
    lfo2Smoother.connect(lfo2Gain);

    const driftLfo1 = ctx.createOscillator();
    driftLfo1.frequency.value = 0.005;
    const driftGain1 = ctx.createGain();
    driftGain1.gain.value = DRIFT_DEPTH;
    
    const driftLfo2 = ctx.createOscillator();
    driftLfo2.frequency.value = 0.003;
    const driftGain2 = ctx.createGain();
    driftGain2.gain.value = DRIFT_DEPTH;

    driftLfo1.connect(driftGain1); 
    driftLfo2.connect(driftGain2); 

    const jitterGain1 = ctx.createGain();
    jitterGain1.gain.value = JITTER_DEPTH;
    const jitterGain2 = ctx.createGain();
    jitterGain2.gain.value = JITTER_DEPTH;

    lfo1.start();
    lfo2.start();
    driftLfo1.start();
    driftLfo2.start();

    return {
        lfo1, lfo1Smoother, lfo1Gain,
        lfo2, lfo2Smoother, lfo2Gain,
        driftLfo1, driftGain1, driftLfo2, driftGain2,
        jitterGain1, jitterGain2
    };
};

export const createSequencerSources = (ctx: AudioContext, modSink: AudioNode) => {
    const seq1Source = ctx.createConstantSource();
    const seq1FreqGain = ctx.createGain();
    const seq1DetuneGain = ctx.createGain();
    const seq2Source = ctx.createConstantSource();
    const seq2FreqGain = ctx.createGain();
    const seq2DetuneGain = ctx.createGain();
    
    const modSeq1Source = ctx.createConstantSource();
    const modSeq1Gain = ctx.createGain();
    const modSeq2Source = ctx.createConstantSource();
    const modSeq2Gain = ctx.createGain();

    seq1Source.connect(seq1FreqGain);
    seq1Source.connect(seq1DetuneGain);
    seq2Source.connect(seq2FreqGain);
    seq2Source.connect(seq2DetuneGain);
    modSeq1Source.connect(modSeq1Gain); 
    modSeq2Source.connect(modSeq2Gain);

    const seq1RateModGain = ctx.createGain(); 
    const seq1RateAnalyser = ctx.createAnalyser();
    seq1RateAnalyser.fftSize = 32;
    seq1RateModGain.connect(seq1RateAnalyser);
    
    const seq2RateModGain = ctx.createGain(); 
    const seq2RateAnalyser = ctx.createAnalyser();
    seq2RateAnalyser.fftSize = 32;
    seq2RateModGain.connect(seq2RateAnalyser);
    
    const modSeq1RateModGain = ctx.createGain(); 
    const modSeq1RateAnalyser = ctx.createAnalyser();
    modSeq1RateAnalyser.fftSize = 32;
    modSeq1RateModGain.connect(modSeq1RateAnalyser);
    
    const modSeq2RateModGain = ctx.createGain(); 
    const modSeq2RateAnalyser = ctx.createAnalyser();
    modSeq2RateAnalyser.fftSize = 32;
    modSeq2RateModGain.connect(modSeq2RateAnalyser);

    seq1RateAnalyser.connect(modSink);
    seq2RateAnalyser.connect(modSink);
    modSeq1RateAnalyser.connect(modSink);
    modSeq2RateAnalyser.connect(modSink);

    seq1Source.start();
    seq2Source.start();
    modSeq1Source.start();
    modSeq2Source.start();

    return {
        seq1Source, seq1FreqGain, seq1DetuneGain,
        seq2Source, seq2FreqGain, seq2DetuneGain,
        modSeq1Source, modSeq1Gain, modSeq2Source, modSeq2Gain,
        seq1RateModGain, seq1RateAnalyser,
        seq2RateModGain, seq2RateAnalyser,
        modSeq1RateModGain, modSeq1RateAnalyser,
        modSeq2RateModGain, modSeq2RateAnalyser
    };
};

export const createNoiseSources = (ctx: AudioContext) => {
    const whiteNoiseSource = ctx.createBufferSource();
    const pinkNoiseSource = ctx.createBufferSource();
    const brownNoiseSource = ctx.createBufferSource();
    
    try {
        whiteNoiseSource.buffer = createWhiteNoiseBuffer(ctx);
        whiteNoiseSource.loop = true;
    } catch (e) { warnOnceInDev('[modulation] failed to create white noise buffer', e); }
    try {
        pinkNoiseSource.buffer = createPinkNoiseBuffer(ctx);
        pinkNoiseSource.loop = true;
    } catch (e) { warnOnceInDev('[modulation] failed to create pink noise buffer', e); }
    try {
        brownNoiseSource.buffer = createBrownNoiseBuffer(ctx);
        brownNoiseSource.loop = true;
    } catch (e) { warnOnceInDev('[modulation] failed to create brown noise buffer', e); }

    const whiteNoiseGain = ctx.createGain();
    whiteNoiseGain.gain.value = 1;
    const pinkNoiseGain = ctx.createGain();
    pinkNoiseGain.gain.value = 0;
    const brownNoiseGain = ctx.createGain();
    brownNoiseGain.gain.value = 0;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    const noiseSendAGain = ctx.createGain();
    noiseSendAGain.gain.value = 0;
    const noiseSendBGain = ctx.createGain();
    noiseSendBGain.gain.value = 0;
    const noiseFmSendAGain = ctx.createGain();
    noiseFmSendAGain.gain.value = 0;
    const noiseFmSendBGain = ctx.createGain();
    noiseFmSendBGain.gain.value = 0;

    whiteNoiseSource.connect(whiteNoiseGain);
    pinkNoiseSource.connect(pinkNoiseGain);
    brownNoiseSource.connect(brownNoiseGain);
    whiteNoiseGain.connect(noiseFilter);
    pinkNoiseGain.connect(noiseFilter);
    brownNoiseGain.connect(noiseFilter);
    noiseFilter.connect(noiseSendAGain);
    noiseFilter.connect(noiseSendBGain);
    noiseFilter.connect(noiseFmSendAGain);
    noiseFilter.connect(noiseFmSendBGain);

    if (whiteNoiseSource.buffer) whiteNoiseSource.start();
    if (pinkNoiseSource.buffer) pinkNoiseSource.start();
    if (brownNoiseSource.buffer) brownNoiseSource.start();

    return {
        whiteNoiseSource, pinkNoiseSource, brownNoiseSource,
        whiteNoiseGain, pinkNoiseGain, brownNoiseGain,
        noiseFilter, noiseSendAGain, noiseSendBGain,
        noiseFmSendAGain, noiseFmSendBGain
    };
};

export const createAmbience = (ctx: AudioContext, dest: AudioNode) => {
    const ambienceSum = ctx.createGain();
    ambienceSum.gain.value = 1;
    ambienceSum.connect(dest);

    const noiseNode = ctx.createBufferSource();
    try {
        noiseNode.buffer = createBrownNoiseBuffer(ctx);
        noiseNode.loop = true;
    } catch (e) { warnOnceInDev('[modulation] failed to create ambience noise buffer', e); }
    const noiseFilterAmbience = ctx.createBiquadFilter();
    noiseFilterAmbience.type = 'lowpass';
    noiseFilterAmbience.frequency.value = 400;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = AMBIENCE_NOISE_LEVEL;

    const humOsc = ctx.createOscillator();
    humOsc.type = 'sawtooth';
    humOsc.frequency.value = 50;
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 120;
    const humGain = ctx.createGain();
    humGain.gain.value = AMBIENCE_HUM_LEVEL;
    const humLfo = ctx.createOscillator();
    humLfo.frequency.value = 0.15;
    const humLfoGain = ctx.createGain();
    humLfoGain.gain.value = 0.0001;

    const crackleNode = ctx.createBufferSource();
    try {
        crackleNode.buffer = createCrackleBuffer(ctx);
        crackleNode.loop = true;
    } catch (e) { warnOnceInDev('[modulation] failed to create crackle buffer', e); }
    const crackleFilter = ctx.createBiquadFilter();
    crackleFilter.type = 'bandpass';
    crackleFilter.frequency.value = 2000;
    crackleFilter.Q.value = 1;
    const crackleGain = ctx.createGain();
    crackleGain.gain.value = AMBIENCE_CRACKLE_LEVEL; 

    noiseNode.connect(noiseFilterAmbience);
    noiseFilterAmbience.connect(noiseGain);
    noiseGain.connect(ambienceSum);
    
    humLfo.connect(humLfoGain);
    humLfoGain.connect(humGain.gain);
    humOsc.connect(humFilter);
    humFilter.connect(humGain);
    humGain.connect(ambienceSum);
    
    crackleNode.connect(crackleFilter);
    crackleFilter.connect(crackleGain);
    crackleGain.connect(ambienceSum);

    humOsc.start();
    humLfo.start();
    if (noiseNode.buffer) noiseNode.start();
    if (crackleNode.buffer) crackleNode.start();

    return {
        noiseNode, noiseGain, 
        humOsc, humGain, 
        crackleNode, crackleGain
    };
};

