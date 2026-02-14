
import React, { useCallback } from 'react';
import { OscillatorParams, EnvelopeParams, SynthState } from '../types';
import { WAVEFORMS, calcPwmPercent, TEXTS, OCTAVE_FOOTAGE } from '../data/constants';
import { mapFreq, mapCutoff, mapAttackTime, mapReleaseTime, mapPortamento } from '../utils/audioMath';
import { Button, ButtonGroup, Fader, Label, Row, Value, SubSectionTitle } from './library/Controls';

type OscUpdateLocal = <K extends keyof OscillatorParams>(key: K, value: OscillatorParams[K]) => void;
type EnvUpdateLocal = <K extends keyof EnvelopeParams>(key: K, value: EnvelopeParams[K]) => void;

interface OscillatorPanelProps {
  id: 1 | 2;
  label: string;
  subLabel: string;
  oscState: OscillatorParams;
  envState: EnvelopeParams;
  isSequencerRunning: boolean;
  activeKeys: boolean;
  isVOctGateActive: boolean;
  updateOsc: OscUpdateLocal;
  updateEnv: EnvUpdateLocal;
  toggleSequencer: () => void;
  toggleVoltOct: () => void;
  toggleDrone: () => void;
  toggleMidi: () => void;
}

const OscillatorPanel: React.FC<OscillatorPanelProps> = React.memo(({
  oscState, envState, isSequencerRunning, activeKeys, isVOctGateActive,
  updateOsc, updateEnv, toggleSequencer, toggleVoltOct, toggleDrone, toggleMidi, label, subLabel
}) => {
  const isActive = activeKeys || oscState.drone || isSequencerRunning || isVOctGateActive;
  const currentFootage = OCTAVE_FOOTAGE.find(o => o.value === oscState.octave)?.label || "8'";
  const isControlsVisible = oscState.voltOct || oscState.midi || isSequencerRunning;

  return (
    <div className={`border border-zinc-400 p-4 transition-colors _b-panel ${isActive ? 'bg-zinc-900 shadow-[inset_0_0_20px_rgba(255,255,255,0.05)]' : ''}`}>
      <div className="flex justify-between items-end border-b border-zinc-800 pb-2 mb-4 _b-widget">
        <div className="_t-panel-title">{label}</div>
        <div className="_t-panel-desc">{subLabel}</div>
      </div>
      
      <div className="flex justify-between items-center mb-6">
        <ButtonGroup>
          {WAVEFORMS.map(w => (
            <Button key={w.value} onClick={() => updateOsc('wave', w.value)} active={oscState.wave === w.value}>
              {w.label === 'SQR' ? TEXTS.osc.sqr : w.label}
            </Button>
          ))}
        </ButtonGroup>
        {isSequencerRunning ? (
          <Button onClick={toggleSequencer} active animate>{TEXTS.seq.title}</Button>
        ) : (
          <ButtonGroup>
            <Button onClick={toggleMidi} active={oscState.midi}>{TEXTS.osc.midi}</Button>
            <Button onClick={toggleVoltOct} active={oscState.voltOct}>{TEXTS.osc.voltOct}</Button>
            <Button onClick={toggleDrone} active={oscState.drone} animate={oscState.drone}>{TEXTS.osc.drone}</Button>
          </ButtonGroup>
        )}
      </div>

      <div className="grid gap-4 mb-6">
        {!isControlsVisible && (
          <div>
            <Row><Label>{TEXTS.osc.freq}</Label><Value>{mapFreq(oscState.freq).toFixed(0)} Hz</Value></Row>
            <Fader value={oscState.freq} onChange={v => updateOsc('freq', v)} />
          </div>
        )}
        {isControlsVisible && (
          <div className="animate-in fade-in slide-in-from-top-1 duration-200">
            <Row><Label>{TEXTS.osc.octave}</Label><Value>{currentFootage}</Value></Row>
            <ButtonGroup className="justify-between">
              {OCTAVE_FOOTAGE.map(opt => (
                  <Button key={opt.value} onClick={() => updateOsc('octave', opt.value)} active={oscState.octave === opt.value} className="flex-1">
                      {opt.label}
                  </Button>
              ))}
            </ButtonGroup>
          </div>
        )}
        {isControlsVisible && (
          <div className="animate-in fade-in slide-in-from-top-1 duration-200">
            <Row><Label>{TEXTS.osc.fine}</Label><Value>{((oscState.fineTune - 512) / 5.12).toFixed(1)}%</Value></Row>
            <Fader 
                value={oscState.fineTune} 
                onChange={v => {
                    const snapped = Math.abs(v - 512) < 8 ? 512 : v;
                    updateOsc('fineTune', snapped);
                }} 
            />
          </div>
        )}
        {isControlsVisible && (
          <div className="animate-in fade-in slide-in-from-top-1 duration-200">
            <Row><Label>{TEXTS.osc.glide}</Label><Value>{mapPortamento(oscState.portamento).toFixed(2)} s</Value></Row>
            <Fader value={oscState.portamento} onChange={v => updateOsc('portamento', v)} />
          </div>
        )}
        
        {oscState.wave === 'square' && (
          <div className="animate-in fade-in slide-in-from-top-1 duration-200">
            <Row>
              <Label>{TEXTS.osc.width}</Label>
              <Value>{calcPwmPercent(oscState.pwm)}%</Value>
            </Row>
            <Fader value={oscState.pwm} onChange={v => updateOsc('pwm', v)} />
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-zinc-800 mb-6 _b-widget">
        <SubSectionTitle className="mb-6">{TEXTS.osc.filter}</SubSectionTitle>
        <div className="grid gap-4">
          <div>
            <Row><Label>{TEXTS.osc.hpCutoff}</Label><Value>{mapCutoff(oscState.hpCutoff).toFixed(0)} Hz</Value></Row>
            <Fader value={oscState.hpCutoff} onChange={v => updateOsc('hpCutoff', v)} />
          </div>
          <div>
            <Row><Label>{TEXTS.osc.hpResonance}</Label><Value>{Math.round(oscState.hpResonance / 10.24)}%</Value></Row>
            <Fader value={oscState.hpResonance} onChange={v => updateOsc('hpResonance', v)} />
          </div>
          <div>
            <Row><Label>{TEXTS.osc.cutoff}</Label><Value>{mapCutoff(oscState.cutoff).toFixed(0)} Hz</Value></Row>
            <Fader value={oscState.cutoff} onChange={v => updateOsc('cutoff', v)} />
          </div>
          <div>
            <Row><Label>{TEXTS.osc.resonance}</Label><Value>{Math.round(oscState.resonance / 10.24)}%</Value></Row>
            <Fader value={oscState.resonance} onChange={v => updateOsc('resonance', v)} />
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-zinc-800 _b-widget">
        <SubSectionTitle className="mb-6">{TEXTS.osc.env}</SubSectionTitle>
        <div className="grid gap-4">
          <div>
              <Row><Label>{TEXTS.osc.attack}</Label><Value>{mapAttackTime(envState.attack).toFixed(2)} s</Value></Row>
              <Fader value={envState.attack} onChange={v => updateEnv('attack', v)} />
          </div>
          <div>
              <Row><Label>{TEXTS.osc.release}</Label><Value>{mapReleaseTime(envState.release).toFixed(2)} s</Value></Row>
              <Fader value={envState.release} onChange={v => updateEnv('release', v)} />
          </div>
        </div>
      </div>
    </div>
  );
});

interface VoiceSectionProps {
    params: SynthState;
    activeGateKeys: { osc1: boolean; osc2: boolean };
    isVOctGateActive1: boolean;
    isVOctGateActive2: boolean;
    updateOsc: <K extends keyof OscillatorParams>(osc: 'osc1' | 'osc2', key: K, value: OscillatorParams[K]) => void;
    updateEnv: <K extends keyof EnvelopeParams>(env: 'env1' | 'env2', key: K, value: EnvelopeParams[K]) => void;
    toggleSequencer: () => void;
    toggleVoltOct: (id: 1 | 2) => void;
    toggleDrone: (id: 1 | 2) => void;
    toggleMidi: (id: 1 | 2) => void;
}

const VoiceSection: React.FC<VoiceSectionProps> = React.memo(({
    params,
    activeGateKeys,
    isVOctGateActive1,
    isVOctGateActive2,
    updateOsc,
    updateEnv,
    toggleSequencer,
    toggleVoltOct,
    toggleDrone,
    toggleMidi
}) => {
    const updateOsc1 = useCallback<OscUpdateLocal>((k, v) => updateOsc('osc1', k, v), [updateOsc]);
    const updateEnv1 = useCallback<EnvUpdateLocal>((k, v) => updateEnv('env1', k, v), [updateEnv]);
    const toggleVoltOct1 = useCallback(() => toggleVoltOct(1), [toggleVoltOct]);
    const toggleDrone1 = useCallback(() => toggleDrone(1), [toggleDrone]);
    const toggleMidi1 = useCallback(() => toggleMidi(1), [toggleMidi]);

    const updateOsc2 = useCallback<OscUpdateLocal>((k, v) => updateOsc('osc2', k, v), [updateOsc]);
    const updateEnv2 = useCallback<EnvUpdateLocal>((k, v) => updateEnv('env2', k, v), [updateEnv]);
    const toggleVoltOct2 = useCallback(() => toggleVoltOct(2), [toggleVoltOct]);
    const toggleDrone2 = useCallback(() => toggleDrone(2), [toggleDrone]);
    const toggleMidi2 = useCallback(() => toggleMidi(2), [toggleMidi]);

    return (
        <div className="grid grid-cols-2 gap-4 mb-6">
            <OscillatorPanel
                id={1}
                label={`${TEXTS.osc.title} A`}
                subLabel={TEXTS.osc.keys1}
                oscState={params.osc1}
                envState={params.env1}
                isSequencerRunning={params.seq1.isRunning}
                activeKeys={activeGateKeys.osc1}
                isVOctGateActive={isVOctGateActive1}
                updateOsc={updateOsc1}
                updateEnv={updateEnv1}
                toggleSequencer={toggleSequencer}
                toggleVoltOct={toggleVoltOct1}
                toggleDrone={toggleDrone1}
                toggleMidi={toggleMidi1}
            />
            <OscillatorPanel
                id={2}
                label={`${TEXTS.osc.title} B`}
                subLabel={TEXTS.osc.keys2}
                oscState={params.osc2}
                envState={params.env2}
                isSequencerRunning={params.seq2.isRunning}
                activeKeys={activeGateKeys.osc2}
                isVOctGateActive={isVOctGateActive2}
                updateOsc={updateOsc2}
                updateEnv={updateEnv2}
                toggleSequencer={toggleSequencer}
                toggleVoltOct={toggleVoltOct2}
                toggleDrone={toggleDrone2}
                toggleMidi={toggleMidi2}
            />
        </div>
    );
});

export default VoiceSection;

