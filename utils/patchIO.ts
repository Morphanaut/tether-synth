import { LFO_TARGET_VALUES } from '../data/constants';
import type { AssignTargets, FxType, MatrixSensitivities, SynthPatch, SynthState } from '../types';

const DEFAULT_FX_ROUTING = ['delay', 'bitcrusher', 'fuzz', 'reverb'] as const;
const FX_TYPE_SET = new Set<FxType>(DEFAULT_FX_ROUTING);
const LFO_TARGET_SET = new Set<string>(LFO_TARGET_VALUES);
const REQUIRED_STATE_KEYS: readonly (keyof SynthState)[] = [
    'osc1', 'osc2', 'env1', 'env2',
    'modEnv1', 'modEnv2', 'oscMod',
    'lfo1', 'lfo2',
    'seq1', 'seq2', 'modSeq1', 'modSeq2',
    'global', 'noise'
];
const ASSIGN_PAD_KEYS = ['pad1', 'pad2', 'pad3', 'pad4'] as const;
const SENSITIVITY_KEYS = ['macro', 'assign1', 'assign2', 'assign3', 'assign4'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const isValidFxRouting = (value: unknown): value is FxType[] =>
    Array.isArray(value) && value.length > 0 && value.every(item => FX_TYPE_SET.has(item as FxType));

const isValidSynthStateShape = (value: unknown): value is SynthState => {
    if (!isRecord(value)) return false;
    return REQUIRED_STATE_KEYS.every((key) => isRecord(value[key]));
};

const isValidAssignTargets = (value: unknown): value is AssignTargets => {
    if (!isRecord(value)) return false;
    return ASSIGN_PAD_KEYS.every((padKey) => {
        const pad = value[padKey];
        return isRecord(pad) &&
            typeof pad.x === 'string' &&
            LFO_TARGET_SET.has(pad.x) &&
            typeof pad.y === 'string' &&
            LFO_TARGET_SET.has(pad.y);
    });
};

const isValidSensitivities = (value: unknown): value is MatrixSensitivities => {
    if (!isRecord(value)) return false;
    return SENSITIVITY_KEYS.every((key) => {
        const num = value[key];
        return typeof num === 'number' && Number.isFinite(num);
    });
};

export const savePatchFile = (
    params: SynthState,
    assignTargets: AssignTargets,
    sensitivities: MatrixSensitivities
): void => {
    const patch: SynthPatch = {
        meta: { version: '1.0.0', timestamp: Date.now() },
        data: { params, assignTargets, sensitivities }
    };

    const blob = new Blob([JSON.stringify(patch, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    try {
        const link = document.createElement('a');
        link.href = url;
        link.download = `tether-patch-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } finally {
        URL.revokeObjectURL(url);
    }
};

export const parsePatchData = (text: string): SynthPatch['data'] | null => {
    try {
        const patch = JSON.parse(text) as unknown;
        if (!isRecord(patch) || !isRecord(patch.data)) return null;

        const rawData = patch.data;
        if (!isValidSynthStateShape(rawData.params)) return null;
        if (!isValidAssignTargets(rawData.assignTargets)) return null;
        if (!isValidSensitivities(rawData.sensitivities)) return null;

        const loadedParams: SynthState = {
            ...rawData.params,
            global: { ...rawData.params.global }
        };

        if (!isValidFxRouting(loadedParams.global.fxRouting)) {
            loadedParams.global.fxRouting = [...DEFAULT_FX_ROUTING];
        }

        return {
            params: loadedParams,
            assignTargets: rawData.assignTargets,
            sensitivities: rawData.sensitivities
        };
    } catch {
        return null;
    }
};
