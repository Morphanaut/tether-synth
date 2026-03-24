# TETHER

Browser-based 6-voice semi-modular synthesizer built with the Web Audio API.

TETHER started as a rapid prototyping environment for analog synth ideas and gradually evolved into a full browser instrument focused on industrial textures, drones, noise, and lo-fi dungeon-synth atmospheres.

Web App: https://morphanaut.github.io/tether-synth/

Version: 1.1.0  
License: MIT

## Overview

TETHER combines a polyphonic subtractive engine, flexible modulation routing, sequencers, and a configurable FX chain in a browser-based instrument.

It was originally built as a noise and drone-oriented system, but over time grew into a broader synthesis environment with deeper routing, performance control, and patching flexibility.

## Compatibility

TETHER has been tested primarily in Google Chrome.

The desktop interface is currently designed for 1920x1080 displays at 100% scale and works best in full-screen mode.

Some browsers, especially Firefox, may still have problems initializing the audio engine through AudioWorklet. Cross-browser support remains an area for further refinement.

## Mobile Version

Starting with v1.1.0, TETHER includes a dedicated mobile control layout.

This update focuses on interface adaptation rather than new synthesis features:

- mobile navigation and control surface redesign
- same audio engine as the desktop version
- layout-focused release

## Core Features

### Polyphonic Engine

- 6 independent voices
- 2 oscillators per voice
- per-voice filter, drive, VCA, and pan

### Oscillators

- sine, triangle, saw, square
- frequency range: 0 Hz - 12 kHz
- octave switching in note mode: 32' / 16' / 8' / 4' / 2'
- pulse width control for square waves
- drone, manual gate, keyboard, and MIDI control
- MIDI CC mapping support

### Noise Section

- white, pink, and brown noise
- routable into oscillator paths
- dedicated noise FM paths

### Modulation System

Sources include:

- oscillator cross-modulation: FM / AM / Ring
- 2 LFOs
- 2 modulation envelopes
- 2 voice sequencers for pitch/gate
- 2 target modulation sequencers
- 4-pad XY macro system

Routing model:

- target-based modulation
- protected parameter ranges
- context-aware parameter activation
- for example, PWM is only available when the square waveform is active

### FX Chain

Configurable order:

`delay -> bitcrusher -> fuzz -> reverb`

Included effects:

- tape-style delay with sync/free modes and wow/flutter
- AudioWorklet bitcrusher
- multi-stage fuzz
- spring-style convolution reverb

### Master Section

- 7-band EQ
- bus compression
- soft saturation / safety stage
- limiter
- analyser

### Recorder

- up to 10 minutes of in-memory recording
- loop, reverse, and varispeed playback
- offline WAV export

## Signal Flow

### Per Voice

Oscillators A/B  
-> Filter and Drive  
-> VCA  
-> Stereo Pan  
-> Global Mix

Additional per-voice options:

- FM / AM / Ring cross-modulation
- optional internal feedback
- noise injection

### Noise Routing

Noise Source  
-> Noise Filter  
-> Per-Voice Routing  
-> Optional FM Routing

Supports white, pink, and brown noise.

### Global Processing

Summed Voices  
-> Master EQ  
-> FX Chain  
-> Bus Compression  
-> Master Gain  
-> Limiter  
-> Output

Default FX order:

Delay -> Bitcrusher -> Fuzz -> Reverb

### Ambience Layer

A constant low-level ambience layer, including hum and crackle, is injected after compression at the master stage.

## Architecture

The system is built around a dynamically constructed audio graph and a typed state model.

### Main Modules

- `App.tsx` - UI and state orchestration
- `useSynth.tsx` - runtime audio controller
- `useSequencerSystem.ts` - scheduler and timing
- `useMidiSystem.ts` - MIDI routing and mapping
- `useRecorder.tsx` - recording and export pipeline
- `audioGraph.ts` - graph construction and routing
- `nodeUpdater.ts` - state to AudioParam synchronization
- `nodeUpdaterHelpers.ts` - modulation routing helpers
- `utils/graph-builders/*` - voice, FX, and modulation graph factories
- `utils/audio-math/*` - scaling, modulation math, and curve utilities
- `patchIO.ts` - patch serialization and normalization

The architecture is designed to remain extensible, so new modulation targets, DSP blocks, and routing paths can be added without rebuilding the core system.

## Running Locally

### Requirements

- Node.js 20+
- modern browser

### Quick Start

```bash
npm ci
npm run dev
```

Production build and local preview:

```bash
npm run build -- --base=/
npm run preview
```

## Project Status

TETHER is in active development.

The interface, internal structure, and feature set continue to evolve. Minor releases may include both refactoring and functional changes.

## Contributing

If you want to contribute:

- open an issue first to describe the problem or proposal
- discuss architectural impact before large changes
- follow existing TypeScript patterns
- preserve modulation safety constraints

## License

MIT - see LICENSE.
