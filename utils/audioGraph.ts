
import { AnalogTolerances, CACHED_WARMTH_008, CACHED_WARMTH_010 } from './audioMath';
import { AudioGraphNodes, VoiceNodes, FxType } from '../types';
import { 
    VOICE_COUNT, 
    BUS_COMP_THRESHOLD_DB, 
    BUS_COMP_KNEE_DB, 
    BUS_COMP_RATIO, 
    BUS_COMP_ATTACK_S, 
    BUS_COMP_RELEASE_S 
} from './graph-builders/constants';
import { createVoice } from './graph-builders/voice';
import { 
    createLimiter, 
    createBitcrusher, 
    createDelayBlock, 
    createFuzzBlock, 
    createReverbBlock 
} from './graph-builders/effects';
import { 
    createGlobalModulators, 
    createSequencerSources, 
    createNoiseSources, 
    createAmbience 
} from './graph-builders/modulation';
import { MASTER_EQ_FREQUENCIES } from '../data/constants';
import { warnOnceInDev } from './devDiagnostics';

// ============================================================================
// DYNAMIC FX ROUTING
// ============================================================================

export const updateFxRouting = (nodes: AudioGraphNodes | null, routing: FxType[] | undefined) => {
    if (!nodes) return;

    const activeRouting: FxType[] = (routing && Array.isArray(routing) && routing.length > 0) 
        ? routing 
        : ['delay', 'bitcrusher', 'fuzz', 'reverb'];

    // Map blocks to their I/O nodes if they exist
    const blocks: Record<FxType, { input: GainNode, output: GainNode } | undefined> = {
        delay: (nodes.delayBlockInput && nodes.delayBlockOutput) 
            ? { input: nodes.delayBlockInput, output: nodes.delayBlockOutput } 
            : undefined,
        bitcrusher: (nodes.bcBlockInput && nodes.bcBlockOutput) 
            ? { input: nodes.bcBlockInput, output: nodes.bcBlockOutput } 
            : undefined,
        fuzz: (nodes.fuzzBlockInput && nodes.fuzzBlockOutput) 
            ? { input: nodes.fuzzBlockInput, output: nodes.fuzzBlockOutput } 
            : undefined,
        reverb: (nodes.reverbBlockInput && nodes.reverbBlockOutput) 
            ? { input: nodes.reverbBlockInput, output: nodes.reverbBlockOutput } 
            : undefined
    };

    const safeDisconnect = (node: AudioNode | undefined | null) => {
        if (node) try { node.disconnect(); } catch (e) {
            warnOnceInDev('[audioGraph] failed to disconnect node during FX reroute', e);
        }
    };

    // 1. Reset Graph: Disconnect the source (fxInput) and all effect outputs.
    // NOTE: fxInput is a stable pre-FX insertion point. We only disconnect from this node
    // to avoid breaking permanent wiring like dryGain -> masterEQ.
    safeDisconnect(nodes.fxInput);
    Object.values(blocks).forEach(block => {
        if (block) safeDisconnect(block.output);
    });

    // 2. Rebuild Chain
    // Always pass through post-FX saturation BEFORE the bus compressor.
    let currentSource: AudioNode = nodes.fxInput; 

    activeRouting.forEach(fx => {
        const block = blocks[fx];
        if (block) {
            try {
                currentSource.connect(block.input);
                currentSource = block.output;
            } catch (e) { 
                console.warn(`[AudioGraph] Failed to connect FX block: ${fx}`, e); 
            }
        }
    });

    // 3. Connect to Master Bus (through post-FX saturation)
    try {
        currentSource.connect(nodes.postFxSat);
        nodes.postFxSat.connect(nodes.busCompressor);
    } catch (e) {
        console.error("[AudioGraph] Failed to connect FX chain to Bus Compressor", e);
    }
};

// ============================================================================
// MAIN GRAPH CREATION
// ============================================================================

