
import React, { useState, useCallback } from 'react';
import ModulationSection from './ModulationSection';
import EffectsSection from './EffectsSection';
import MatrixSection from './MatrixSection';
import VoiceSequencerSection from './VoiceSequencerSection';
import ModSequencerSection from './ModSequencerSection';
import RackTabButton from './RackTabButton';
import { SynthState, AssignTargets, MatrixSensitivities, LfoTarget, LfoParams, ModPathParams, ModEnvelopeParams, GlobalParams, NoiseGeneratorParams, SequencerParams } from '../types';

type RackTab = 'MOD' | 'SEQ' | 'MATRIX' | 'FX';

interface RackSectionProps {
    params: SynthState;
    assignTargets: AssignTargets;
    setAssignTargets: React.Dispatch<React.SetStateAction<AssignTargets>>;
    sensitivities: MatrixSensitivities;
    setSensitivities: React.Dispatch<React.SetStateAction<MatrixSensitivities>>;
    onMacroMove: (dx: number, dy: number, isInstant: boolean) => void;
    triggerGate: (voiceId: 1 | 2, isOpen: boolean, force?: boolean, isInstant?: boolean) => void;
    setTargetValue: (target: LfoTarget, val: number) => void;
    setInteractionMode: (mode: 'smooth' | 'instant') => void;
    updateLfo: <K extends keyof LfoParams>(id: 1 | 2, key: K, value: LfoParams[K]) => void;
    updateModPath: <K extends keyof ModPathParams>(path: 'osc1to2' | 'osc2to1', key: K, value: ModPathParams[K]) => void;
    updateModEnv: <K extends keyof ModEnvelopeParams>(id: 1 | 2, key: K, value: ModEnvelopeParams[K]) => void;
    onLfoTapTempo: (id: 1 | 2) => void;
    updateGlobal: <K extends keyof GlobalParams>(key: K, value: GlobalParams[K]) => void;
    updateNoise: <K extends keyof NoiseGeneratorParams>(key: K, value: NoiseGeneratorParams[K]) => void;
    onTapTempo: () => void;
    currentStep1: number;
    currentStep2: number;
    currentStepMod1: number;
    currentStepMod2: number;
    updateSeq: <K extends keyof SequencerParams>(seq: 'seq1' | 'seq2' | 'modSeq1' | 'modSeq2', key: K, value: SequencerParams[K]) => void;
    updateSeqStep: (seq: 'seq1' | 'seq2' | 'modSeq1' | 'modSeq2', index: number, value: number) => void;
    toggleSeqGate: (seq: 'seq1' | 'seq2', index: number) => void;
    toggleSequencer: () => void;
    toggleModSequencer: () => void;
    syncSequencers: () => void;
    syncModSequencers: () => void;
    syncModToMaster: () => void;
    manualSeqStep: (id: 1 | 2) => void;
    manualModSeqStep: (id: 1 | 2) => void;
    resetSequencer: (id: 1 | 2) => void;
    resetModSequencer: (id: 1 | 2) => void;
    randomizePattern: (seq: 'seq1' | 'seq2' | 'modSeq1' | 'modSeq2') => void;
}

const RackSection: React.FC<RackSectionProps> = React.memo((props) => {
    const [activeTab, setActiveTab] = useState<RackTab>('MOD');
    const handleModTab = useCallback(() => setActiveTab('MOD'), []);
    const handleSeqTab = useCallback(() => setActiveTab('SEQ'), []);
    const handleMatrixTab = useCallback(() => setActiveTab('MATRIX'), []);
    const handleFxTab = useCallback(() => setActiveTab('FX'), []);

    const renderContent = () => {
        switch (activeTab) {
            case 'MOD':
                return (
                    <ModulationSection 
                        lfo1={props.params.lfo1}
                        lfo2={props.params.lfo2}
                        osc1Wave={props.params.osc1.wave}
                        osc2Wave={props.params.osc2.wave}
                        oscMod={props.params.oscMod}
                        modEnv1={props.params.modEnv1}
                        modEnv2={props.params.modEnv2}
                        updateLfo={props.updateLfo}
                        updateModPath={props.updateModPath}
                        updateModEnv={props.updateModEnv}
                        onLfoTapTempo={props.onLfoTapTempo}
                    />
                );
            case 'SEQ':
                return (
                    <div className="animate-in fade-in duration-300 flex flex-col gap-6">
                        <VoiceSequencerSection 
                            params={props.params}
                            currentStep1={props.currentStep1}
                            currentStep2={props.currentStep2}
                            updateSeq={props.updateSeq}
                            updateSeqStep={props.updateSeqStep}
                            toggleSeqGate={props.toggleSeqGate}
                            toggleSequencer={props.toggleSequencer}
                            syncSequencers={props.syncSequencers}
                            manualSeqStep={props.manualSeqStep}
                            resetSequencer={props.resetSequencer}
                            randomizePattern={props.randomizePattern}
                        />
                        <ModSequencerSection 
                            params={props.params}
                            currentStepMod1={props.currentStepMod1}
                            currentStepMod2={props.currentStepMod2}
                            updateSeq={props.updateSeq}
                            updateSeqStep={props.updateSeqStep}
                            toggleModSequencer={props.toggleModSequencer}
                            syncModSequencers={props.syncModSequencers}
                            syncModToMaster={props.syncModToMaster}
                            manualModSeqStep={props.manualModSeqStep}
                            resetModSequencer={props.resetModSequencer}
                            randomizePattern={props.randomizePattern}
                        />
                    </div>
                );
            case 'MATRIX':
                return (
                    <MatrixSection 
                        params={props.params}
                        assignTargets={props.assignTargets}
                        setAssignTargets={props.setAssignTargets}
                        sensitivities={props.sensitivities}
                        setSensitivities={props.setSensitivities}
                        onMacroMove={props.onMacroMove}
                        triggerGate={props.triggerGate}
                        setTargetValue={props.setTargetValue}
                        setInteractionMode={props.setInteractionMode}
                    />
                );
            case 'FX':
                return (
                    <EffectsSection 
                        global={props.params.global}
                        noise={props.params.noise}
                        updateGlobal={props.updateGlobal}
                        updateNoise={props.updateNoise}
                        onTapTempo={props.onTapTempo}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className="flex-1 flex flex-col bg-black min-w-0">
            <div className="flex w-full border-b border-zinc-800">
                <RackTabButton label="MODULATION" isActive={activeTab === 'MOD'} onClick={handleModTab} />
                <RackTabButton label="SEQUENCER" isActive={activeTab === 'SEQ'} onClick={handleSeqTab} />
                <RackTabButton label="MATRIX" isActive={activeTab === 'MATRIX'} onClick={handleMatrixTab} />
                <RackTabButton label="EFFECTS" isActive={activeTab === 'FX'} onClick={handleFxTab} isLast />
            </div>
            
            <div className="flex-1 overflow-y-auto px-6 py-6">
                {renderContent()}
            </div>
        </div>
    );
});

export default RackSection;

