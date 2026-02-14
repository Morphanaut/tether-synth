
import { LfoTarget, SynthState } from '../../types';
import {
    LFO_RATE_MAX,
    MOD_SCALE_PITCH, MOD_SCALE_FILTER, MOD_SCALE_RESONANCE,
    MOD_SCALE_FINE_TUNE, FM_DEVIATION_MAX
} from './common';
import { mapFmDeviation } from './scaling';
import { DELAY_FEEDBACK_MAX } from '../graph-builders/constants';

export const getModulationScale = (
    target: LfoTarget, 
    params: SynthState, 
    recursionDepth = 0
): number => {
    if (recursionDepth > 4) return 1.0;
    
    switch (target) {
        case 'osc1-freq':
        case 'osc2-freq':
            return MOD_SCALE_PITCH;
            
        case 'osc1-cutoff':
        case 'osc2-cutoff':
        case 'osc1-hp-cutoff':
        case 'osc2-hp-cutoff':
            return MOD_SCALE_FILTER;
            
        case 'osc1-pan':
        case 'osc2-pan':
        case 'osc1-gain':
        case 'osc2-gain':
        case 'osc1-pwm':
        case 'osc2-pwm':
            return 1.0;
            
        case 'osc1-res':
        case 'osc2-res':
        case 'osc1-hp-res':
        case 'osc2-hp-res':
            return MOD_SCALE_RESONANCE;
            
        case 'osc1-fine':
        case 'osc2-fine':
            return MOD_SCALE_FINE_TUNE;
        
        case 'lfo1-rate':
        case 'lfo2-rate':
            return LFO_RATE_MAX;
            
        case 'lfo1-depth':
            return getModulationScale(params.lfo1.target, params, recursionDepth + 1);
            
        case 'lfo2-depth':
            return getModulationScale(params.lfo2.target, params, recursionDepth + 1);
        
        case 'modEnv1-depth':
        case 'modEnv2-depth':
            return 1.0;
        
        case 'master-vol':
            return 1.0;
            
        case 'delay-time':
            return 0.5; 
            
        case 'delay-mix':
            return 1.0;
            
        case 'delay-feedback':
            return DELAY_FEEDBACK_MAX;
        
        case 'reverb-mix':
            return 1.35;
            
        case 'reverb-tone':
            return 24.0; 
        
        case 'fuzz-drive':
            return 10.0; 
            
        case 'fuzz-tone':
            return 1.0;
            
        case 'fuzz-mix':
            return 1.0;
            
        case 'bitcrusher-bits':
            // Total range is 3.0 bits (5.0 to 8.0). 
            // Max depth from a -1.0 to +1.0 LFO should be 1.5 to sweep the full range.
            return 1.5; 
            
        case 'bitcrusher-rate':
            // Scale by 0.5 because normalized frequency range 0.005 to 1.0 is ~1.0 total
            // This ensures LFO sweep is responsive but not constant aliasing.
            return 0.5;
            
        case 'bitcrusher-mix':
            return 1.0;
        
        case 'fm-1to2':
            if (params.oscMod.osc1to2.type === 'fm') {
                const dev = mapFmDeviation(params.oscMod.osc1to2.range);
                return Math.max(0, Math.min(20000, dev));
            }
            return 1.0;
            
        case 'fm-2to1':
            if (params.oscMod.osc2to1.type === 'fm') {
                const dev = mapFmDeviation(params.oscMod.osc2to1.range);
                return Math.max(0, Math.min(20000, dev));
            }
            return 1.0;
        
        case 'seq1-rate':
        case 'seq2-rate':
        case 'modSeq1-rate':
        case 'modSeq2-rate':
            return 1000.0; 

        case 'noise-cutoff':
            return MOD_SCALE_FILTER;

        case 'noise-res':
            return MOD_SCALE_RESONANCE; 
        
        case 'noise-sendA':
        case 'noise-sendB':
            return 1.0;
        
        case 'noise-fmA':
        case 'noise-fmB':
            return FM_DEVIATION_MAX;
        
        default:
            return 1.0;
    }
};
