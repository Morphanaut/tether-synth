
import React, { useMemo } from 'react';
import { AssignTargets, LfoTarget, AssignPadState } from '../types';
import { TEXTS, TARGET_GROUPS } from '../data/constants';
import XYPad from './XYPad';
import { Label, Select } from './library/Controls';

interface MatrixPadProps {
    label: string;
    xLabel: string;
    yLabel: string;
    xValue: number;
    yValue: number;
    xTarget: LfoTarget;
    yTarget: LfoTarget;
    sensitivity: number;
    allowedTargets: readonly LfoTarget[];
    allAssignTargets: AssignTargets;
    onChange: (x: number, y: number, isInstant?: boolean) => void;
    onSensitivityChange: (val: number) => void;
    onAssignX: (target: LfoTarget) => void;
    onAssignY: (target: LfoTarget) => void;
    onGateTrigger: (isOpen: boolean, isInstant?: boolean) => void;
}

const MatrixPad: React.FC<MatrixPadProps> = React.memo(({
    label, xLabel, yLabel, xValue, yValue, xTarget, yTarget, sensitivity, allowedTargets, allAssignTargets,
    onChange, onSensitivityChange, onAssignX, onAssignY, onGateTrigger
}) => {

    const renderOptions = useMemo(() => {
        return (currentValue: string) => {
            const usedTargets = new Set<string>();
            Object.values(allAssignTargets).forEach((val) => {
                const p = val as AssignPadState;
                if (p.x !== 'none') usedTargets.add(p.x);
                if (p.y !== 'none') usedTargets.add(p.y);
            });

            return (
                <>
                    <option value="none" className="text-zinc-500 bg-black">NONE</option>
                    {TARGET_GROUPS.map(g => {
                        const opts = allowedTargets.filter(t => g.check(t) && (!usedTargets.has(t) || t === currentValue));
                        if (opts.length === 0) return null;
                        return (
                            <optgroup key={g.label} label={g.label} className="font-bold text-zinc-500 bg-zinc-900">
                                {opts.map(t => (
                                    <option key={t} value={t} className="text-zinc-300 bg-black font-normal">
                                        {TEXTS.options.lfoTargets[t as LfoTarget]}
                                    </option>
                                ))}
                            </optgroup>
                        );
                    })}
                </>
            );
        };
    }, [allAssignTargets, allowedTargets]);

    return (
        <XYPad
            label={label}
            xLabel={xLabel}
            yLabel={yLabel}
            xValue={xValue}
            yValue={yValue}
            onChange={onChange}
            sensitivity={sensitivity}
            onSensitivityChange={onSensitivityChange}
            onGateTrigger={onGateTrigger}
        >
            <div className="mt-2 flex gap-2">
                <div className="w-1/2">
                    <Label className="block mb-1.5">{TEXTS.pads.assignX}</Label>
                    <Select value={xTarget} onChange={v => onAssignX(v as LfoTarget)}>
                        {renderOptions(xTarget)}
                    </Select>
                </div>
                <div className="w-1/2">
                    <Label className="block mb-1.5">{TEXTS.pads.assignY}</Label>
                    <Select value={yTarget} onChange={v => onAssignY(v as LfoTarget)}>
                        {renderOptions(yTarget)}
                    </Select>
                </div>
            </div>
        </XYPad>
    );
});

export default MatrixPad;
