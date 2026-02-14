
import { LfoTarget } from './targets';

// ============================================================================
// MIDI TYPES
// ============================================================================

/**
 * MIDI CC to parameter mapping.
 */
export interface MidiMapping {
  /** MIDI CC number (0-127) */
  cc: number;
  /** Parameter to control */
  target: LfoTarget;
  /** Minimum output value (default: 0) */
  min?: number;
  /** Maximum output value (default: 1024) */
  max?: number;
}

/**
 * MIDI input configuration.
 */
export interface MidiConfig {
  /** Selected MIDI input device name */
  inputName: string | null;
  /** Enable 6-voice polyphonic mode */
  polyphonic: boolean;
  /** Active CC mappings */
  mappings: MidiMapping[];
}
