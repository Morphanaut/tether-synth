
import React, { useState, useCallback, useRef } from 'react';
import { SynthState, AssignTargets, MatrixSensitivities, LfoTarget } from '../types';
import { TEXTS, ASSIGN_TARGET_VALUES } from '../data/constants';
import { getTargetValue } from '../utils/targetValueUtils';
import XYPad from './XYPad';
import MatrixPad from './MatrixPad';
import { Button, ButtonGroup, PanelTitle } from './library/Controls';

// ============================================================================
// MAIN COMPONENT: MATRIX SECTION
// ============================================================================

interface MatrixSectionProps {
    params: SynthState;
    assignTargets: AssignTargets;
    setAssignTargets: React.Dispatch<React.SetStateAction<AssignTargets>>;
    sensitivities: MatrixSensitivities;
    setSensitivities: React.Dispatch<React.SetStateAction<MatrixSensitivities>>;
    onMacroMove: (dx: number, dy: number, isInstant: boolean) => void;
    triggerGate: (voiceId: 1 | 2, isOpen: boolean, force?: boolean, isInstant?: boolean) => void;
    setTargetValue: (target: LfoTarget, val: number) => void;
    setInteractionMode: (mode: 'smooth' | 'instant') => void;
}

const MatrixSection: React.FC<MatrixSectionProps> = React.memo(({
    params,
    assignTargets,
    setAssignTargets,
    sensitivities,
    setSensitivities,
    onMacroMove,
    triggerGate,
    setTargetValue,
    setInteractionMode
}) => {
    const [gateMode, setGateMode] = useState({ gate1: false, gate2: false });
    const [macroPos, setMacroPos] = useState({ x: 500, y: 500 });
    const macroPosRef = useRef({ x: 500, y: 500 });

    const handlePadGate = useCallback((isOpen: boolean, isInstant: boolean = false) => {
        if (gateMode.gate1) triggerGate(1, isOpen, false, isInstant);
        if (gateMode.gate2) triggerGate(2, isOpen, false, isInstant);
    }, [gateMode, triggerGate]);

    const handleMacroChange = useCallback((x: number, y: number, isInstant: boolean = false) => {
        const deltaX = x - macroPosRef.current.x;
        const deltaY = y - macroPosRef.current.y;
        macroPosRef.current = { x, y };
        setMacroPos({ x, y });
        onMacroMove(deltaX, deltaY, isInstant);
    }, [onMacroMove]);

    const getVal = (target: LfoTarget) => getTargetValue(params, target);

    const handleParamChange = (target: LfoTarget, val: number, isInstant?: boolean) => {
        setInteractionMode(isInstant ? 'instant' : 'smooth');
        setTargetValue(target, val);
    };

    const allowedAssignTargets = ASSIGN_TARGET_VALUES.filter(target => {
        if (target === 'osc1-pwm') return params.osc1.wave === 'square';
        if (target === 'osc2-pwm') return params.osc2.wave === 'square';
        return true;
    });

    return (
        <div className="border border-zinc-400 p-4 _b-panel">
            <div className="border-b border-zinc-800 pb-2 mb-4 flex justify-between items-end _b-widget">
                <PanelTitle>{TEXTS.pads.matrixTitle}</PanelTitle>
                <ButtonGroup>
                    <Button 
                        onClick={() => setGateMode(p => ({...p, gate1: !p.gate1}))} 
                        active={gateMode.gate1}
                    >
                        {TEXTS.pads.gate1Click}
                    </Button>
                    <Button 
                        onClick={() => setGateMode(p => ({...p, gate2: !p.gate2}))} 
                        active={gateMode.gate2}
                    >
                        {TEXTS.pads.gate2Click}
                    </Button>
                </ButtonGroup>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                    <XYPad 
                        label={TEXTS.pads.macro} 
                        xLabel="X" 
                        yLabel="Y" 
                        xValue={macroPos.x} 
                        yValue={macroPos.y} 
                        onChange={handleMacroChange} 
                        sensitivity={sensitivities.macro} 
                        onSensitivityChange={(v) => setSensitivities(p => ({...p, macro: v}))} 
                        sensitivityLabel={TEXTS.pads.macroSens} 
                        onGateTrigger={handlePadGate} 
                    />
                </div>
                
                <MatrixPad 
                    label={TEXTS.pads.assign1} 
                    xLabel={TEXTS.options.lfoTargets[assignTargets.pad1.x]} 
                    yLabel={TEXTS.options.lfoTargets[assignTargets.pad1.y]} 
                    xValue={getVal(assignTargets.pad1.x)} 
                    yValue={getVal(assignTargets.pad1.y)} 
                    xTarget={assignTargets.pad1.x} 
                    yTarget={assignTargets.pad1.y} 
                    sensitivity={sensitivities.assign1} 
                    allowedTargets={allowedAssignTargets}
                    allAssignTargets={assignTargets} 
                    onChange={(x, y, i) => { handleParamChange(assignTargets.pad1.x, x, i); handleParamChange(assignTargets.pad1.y, y, i); }} 
                    onSensitivityChange={(v) => setSensitivities(p => ({...p, assign1: v}))} 
                    onAssignX={(t) => setAssignTargets(p => ({...p, pad1: {...p.pad1, x: t}}))} 
                    onAssignY={(t) => setAssignTargets(p => ({...p, pad1: {...p.pad1, y: t}}))} 
                    onGateTrigger={handlePadGate} 
                />
                
                <MatrixPad 
                    label={TEXTS.pads.assign2} 
                    xLabel={TEXTS.options.lfoTargets[assignTargets.pad2.x]} 
                    yLabel={TEXTS.options.lfoTargets[assignTargets.pad2.y]} 
                    xValue={getVal(assignTargets.pad2.x)} 
                    yValue={getVal(assignTargets.pad2.y)} 
                    xTarget={assignTargets.pad2.x} 
                    yTarget={assignTargets.pad2.y} 
                    sensitivity={sensitivities.assign2} 
                    allowedTargets={allowedAssignTargets}
                    allAssignTargets={assignTargets} 
                    onChange={(x, y, i) => { handleParamChange(assignTargets.pad2.x, x, i); handleParamChange(assignTargets.pad2.y, y, i); }} 
                    onSensitivityChange={(v) => setSensitivities(p => ({...p, assign2: v}))} 
                    onAssignX={(t) => setAssignTargets(p => ({...p, pad2: {...p.pad2, x: t}}))} 
                    onAssignY={(t) => setAssignTargets(p => ({...p, pad2: {...p.pad2, y: t}}))} 
                    onGateTrigger={handlePadGate} 
                />
                
                <MatrixPad 
                    label={TEXTS.pads.assign3} 
                    xLabel={TEXTS.options.lfoTargets[assignTargets.pad3.x]} 
                    yLabel={TEXTS.options.lfoTargets[assignTargets.pad3.y]} 
                    xValue={getVal(assignTargets.pad3.x)} 
                    yValue={getVal(assignTargets.pad3.y)} 
                    xTarget={assignTargets.pad3.x} 
                    yTarget={assignTargets.pad3.y} 
                    sensitivity={sensitivities.assign3} 
                    allowedTargets={allowedAssignTargets}
                    allAssignTargets={assignTargets} 
                    onChange={(x, y, i) => { handleParamChange(assignTargets.pad3.x, x, i); handleParamChange(assignTargets.pad3.y, y, i); }} 
                    onSensitivityChange={(v) => setSensitivities(p => ({...p, assign3: v}))} 
                    onAssignX={(t) => setAssignTargets(p => ({...p, pad3: {...p.pad3, x: t}}))} 
                    onAssignY={(t) => setAssignTargets(p => ({...p, pad3: {...p.pad3, y: t}}))} 
                    onGateTrigger={handlePadGate} 
                />
                
                <MatrixPad 
                    label={TEXTS.pads.assign4} 
                    xLabel={TEXTS.options.lfoTargets[assignTargets.pad4.x]} 
                    yLabel={TEXTS.options.lfoTargets[assignTargets.pad4.y]} 
                    xValue={getVal(assignTargets.pad4.x)} 
                    yValue={getVal(assignTargets.pad4.y)} 
                    xTarget={assignTargets.pad4.x} 
                    yTarget={assignTargets.pad4.y} 
                    sensitivity={sensitivities.assign4} 
                    allowedTargets={allowedAssignTargets}
                    allAssignTargets={assignTargets} 
                    onChange={(x, y, i) => { handleParamChange(assignTargets.pad4.x, x, i); handleParamChange(assignTargets.pad4.y, y, i); }} 
                    onSensitivityChange={(v) => setSensitivities(p => ({...p, assign4: v}))} 
                    onAssignX={(t) => setAssignTargets(p => ({...p, pad4: {...p.pad4, x: t}}))} 
                    onAssignY={(t) => setAssignTargets(p => ({...p, pad4: {...p.pad4, y: t}}))} 
                    onGateTrigger={handlePadGate} 
                />
            </div>
        </div>
    );
});

export default MatrixSection;
