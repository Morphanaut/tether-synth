# TETHER

Browser-based 6-voice semi-modular noise synthesizer built on the Web Audio API.

TETHER began as a rapid prototyping environment for analog synth design and evolved into a modular browser DSP instrument focused on industrial textures, drones, and lo-fi dungeon-synth aesthetics.

Web App: https://morphanaut.github.io/tether-synth/  
Version: 1.0.0  
License: MIT

## Overview

TETHER is designed as an exploratory synthesis platform.

It combines subtractive synthesis, cross-modulation, sequencers, modulation routing, and a configurable FX chain inside a browser environment.

## Core Principles

- modular signal graph architecture
- explicit state -> AudioParam synchronization
- protected modulation ranges
- extensible routing and target model
- real-time DSP via AudioWorklet

## Core Features

### Polyphonic Engine

- 6 independent voices
- dual oscillators per voice
- per-voice filter, drive, VCA, and pan

### AudioWorklet Oscillators

- waveforms: sine / triangle / saw / square
- frequency range: 0 Hz - 12000 Hz
- octave range (note mode): 32' / 16' / 8' / 4' / 2'
- pulse width control (square waveform)
- drone / manual gate / keyboard / MIDI control with CC mapping

### Noise Sources

- white / pink / brown
- routed injection into oscillator paths
- dedicated noise FM paths

### Global FX Chain

Configurable order:
`delay -> bitcrusher -> fuzz -> reverb`

Includes:

- tape-style delay (sync/free, wow/flutter)
- AudioWorklet bitcrusher
- multi-stage fuzz
- spring-style convolution reverb

### Master Bus

- 7-band EQ
- bus compression
- soft saturation / safety chain
- limiter
- analyser

### Modulation System

Sources:

- oscillator cross-modulation: FM / AM / Ring
- 2x LFO
- 2x modulation envelopes
- 2x voice sequencers (pitch/gate)
- 2x target modulation sequencers
- 4-pad XY macro system

Routing model:

- target-based modulation
- protected parameter ranges
- context-aware target gating
  (e.g. PWM active only when square waveform is selected)

### Recorder

- up to 10 minutes in-memory recording
- loop / reverse / varispeed
- offline WAV export

## Signal Flow (High-Level)

### Voice Layer (per voice)

Oscillators (A/B)
  -> Filters & Drive
  -> VCA
  -> Stereo Panning
  -> Global Mix

Additional per-voice behaviors:

- cross-modulation (FM / AM / Ring)
- optional internal feedback loop
- noise injection

### Noise Layer

Noise Source
  -> Noise Filter
  -> Per-Voice Routing
  -> Optional FM Routing

Supports white / pink / brown noise.

### Global Processing

Summed Voices
  -> Master EQ
  -> FX Chain (configurable order)
  -> Bus Compression
  -> Master Gain
  -> Limiter
  -> Output

Default FX order:
Delay -> Bitcrusher -> Fuzz -> Reverb

### Ambience Layer

Low-level background noise (hum / crackle) injected post-compression at the master stage.

## Architecture Snapshot

The system is built around a dynamically constructed audio graph and a typed state model.

## Key Modules

- App.tsx - UI and state orchestration
- useSynth.tsx - runtime audio controller
- useSequencerSystem.ts - scheduler and timing
- useMidiSystem.ts - MIDI routing and mapping
- useRecorder.tsx - recording and export pipeline
- audioGraph.ts - graph construction and routing
- nodeUpdater.ts - state -> AudioParam synchronization
- nodeUpdaterHelpers.ts - modulation routing helpers
- utils/graph-builders/* - voice, FX, and modulation graph factories
- utils/audio-math/* - scaling, modulation math, curve utilities
- patchIO.ts - patch serialization and normalization

The architecture is intentionally extensible.  
New modulation targets, DSP blocks, and routing paths can be introduced without restructuring the core graph.

## Running Locally

### Requirements

- Node.js 20+
- modern browser

### Quick Start

```bash
npm ci
npm run dev
```

Production build (local preview):

```bash
npm run build -- --base=/
npm run preview
```

## Project Status

Active development.

UI/UX and internal architecture continue to evolve.  
Refactoring and feature expansion may occur between minor releases.

## Contributing

If you want to contribute:

- open an issue describing the problem or proposal
- discuss architectural impact before large changes
- follow existing TypeScript patterns
- preserve modulation safety constraints

## Roadmap (High-Level)

- extended modulation routing matrix
- additional DSP processors
- deeper patch version compatibility
- performance profiling and optimization

## License

MIT License - see LICENSE.

Morphanaut // 2026