export const createSynthNodes = (
    ctx: AudioContext, 
    tolerances: AnalogTolerances
): AudioGraphNodes => {
    if (!ctx || ctx.state === 'closed') {
        throw new Error('Invalid AudioContext: context is null or closed');
    }
    
    // Global modulation bus for silent operation
    const modSink = ctx.createGain();
    modSink.gain.value = 0;
    modSink.connect(ctx.destination);

    const delayBlock = createDelayBlock(ctx);
    
    const bcBlockInput = ctx.createGain();
    const bcBlockOutput = ctx.createGain();
    const bitcrusher = createBitcrusher(ctx);
    
    const bitcrusherBitsMod = ctx.createGain();
    // Connect mod source to AudioParam (bits)
    const bitsParam = bitcrusher.parameters.get('bits');
    if (bitsParam) bitcrusherBitsMod.connect(bitsParam);
    
    const bitcrusherRateMod = ctx.createGain();
    // Connect mod source to AudioParam (normfreq)
    const freqParam = bitcrusher.parameters.get('normfreq');
    if (freqParam) bitcrusherRateMod.connect(freqParam);

    const bitcrusherDry = ctx.createGain(); bitcrusherDry.gain.value = 1;
    const bitcrusherWet = ctx.createGain(); bitcrusherWet.gain.value = 0;
    bcBlockInput.connect(bitcrusherDry); bcBlockInput.connect(bitcrusher);
    bitcrusher.connect(bitcrusherWet); bitcrusherDry.connect(bcBlockOutput); bitcrusherWet.connect(bcBlockOutput);

    const fuzzBlock = createFuzzBlock(ctx);
    const reverbBlock = createReverbBlock(ctx);

    const dryGain = ctx.createGain(); 
    dryGain.gain.value = 0; // Initially 0

    // Stable insertion point feeding the dynamic FX chain.
    // We keep dryGain -> masterEQ -> fxInput as permanent wiring.
    const fxInput = ctx.createGain();
    fxInput.gain.value = 1;

    // Always-on subtle saturation stages
    const masterEqSat = ctx.createWaveShaper();
    masterEqSat.curve = CACHED_WARMTH_008 as Float32Array<ArrayBuffer>;
    masterEqSat.oversample = '4x';

    const postFxSat = ctx.createWaveShaper();
    postFxSat.curve = CACHED_WARMTH_010 as Float32Array<ArrayBuffer>;
    postFxSat.oversample = '4x';

    // --- MASTER BUS CHAIN ---
    // 1. Bus Compressor (No Pre-Compression Saturation)
    const busCompressor = ctx.createDynamicsCompressor();
    busCompressor.threshold.value = BUS_COMP_THRESHOLD_DB;
    busCompressor.knee.value = BUS_COMP_KNEE_DB;
    busCompressor.ratio.value = BUS_COMP_RATIO;
    busCompressor.attack.value = BUS_COMP_ATTACK_S;
    busCompressor.release.value = BUS_COMP_RELEASE_S;

    // 3. Master Volume
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0; // Initially 0

    // 4. Master 7-Band Graphic EQ
    // 63, 136, 294, 632, 1363, 2936, 6324 HZ
    const masterEQ: BiquadFilterNode[] = MASTER_EQ_FREQUENCIES.map((freq, i) => {
        const filter = ctx.createBiquadFilter();
        filter.frequency.value = freq;
        // Band 1: Low Shelf, Band 7: High Shelf, Others: Peaking
        if (i === 0) {
            filter.type = 'lowshelf';
        } else if (i === MASTER_EQ_FREQUENCIES.length - 1) {
            filter.type = 'highshelf';
        } else {
            filter.type = 'peaking';
            filter.Q.value = 1.4; // Broad musical Q
        }
        filter.gain.value = 0; // Flat start
        return filter;
    });

    // 5. AC Coupler (DC Block) - Adjusted to 20Hz for better sub-bass
    const acCoupler = ctx.createBiquadFilter();
    acCoupler.type = "highpass";
    acCoupler.frequency.value = 20;
    acCoupler.Q.value = 0.707;

    // 6. Safety Limiter (No Multi-Stage Saturation)
    const limiterNode = createLimiter(ctx);

    const masterLowPass = ctx.createBiquadFilter();
    masterLowPass.type = "lowpass";
    masterLowPass.frequency.value = 18000;
    masterLowPass.Q.value = 0.5;

    const outputGate = ctx.createGain();
    outputGate.gain.value = 0; // Start fully closed

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;

    // ------------------------------------------------------------------------
    // PRE-FX EQ INSERT (Moved earlier in chain)
    // dryGain -> masterEQ -> masterEqSat -> fxInput
    // ------------------------------------------------------------------------
    let lastEQNode: AudioNode = dryGain;
    masterEQ.forEach(eqBand => {
        lastEQNode.connect(eqBand);
        lastEQNode = eqBand;
    });
    lastEQNode.connect(masterEqSat);
    masterEqSat.connect(fxInput);

    // ------------------------------------------------------------------------
    // MASTER OUTPUT CHAIN
    // busCompressor -> masterGain -> acCoupler -> Limiter -> masterLowPass -> output
    // (EQ has been moved pre-FX, so it's not here anymore)
    // ------------------------------------------------------------------------
    busCompressor.connect(masterGain);
    masterGain.connect(acCoupler);
    acCoupler.connect(limiterNode.input);
    
    limiterNode.output.connect(masterLowPass);
    masterLowPass.connect(outputGate);
    outputGate.connect(analyser);
    outputGate.connect(ctx.destination);

    const voices: VoiceNodes[] = [];
    for (let i = 0; i < VOICE_COUNT; i++) {
        voices.push(createVoice(ctx, tolerances, dryGain)); 
    }

    const globalMods = createGlobalModulators(ctx);
    const seqSources = createSequencerSources(ctx, modSink);
    const noiseSources = createNoiseSources(ctx);
    const ambience = createAmbience(ctx, masterGain); // Ambience injects post-compressor

    ambience.noiseNode.connect(globalMods.jitterGain1);
    ambience.noiseNode.connect(globalMods.jitterGain2);

    voices.forEach(v => {
        // Drift/jitter modulation to voice oscillator detune
        globalMods.driftGain1.connect(v.osc1.detune);
        globalMods.driftGain2.connect(v.osc2.detune);
        globalMods.jitterGain1.connect(v.osc1.detune);
        globalMods.jitterGain2.connect(v.osc2.detune);

        // Noise routing
        noiseSources.noiseSendAGain.connect(v.noiseInputA);
        noiseSources.noiseSendBGain.connect(v.noiseInputB);

        // Noise FM to voice oscillator frequency
        noiseSources.noiseFmSendAGain.connect(v.osc1.frequency);
        noiseSources.noiseFmSendBGain.connect(v.osc2.frequency);
    });

    return {
        voices,
        ...globalMods,
        ...seqSources,
        ...noiseSources,
        delayBlockInput: delayBlock.blockInput,
        delayBlockOutput: delayBlock.blockOutput,
        delayInput: delayBlock.input,
        delay: delayBlock.delay,
        delayTimeSource: delayBlock.timeSource,
        delayTimeSmoother: delayBlock.timeSmoother,
        delayFB: delayBlock.fb,
        delayWet: delayBlock.wet,
        delayDry: delayBlock.dry,
        delayFilter: delayBlock.filter,
        delayHpFilter: delayBlock.hpFilter,
        delayShaper: delayBlock.shaper,
        bcBlockInput: bcBlockInput,
        bcBlockOutput: bcBlockOutput,
        bitcrusher, bitcrusherDry, bitcrusherWet,
        bitcrusherBitsMod, 
        bitcrusherRateMod,
        fuzzBlockInput: fuzzBlock.blockInput,
        fuzzBlockOutput: fuzzBlock.blockOutput,
        fuzzInGain: fuzzBlock.inGain,
        fuzzDrive1: fuzzBlock.fuzzDrive1,
        fuzzDrive2: fuzzBlock.fuzzDrive2,
        fuzzDrive3: fuzzBlock.fuzzDrive3,
        fuzzClip1: fuzzBlock.fuzzClip1,
        fuzzClip2: fuzzBlock.fuzzClip2,
        fuzzClip3: fuzzBlock.fuzzClip3,
        fuzzRc1: fuzzBlock.fuzzRc1,
        fuzzRc2: fuzzBlock.fuzzRc2,
        fuzzBassFilter: fuzzBlock.fuzzBassFilter,
        fuzzBassGain: fuzzBlock.fuzzBassGain,
        fuzzTrebleFilter: fuzzBlock.fuzzTrebleFilter,
        fuzzTrebleGain: fuzzBlock.fuzzTrebleGain,
        fuzzToneSum: fuzzBlock.fuzzToneSum,
        fuzzToneInverter: fuzzBlock.fuzzToneInverter,
        fuzzWet: fuzzBlock.wet,
        fuzzDry: fuzzBlock.dry,
        reverbBlockInput: reverbBlock.blockInput,
        reverbBlockOutput: reverbBlock.blockOutput,
        springReverb: reverbBlock.reverb,
        springReverbFilter: reverbBlock.filter,
        springReverbPreEmphasis: reverbBlock.preEmphasis,
        springReverbInputGate: reverbBlock.inputGate,
        springReverbInputDrive: reverbBlock.inputDrive,
        springReverbInputSat: reverbBlock.inputSat,
        springReverbDeEmphasis: reverbBlock.deEmphasis,
        springReverbOutputSat: reverbBlock.outputSat,
        springReverbDry: reverbBlock.dry,
        springReverbWet: reverbBlock.wet,

        masterEqSat,
        postFxSat,

        fxInput,
        dryGain,
        analogShaper: fuzzBlock.analogShaper,
        ...ambience,
        busCompressor,
        masterGain,
        masterEQ,
        acCoupler,
        limiter: limiterNode.compressor,
        masterLowPass,
        analyser,
        outputGate
    };
};
