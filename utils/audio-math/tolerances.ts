
export interface VoiceTolerances {
    osc1Freq: number[];
    osc2Freq: number[];
    osc1FineCents: number[];
    osc2FineCents: number[];
    osc1Gain: number[];
    osc2Gain: number[];
    osc1Pwm: number[];
    osc2Pwm: number[];
    osc1Cutoff: number[];
    osc2Cutoff: number[];
    osc1HpCutoff: number[];
    osc2HpCutoff: number[];
    osc1Res: number[];
    osc2Res: number[];
    osc1HpRes: number[];
    osc2HpRes: number[];
    panOffset1: number[];
    panOffset2: number[];
    fm1to2: number[];
    fm2to1: number[];
    am1to2: number[];
    am2to1: number[];
}

export interface AnalogTolerances {
    lfo1Rate: number;
    lfo2Rate: number;
    noiseCutoff: number;
    noiseResonance: number;
    noiseSendA: number;
    noiseSendB: number;
    noiseFmA: number;
    noiseFmB: number;
    voice: VoiceTolerances;
}

export const generateTolerances = (voiceCount = 6): AnalogTolerances => {
    const drift = (amount: number): number => 1 + (Math.random() * amount * 2 - amount);
    const offset = (amount: number): number => Math.random() * amount * 2 - amount;
    const voiceArray = (amount: number): number[] =>
        Array.from({ length: voiceCount }, () => drift(amount));
    const voiceOffsets = (amount: number): number[] =>
        Array.from({ length: voiceCount }, () => offset(amount));

    return {
        lfo1Rate: drift(0.04),
        lfo2Rate: drift(0.04),
        noiseCutoff: drift(0.03),
        noiseResonance: drift(0.05),
        noiseSendA: drift(0.04),
        noiseSendB: drift(0.04),
        noiseFmA: drift(0.06),
        noiseFmB: drift(0.06),
        voice: {
            osc1Freq: voiceArray(0.015),
            osc2Freq: voiceArray(0.015),
            osc1FineCents: voiceOffsets(4.0),
            osc2FineCents: voiceOffsets(4.0),
            osc1Gain: voiceArray(0.05),
            osc2Gain: voiceArray(0.05),
            osc1Pwm: voiceArray(0.03),
            osc2Pwm: voiceArray(0.03),
            osc1Cutoff: voiceArray(0.04),
            osc2Cutoff: voiceArray(0.04),
            osc1HpCutoff: voiceArray(0.05),
            osc2HpCutoff: voiceArray(0.05),
            osc1Res: voiceArray(0.06),
            osc2Res: voiceArray(0.06),
            osc1HpRes: voiceArray(0.06),
            osc2HpRes: voiceArray(0.06),
            panOffset1: voiceOffsets(0.03),
            panOffset2: voiceOffsets(0.03),
            fm1to2: voiceArray(0.05),
            fm2to1: voiceArray(0.05),
            am1to2: voiceArray(0.05),
            am2to1: voiceArray(0.05)
        }
    };
};

