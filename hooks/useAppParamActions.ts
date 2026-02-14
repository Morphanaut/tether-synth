import { useCallback } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type {
    EnvelopeParams,
    LfoParams,
    ModEnvelopeParams,
    ModPathParams,
    NoiseGeneratorParams,
    OscillatorParams,
    SequencerParams,
    GlobalParams,
    SynthState
} from '../types';

interface UseAppParamActionsArgs {
    setParams: Dispatch<SetStateAction<SynthState>>;
    notifyUiControlRef: MutableRefObject<() => void>;
}

export const useAppParamActions = ({ setParams, notifyUiControlRef }: UseAppParamActionsArgs) => {
    // Basic parameter groups.
    const updateOsc = useCallback(<K extends keyof OscillatorParams>(osc: 'osc1' | 'osc2', key: K, value: OscillatorParams[K]) => {
        // Mark UI as control source before state update so smoothing path uses UI profile.
        notifyUiControlRef.current();
        setParams(prev => {
            if (prev[osc][key] === value) return prev;
            return { ...prev, [osc]: { ...prev[osc], [key]: value } };
        });
    }, [setParams, notifyUiControlRef]);

    const updateGlobal = useCallback(<K extends keyof GlobalParams>(key: K, value: GlobalParams[K]) => {
        notifyUiControlRef.current();
        setParams(prev => {
            if (prev.global[key] === value) return prev;
            return { ...prev, global: { ...prev.global, [key]: value } };
        });
    }, [setParams, notifyUiControlRef]);

    const updateNoise = useCallback(<K extends keyof NoiseGeneratorParams>(key: K, value: NoiseGeneratorParams[K]) => {
        notifyUiControlRef.current();
        setParams(prev => {
            if (prev.noise[key] === value) return prev;
            return { ...prev, noise: { ...prev.noise, [key]: value } };
        });
    }, [setParams, notifyUiControlRef]);

    // Modulation groups.
    const updateLfo = useCallback(<K extends keyof LfoParams>(id: 1 | 2, key: K, value: LfoParams[K]) => {
        notifyUiControlRef.current();
        const lfo = id === 1 ? 'lfo1' : 'lfo2';
        setParams(prev => {
            if (prev[lfo][key] === value) return prev;
            return { ...prev, [lfo]: { ...prev[lfo], [key]: value } };
        });
    }, [setParams, notifyUiControlRef]);

    const updateEnv = useCallback(<K extends keyof EnvelopeParams>(env: 'env1' | 'env2', key: K, value: EnvelopeParams[K]) => {
        notifyUiControlRef.current();
        setParams(prev => {
            if (prev[env][key] === value) return prev;
            return { ...prev, [env]: { ...prev[env], [key]: value } };
        });
    }, [setParams, notifyUiControlRef]);

    const updateModEnv = useCallback(<K extends keyof ModEnvelopeParams>(id: 1 | 2, key: K, value: ModEnvelopeParams[K]) => {
        notifyUiControlRef.current();
        const env = id === 1 ? 'modEnv1' : 'modEnv2';
        setParams(prev => {
            if (prev[env][key] === value) return prev;
            return { ...prev, [env]: { ...prev[env], [key]: value } };
        });
    }, [setParams, notifyUiControlRef]);

    const updateModPath = useCallback(<K extends keyof ModPathParams>(path: 'osc1to2' | 'osc2to1', key: K, value: ModPathParams[K]) => {
        notifyUiControlRef.current();
        setParams(prev => {
            if (prev.oscMod[path][key] === value) return prev;
            return {
                ...prev,
                oscMod: { ...prev.oscMod, [path]: { ...prev.oscMod[path], [key]: value } }
            };
        });
    }, [setParams, notifyUiControlRef]);

    // Sequencer state helpers.
    const updateSeq = useCallback(<K extends keyof SequencerParams>(seq: 'seq1' | 'seq2' | 'modSeq1' | 'modSeq2', key: K, value: SequencerParams[K]) => {
        notifyUiControlRef.current();
        setParams(prev => {
            if (prev[seq][key] === value) return prev;
            const newState = { ...prev };
            newState[seq] = { ...newState[seq], [key]: value };
            return newState;
        });
    }, [setParams, notifyUiControlRef]);

    const updateSeqStep = useCallback((seq: 'seq1' | 'seq2' | 'modSeq1' | 'modSeq2', index: number, value: number) => {
        notifyUiControlRef.current();
        setParams(prev => {
            if (prev[seq].steps[index] === value) return prev;
            const newSteps = [...prev[seq].steps];
            newSteps[index] = value;
            return { ...prev, [seq]: { ...prev[seq], steps: newSteps } };
        });
    }, [setParams, notifyUiControlRef]);

    const toggleSeqGate = useCallback((seq: 'seq1' | 'seq2', index: number) => {
        notifyUiControlRef.current();
        setParams(prev => {
            const newGates = [...prev[seq].gates];
            newGates[index] = !newGates[index];
            return { ...prev, [seq]: { ...prev[seq], gates: newGates } };
        });
    }, [setParams, notifyUiControlRef]);

    const randomizePattern = useCallback((seq: 'seq1' | 'seq2' | 'modSeq1' | 'modSeq2') => {
        notifyUiControlRef.current();
        const newSteps = Array(8).fill(0).map(() => Math.floor(Math.random() * 1024));
        const newGates = Array(8).fill(0).map(() => Math.random() > 0.3);
        setParams(prev => ({ ...prev, [seq]: { ...prev[seq], steps: newSteps, gates: newGates } }));
    }, [setParams, notifyUiControlRef]);

    // API used by App sections and controls.
    return {
        updateOsc,
        updateGlobal,
        updateNoise,
        updateLfo,
        updateEnv,
        updateModEnv,
        updateModPath,
        updateSeq,
        updateSeqStep,
        toggleSeqGate,
        randomizePattern
    };
};

