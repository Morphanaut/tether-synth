import React from 'react';
import { MODAL } from '../data/constants';
import { useModalDismiss } from '../hooks/useModalDismiss';

interface InstructionsModalProps { isOpen: boolean; onClose: () => void; isMobile?: boolean; }

const KeyCap: React.FC<{ char: string; label?: string; wide?: boolean; }> = ({ char, label, wide = false }) => (
    <div className="flex flex-col items-center gap-1.5">
        <div className={`${wide ? 'w-24' : 'w-8 md:w-10'} _c-btn _t-btn _b-widget border _s-inactive select-none !font-bold`}>
            {char}
        </div>
        {label && <span className={`${MODAL.TYPO.META} !text-[6px] md:!text-[7px] tracking-tight uppercase`}>{label}</span>}
    </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="mb-12 last:mb-0">
        <h3 className={`${MODAL.TYPO.SUB_TITLE} border-b border-zinc-800 pb-2 mb-6 tracking-[0.2em] font-bold`}>{title}</h3>
        <div className="space-y-5">
            {children}
        </div>
    </div>
);

const Detail: React.FC<{ label: string; text: string | React.ReactNode }> = ({ label, text }) => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <div className={`${MODAL.TYPO.DT} md:col-span-1 opacity-80 uppercase text-[9px] font-bold pt-1.5`}>{label}</div>
        <div className={`${MODAL.TYPO.BODY} md:col-span-3 text-left leading-relaxed`}>{text}</div>
    </div>
);

