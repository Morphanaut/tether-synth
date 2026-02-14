
import { LfoTarget, SeqDirection } from '../types';

export const TEXTS = {
    title: "TETHER",
    subtitle: "WEB-BASED NOISE SYNTHESIZER",
    initSystem: "INITIALIZE SYSTEM",
    
    mixer: {
        title: "MIXER",
        subTitle: "LEVEL CONTROL AND EQ",
        master: "MASTER OUTPUT",
        ch1: "OSC A CHANNEL",
        ch2: "OSC B CHANNEL",
        gain: "GAIN"
    },
    
    recorder: {
        title: "TAPE DECK",
        subTitle: "RECORD UP TO 10 MIN",
        dlRaw: "DOWNLOAD RAW",
        dlLoop: "DOWNLOAD LOOP",
        dlSpeed: "DOWNLOAD SPEED"
    },
    
    osc: {
        title: "OSC",
        keys1: "KEYS [Z-M] MANUAL [A]",
        keys2: "KEYS [Q-I] MANUAL [F]",
        voltOct: "KBD",
        midi: "MIDI",
        drone: "DRONE",
        freq: "FREQ",
        octave: "SCALE",
        fine: "FINE TUNE",
        glide: "GLIDE",
        cutoff: "LP CUTOFF",
        resonance: "LP RES",
        hpCutoff: "HP CUTOFF",
        hpResonance: "HP RES",
        filter: "FILTER",
        width: "PULSE WIDTH",
        sqr: "SQR",
        env: "AMP ENVELOPE",
        attack: "ATTACK",
        release: "RELEASE"
    },
    
    mod: {
        title: "OSC CROSS MODULATION",
        amount: "AMOUNT",
        range: "FM RANGE",
        to: ">",
        raw: "RAW",
        filter: "FLT"
    },
    
    modEnv: {
        title: "MODULATION ENVELOPES",
        subTitle: "GATE TRIGGERED ENVELOPE",
        mod1: "MOD ENVELOPE 1",
        mod2: "MOD ENVELOPE 2",
        delay: "DELAY",
        depth: "DEPTH"
    },
    
    lfo: {
        sectionTitle: "LFO MODULATION",
        title: "LFO",
        rate: "RATE",
        depth: "DEPTH",
        target: "TARGET",
        div: "DIVISION"
    },
    
    delay: {
        title: "DELAY",
        time: "TIME",
        feedback: "FEEDBACK",
        drywet: "DRY / WET",
        mode: "MODE",
        bpm: "BPM",
        div: "DIV",
        tap: "TAP"
    },
    
    bitcrusher: {
        title: "BITCRUSHER",
        bits: "RESOLUTION",
        rate: "SAMPLE RATE",
        mix: "MIX"
    },
    
    springReverb: {
        title: "REVERBERATOR",
        mix: "MIX",
        tone: "COLOR",
        decay: "DECAY"
    },
    
    fuzz: {
        title: "FUZZ",
        drive: "DRIVE",
        tone: "TONE",
        mix: "MIX"
    },
    
    noise: {
        title: "NOISE GENERATOR",
        type: "TYPE",
        sendA: "SEND OSC A",
        sendB: "SEND OSC B",
        cutoff: "CUTOFF",
        resonance: "RESONANCE",
        fmA: "FM SEND A",
        fmB: "FM SEND B"
    },
    
    seq: {
        title: "VOICE SEQUENCER",
        master: "MASTER",
        phaseRst: "PHASE RST",
        linked: "LINKED",
        unlinked: "UNLINKED",
        target: "TARGET",
        direction: "DIRECTION",
        syncRatio: "SYNC RATIO",
        rate: "RATE",
        running: "Running",
        start: "Start",
        step: "Step",
        rnd: "Rnd",
        gate: "GATE",
        reset: "RST",
        linkDig: "TO VSEQ",
        free: "UNLINKED",
        div: "DIVISION"
    },
    
    modSeq: {
        title: "MODULATION SEQUENCER",
        run: "RUN MOD"
    },
    
    pads: {
        matrixTitle: "VECTOR MATRIX",
        macro: "VECTOR MACRO",
        macroSens: "GLOBAL SENSITIVITY",
        assign1: "ASSIGNABLE 1",
        assign2: "ASSIGNABLE 2",
        assign3: "ASSIGNABLE 3",
        assign4: "ASSIGNABLE 4",
        assignX: "ASSIGN X",
        assignY: "ASSIGN Y",
        gate1Click: "GATE A ONCLICK",
        gate2Click: "GATE B ONCLICK"
    },
    
    options: {
        lfoTargets: {
            'none': 'NONE',
            'osc1-freq': 'OSC A FREQ',
            'osc1-cutoff': 'OSC A LP CUT',
            'osc1-res': 'OSC A LP RES',
            'osc1-hp-cutoff': 'OSC A HP CUT',
            'osc1-hp-res': 'OSC A HP RES',
            'osc1-pan': 'OSC A PAN',
            'osc1-gain': 'OSC A GAIN',
            'osc1-pwm': 'OSC A PWM',
            'osc1-fine': 'OSC A FINE',
            'osc2-freq': 'OSC B FREQ',
            'osc2-cutoff': 'OSC B LP CUT',
            'osc2-res': 'OSC B LP RES',
            'osc2-hp-cutoff': 'OSC B HP CUT',
            'osc2-hp-res': 'OSC B HP RES',
            'osc2-pan': 'OSC B PAN',
            'osc2-gain': 'OSC B GAIN',
            'osc2-pwm': 'OSC B PWM',
            'osc2-fine': 'OSC B FINE',
            'lfo1-rate': 'LFO1 RATE',
            'lfo1-depth': 'LFO1 DPTH',
            'lfo2-rate': 'LFO2 RATE',
            'lfo2-depth': 'LFO2 DPTH',
            'modEnv1-depth': 'M.ENV1 AMT',
            'modEnv2-depth': 'M.ENV2 AMT',
            'seq1-rate': 'SEQ A RATE',
            'seq2-rate': 'SEQ B RATE',
            'modSeq1-rate': 'MODSEQ1 RATE',
            'modSeq2-rate': 'MODSEQ2 RATE',
            'fm-1to2': 'OSC A > B AMOUNT',
            'fm-2to1': 'OSC B > A AMOUNT',
            'master-vol': 'MASTER VOL',
            'noise-cutoff': 'NOISE CUTOFF',
            'noise-res': 'NOISE RES',
            'noise-sendA': 'NOISE > OSC A',
            'noise-sendB': 'NOISE > OSC B',
            'noise-fmA': 'NOISE FM A',
            'noise-fmB': 'NOISE FM B',
            'delay-time': 'DLAY TIME',
            'delay-mix': 'DLAY MIX',
            'delay-feedback': 'DLAY FDBK',
            'reverb-mix': 'REV MIX',
            'reverb-tone': 'REV COLOR',
            'fuzz-drive': 'FUZZ DRIVE',
            'fuzz-tone': 'FUZZ TONE',
            'fuzz-mix': 'FUZZ MIX',
            'bitcrusher-bits': 'BITS RES',
            'bitcrusher-rate': 'BITS RATE',
            'bitcrusher-mix': 'BITS MIX'
        } satisfies Record<LfoTarget, string>,
        
        directions: {
            'fwd': 'FWD',
            'rev': 'REV',
            'rnd': 'RND'
        } satisfies Record<SeqDirection, string>
    },
    
    storage: {
        save: "SAVE STATE",
        load: "LOAD STATE"
    },
    
    footer: {
        descTitle: "TETHER SYNTH//DIGITAL NOISE SYNTHESIZER",
        descBody: "6-VOICE POLYPHONIC SYNTHESIZER WITH DUAL OSCILLATORS, CROSS-MODULATION, MATRIX CONTROL, SEQUENCING, EFFECTS, AND TAPE DECK RECORDING.",
        version: "CODE VERSION V1.0.0",
        credit: "SYSTEM ARCHITECTURE BY MORPHANAUT // 2026",
        license: "MIT LICENSE"
    },
    
    routing: {
        title: "SIGNAL CHAIN",
        labels: {
            delay: "DELAY",
            bitcrusher: "CRUSH",
            fuzz: "FUZZ",
            reverb: "REVERB"
        }
    }
} as const;

