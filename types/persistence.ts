
import { LfoTarget } from './targets';
import { SynthState } from './state';

// ============================================================================
// PERSISTENCE TYPES
// ============================================================================

/**
 * XY pad assignment state.
 */
export interface AssignPadState {
  /** X-axis target */
  x: LfoTarget;
  /** Y-axis target */
  y: LfoTarget;
}

/**
 * All assignable XY pads.
 */
export interface AssignTargets {
  pad1: AssignPadState;
  pad2: AssignPadState;
  pad3: AssignPadState;
  pad4: AssignPadState;
}

/**
 * Sensitivity settings for modulation matrices.
 */
export interface MatrixSensitivities {
  /** Main macro sensitivity */
  macro: number;
  /** Assign pad 1 sensitivity */
  assign1: number;
  /** Assign pad 2 sensitivity */
  assign2: number;
  /** Assign pad 3 sensitivity */
  assign3: number;
  /** Assign pad 4 sensitivity */
  assign4: number;
}

/**
 * Complete patch file format for saving/loading.
 */
export interface SynthPatch {
  /** Patch metadata */
  meta: {
    /** File format version */
    version: string;
    /** Creation timestamp (Unix ms) */
    timestamp: number;
  };
  /** Patch data */
  data: {
    /** Synth parameters */
    params: SynthState;
    /** XY pad assignments */
    assignTargets: AssignTargets;
    /** Matrix sensitivities */
    sensitivities: MatrixSensitivities;
  };
}