const InstructionsModal: React.FC<InstructionsModalProps> = ({ isOpen, onClose, isMobile = false }) => {
  const { handleOverlayPointerDown, handleOverlayClick, handlePanelPointerDown, handlePanelClick } =
    useModalDismiss({ isOpen, onClose, overlayCloseCooldownMs: 180 });

  if (!isOpen) return null;

  return (
    <div className={MODAL.LAYOUT.OVERLAY} onPointerDown={handleOverlayPointerDown} onClick={handleOverlayClick}>
       <div className={`${MODAL.LAYOUT.PANEL} w-full max-w-5xl max-h-[90vh]`} onPointerDown={handlePanelPointerDown} onClick={handlePanelClick}>
          <div className={MODAL.LAYOUT.HEADER}>
             <div className="flex items-center gap-3">
                <h2 className={MODAL.TYPO.TITLE}>{isMobile ? 'USER MANUAL' : 'TETHER // USER MANUAL'}</h2>
             </div>
             <button onClick={onClose} className="_c-btn-close">CLOSE</button>
          </div>
          <div className={MODAL.LAYOUT.BODY}>
              
              <Section title="01. STARTUP">
                  <Detail
                      label="Environment"
                      text={isMobile
                          ? "Use a modern mobile browser (Safari/Chrome). On iPhone, tap Share -> Add to Home Screen, then open Tether from the Home Screen icon. This launches it in fullscreen standalone mode (app-like workflow without regular browser chrome), which is better for focused touch performance."
                          : "Use a modern browser (Chrome/Edge recommended). Audio settings like sample rate follow your device/browser defaults."}
                  />
              </Section>

              <Section title={isMobile ? "02. MOBILE KEYBOARD" : "02. KEYBOARD & GATE"}>
                  {isMobile ? (
                      <>
                          <Detail
                              label="Open Keyboard"
                              text="Open the Keyboard screen from the mobile bottom menu. The keyboard opens as a dedicated full-screen control surface."
                          />
                          <Detail
                              label="Orientation"
                              text="If rotation warning appears, rotate the phone to landscape and continue. Keyboard play is available only after landscape confirmation."
                          />
                          <Detail
                              label="Top Controls"
                              text="Use OSC A / OSC B mode buttons (KBD, DRONE, OFF), OCT -, OCT +, and MONO/POLY/HOLD directly in the top keyboard bar."
                          />
                          <Detail
                              label="Play Logic"
                              text="Tap keys to trigger notes, then slide across keys for continuous performance. In MONO one note is active; in POLY up to 6 notes can be active."
                          />
                          <Detail
                              label="Hold"
                              text="HOLD latches notes. Tapping the same held key again removes its latch. In MONO, latch follows one active note; in POLY, latches can stack up to polyphony limit."
                          />
                          <Detail
                              label="Quick Controls"
                              text="The mobile keyboard screen includes assignable macro faders with target selectors, so you can tweak core synth parameters while playing."
                          />
                          <Detail
                              label="Exit"
                              text="Use the chevron-back icon in the top bar to close keyboard view and return to the previous mobile section."
                          />
                      </>
                  ) : (
                      <>
                          <div className="bg-black/40 p-6 border border-zinc-800 _b-widget border mb-4">
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                  <div className="flex flex-col gap-6">
                                      <span className={MODAL.TYPO.DT}>VOICE A (LOWER MANUAL)</span>
                                      <div className="flex gap-1.5 flex-wrap">
                                          {['Z', 'S', 'X', 'D', 'C', 'V', 'G', 'B', 'H', 'N', 'J', 'M', ','].map((k, i) =>
                                              <KeyCap key={k} char={k} label={['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C'][i]} />
                                          )}
                                      </div>
                                      <div className="mt-2"><KeyCap char="A" label="GATE TRIGGER A" wide /></div>
                                  </div>
                                  <div className="flex flex-col gap-6">
                                      <span className={MODAL.TYPO.DT}>VOICE B (UPPER MANUAL)</span>
                                      <div className="flex gap-1.5 flex-wrap">
                                          {['Q', '2', 'W', '3', 'E', 'R', '5', 'T', '6', 'Y', '7', 'U', 'I'].map((k, i) =>
                                              <KeyCap key={k} char={k} label={['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C'][i]} />
                                          )}
                                      </div>
                                      <div className="mt-2"><KeyCap char="F" label="GATE TRIGGER B" wide /></div>
                                  </div>
                              </div>
                          </div>
                          <Detail label="KBD Mode" text="Note keys work when the corresponding oscillator has 'KBD' enabled and neither DRONE nor VOICE SEQ is active." />
                          <Detail label="Gate Keys" text="'A' and 'F' trigger gate manually for OSC A / OSC B." />
                      </>
                  )}
              </Section>

              <Section title="03. VOICE CORE">
                  <Detail label="Oscillators" text="Two oscillators (A/B) with SIN, TRI, SAW, and SQR waveforms." />
                  <Detail label="Filters" text="Each voice has both HP and LP filters, each with cutoff and resonance controls." />
                  <Detail label="Envelopes" text="Amp envelopes are Attack/Release per voice." />
                  <Detail
                      label="Pitch Control"
                      text={isMobile
                          ? "In free mode, use FREQ directly. In KBD/SEQ workflows, use SCALE, FINE TUNE, and GLIDE."
                          : "In free mode, use FREQ directly. In KBD/MIDI/SEQ workflows, use SCALE, FINE TUNE, and GLIDE."}
                  />
                  <Detail label="Pulse Width" text="PULSE WIDTH appears only for SQR and moves one-way from 50% down to 0%." />
              </Section>

              <Section title="04. MODULATION">
                  <Detail label="Cross-Mod" text="Bidirectional OSC A<->B modulation with FM, AM, or RING. Source can be RAW or FLT." />
                  <Detail label="LFO 1 / 2" text="Each LFO supports FREE rate (Hz) or SYNC mode (BPM + division + TAP)." />
                  <Detail label="Mod Envelopes" text="MOD ENV 1/2 provide Attack, Release, Delay, Depth, and assignable target routing." />
              </Section>

              <Section title="05. SEQUENCERS">
                  <Detail label="Voice Seq" text="Two 8-step voice sequencers with step drawing, per-step gate buttons, direction (FWD/REV/RND), STEP, RST, and RND pattern generation." />
                  <Detail label="Sync Logic" text="Seq B can run free or sync to Seq A with selectable sync ratio. FREE/SYNC rate mode is available with BPM/division in sync mode." />
                  <Detail label="Mod Seq" text="Two 8-step modulation sequencers with target routing, direction, step editing, randomization, and independent sync options." />
              </Section>

              <Section title="06. VECTOR MATRIX">
                  <Detail label="Macro Pad" text="'VECTOR MACRO' applies relative movement to all assigned pads, scaled by GLOBAL SENSITIVITY." />
                  <Detail label="Assignable Pads" text="Pads 1-4 each control X/Y targets with individual sensitivities for performance macros." />
                  <Detail label="Gate On Click" text="Optional gate triggers can fire OSC A and/or OSC B when using matrix pads." />
              </Section>

              <Section title="07. FX & NOISE">
                  <Detail label="Signal Chain" text="Drag DELAY/CRUSH/FUZZ/REVERB blocks to reorder processing." />
                  <Detail label="FX Scope" text="Each FX block has global ENABLED/BYPASSED state and is applied in the shared post-voice chain (VOICES -> FX -> MASTER)." />
                  <Detail label="Delay / Reverb / Fuzz / Crush" text="All modules expose dedicated parameter controls. Delay supports FREE/SYNC timing with BPM and TAP." />
                  <Detail label="Noise Generator" text="WHITE/PINK/BROWN noise with OSC FLT or DIRECT routing, filter controls, send levels, and FM sends to both oscillators." />
              </Section>

              <Section title="08. MIXER & ANALYSIS">
                  <Detail label="Mixer" text="Master level + per-channel gain/pan for OSC A and OSC B." />
                  <Detail label="Graphic EQ" text="7-band master EQ is available from the MIXER panel via the 'EQ' button." />
                  {!isMobile && (
                      <Detail label="Visualizers" text="Real-time oscilloscope and spectrum analyzer are shown in the bottom-left visualizer panel." />
                  )}
              </Section>

              <Section title="09. TAPE DECK">
                  <Detail label="Record / Playback" text="Record the master output (up to 10 minutes), then use STOP/PLAY/RESET with LOOP, RND, and REV controls." />
                  <Detail label="Loop Selection" text="Drag on the waveform to define a loop region. Click without drag to seek and clear loop selection." />
                  <Detail label="Speed & Export" text="Use SPEED (0.2x-1.8x) and export as RAW, LOOP, or SPEED WAV depending on your workflow." />
              </Section>

              <Section title={isMobile ? "10. SAVE & LOAD" : "10. SAVE, LOAD, MIDI"}>
                  <Detail label="Patch Save/Load" text="Main SAVE/LOAD stores synth parameters, matrix assignments, and matrix sensitivities in JSON patch files." />
                  <Detail label="Recorder Data" text="Patch files do not contain recorded audio. Export audio separately from TAPE DECK." />
                  {!isMobile && (
                      <Detail label="MIDI Config" text="MIDI panel supports device selection, monophonic/polyphonic (6-voice) note handling, CC learn mapping, MIN/MAX scaling, and map save/load." />
                  )}
              </Section>

          </div>
          <div className={`${MODAL.LAYOUT.FOOTER} text-center flex justify-center items-center`}>
              <p className={MODAL.TYPO.FOOTNOTE}>TETHER // WEB-BASED NOISE SYNTHESIZER // SYSTEM ARCHITECTURE BY MORPHANAUT // 2026 // v1.1.0</p>
          </div>
       </div>
    </div>
  )
}
export default InstructionsModal;

