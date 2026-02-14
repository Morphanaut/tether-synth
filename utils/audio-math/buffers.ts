import { validateAudioContext, NOISE_BUFFER_DURATION } from './common';

export const createBrownNoiseBuffer = (ctx: AudioContext): AudioBuffer => {
    validateAudioContext(ctx);
    const bufferSize = Math.floor(ctx.sampleRate * NOISE_BUFFER_DURATION);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5;
    }
    return buffer;
};

export const createCrackleBuffer = (ctx: AudioContext): AudioBuffer => {
    validateAudioContext(ctx);
    const bufferSize = Math.floor(ctx.sampleRate * 5);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const crackleThreshold = 0.9999;
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() > crackleThreshold ? (Math.random() * 2 - 1) * 0.8 : 0;
    }
    return buffer;
};

export const createWhiteNoiseBuffer = (ctx: AudioContext): AudioBuffer => {
    validateAudioContext(ctx);
    const bufferSize = Math.floor(ctx.sampleRate * NOISE_BUFFER_DURATION);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
};

export const createPinkNoiseBuffer = (ctx: AudioContext): AudioBuffer => {
    validateAudioContext(ctx);
    const bufferSize = Math.floor(ctx.sampleRate * NOISE_BUFFER_DURATION);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        data[i] *= 0.11;
        b6 = white * 0.115926;
    }
    return buffer;
};

/**
 * Creates highly diffuse spring reverb impulse response.
 * Uses jittered reflections and burst-spreading to avoid delay-like artifacts.
 */
export const createSpringImpulseResponse = (
    ctx: AudioContext, 
    decayVal: number = 500
): AudioBuffer => {
    validateAudioContext(ctx);
    const rate = ctx.sampleRate;
    
    const safeDecay = Math.max(0, Math.min(1024, decayVal));
    // FLOOR adjusted to 0.02s (20ms). 
    // This allows for almost instant decay (transducer slap only).
    const seconds = 0.02 + Math.pow(safeDecay / 1024, 2.0) * 4.98;
    const length = Math.ceil(rate * seconds);
    const impulse = ctx.createBuffer(2, length, rate);
    
    // SPRING PARAMETERS - More diffuse, less discrete
    const springs = [
        { baseDelay: 23, jitter: 8, decay: 0.88, brightness: 0.6 },
        { baseDelay: 41, jitter: 12, decay: 0.84, brightness: 0.45 },
        { baseDelay: 67, jitter: 15, decay: 0.80, brightness: 0.3 },
    ];
    
    const chirpFreqs = [
        { freq: 145, amp: 0.12, decay: 0.25 },
        { freq: 320, amp: 0.09, decay: 0.20 },
        { freq: 580, amp: 0.07, decay: 0.15 },
        { freq: 920, amp: 0.05, decay: 0.12 },
        { freq: 1650, amp: 0.03, decay: 0.08 },
    ];

    for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        const channelOffset = channel * 0.18;
        
        // --- LAYER 1: DENSE DIFFUSION (Main Body) ---
        let lpState1 = 0;
        let lpState2 = 0;
        const decayPower = 2.0 + (safeDecay / 1024) * 1.2;
        
        for (let i = 0; i < length; i++) {
            const n = i / length;
            const envelope = Math.pow(1 - n, decayPower);
            const damping = 0.15 + n * 0.75; 
            const noise = Math.random() * 2 - 1;
            lpState1 = lpState1 + (noise - lpState1) * (1 - damping * 0.7);
            lpState2 = lpState2 + (lpState1 - lpState2) * (1 - damping * 0.5);
            data[i] = lpState2 * envelope * 0.55;
        }
        
        // --- LAYER 2: SPRING MODES (Smeared Echoes) ---
        for (const spring of springs) {
            let accumDelay = 0;
            let echoLp = 0;
            for (let bounce = 0; bounce < 20; bounce++) {
                const thisDelay = spring.baseDelay + (Math.random() - 0.5) * spring.jitter;
                accumDelay += thisDelay;
                const idx = Math.floor((accumDelay / 1000) * rate);
                if (idx >= length) break;
                const bounceAmp = Math.pow(spring.decay, bounce * 0.7);
                const burstLen = Math.floor(rate * (0.012 + Math.random() * 0.008));
                
                for (let j = 0; j < burstLen && (idx + j) < length; j++) {
                    const burstN = j / burstLen;
                    const burstEnv = Math.sin(burstN * Math.PI) * 0.7 + Math.exp(-burstN * 3) * 0.3;
                    const noise = (Math.random() * 2 - 1) * spring.brightness;
                    echoLp = echoLp * 0.6 + noise * 0.4;
                    data[idx + j] += echoLp * bounceAmp * burstEnv * 0.12;
                }
            }
        }
        
        // --- LAYER 3: CHIRP RESONANCES ---
        for (const chirp of chirpFreqs) {
            const omega = 2 * Math.PI * chirp.freq / rate;
            const decayRate = Math.exp(-chirp.decay / (rate * 0.001));
            let amp = chirp.amp * (0.8 + Math.random() * 0.4);
            let phase = Math.random() * Math.PI * 2 + channelOffset;
            const startSample = Math.floor(rate * 0.008);
            const endSample = Math.min(length, Math.floor(rate * 0.6));
            for (let i = startSample; i < endSample; i++) {
                amp *= decayRate;
                phase += omega * (1 + (Math.random() - 0.5) * 0.002); 
                data[i] += Math.sin(phase) * amp;
            }
        }
        
        // --- LAYER 4: EARLY REFLECTIONS (Smeared) ---
        const reflections = [6, 11, 17, 24, 33, 45];
        for (const ms of reflections) {
            const idx = Math.floor((ms / 1000) * rate);
            if (idx >= length) continue;
            const smearLen = Math.floor(rate * 0.003);
            const baseAmp = 0.06 * (1 - ms / 60); 
            for (let j = 0; j < smearLen && (idx + j) < length; j++) {
                const smearEnv = Math.exp(-j / (smearLen * 0.4));
                const noise = (Math.random() * 2 - 1);
                data[idx + j] += noise * baseAmp * smearEnv;
            }
        }
        
        // --- LAYER 5: INITIAL ATTACK ---
        const attackLen = Math.floor(rate * 0.015);
        for (let i = 0; i < attackLen; i++) {
            const env = Math.sin((i / attackLen) * Math.PI);
            const noise = (Math.random() * 2 - 1);
            data[i] += noise * env * 0.15 * (channel === 0 ? 1 : 0.85);
        }
        
        // --- POST-PROCESSING: DIFFUSION PASS ---
        let allpass1 = 0, allpass2 = 0;
        const apCoeff = 0.6;
        for (let i = 0; i < length; i++) {
            const input = data[i];
            const temp = input + allpass1 * apCoeff;
            allpass1 = input - temp * apCoeff;
            const temp2 = temp + allpass2 * apCoeff * 0.5;
            allpass2 = temp - temp2 * apCoeff * 0.5;
            data[i] = temp2 * 0.85 + input * 0.15;
        }
    }
    
    // Normalization
    let maxAbs = 0;
    for (let ch = 0; ch < 2; ch++) {
        const d = impulse.getChannelData(ch);
        for (let i = 0; i < d.length; i++) {
            if (Math.abs(d[i]) > maxAbs) maxAbs = Math.abs(d[i]);
        }
    }
    if (maxAbs > 0.001) {
        const factor = 0.82 / maxAbs;
        for (let ch = 0; ch < 2; ch++) {
            const d = impulse.getChannelData(ch);
            for (let i = 0; i < d.length; i++) d[i] *= factor;
        }
    }
    return impulse;
};