
// ============================================================================
// MUSICAL CONSTANTS & MAPPINGS
// ============================================================================

/**
 * Standard A4 reference frequency (Hz)
 */
const A4_FREQ = 440;

/**
 * Calculates frequency for a given semitone offset from A4
 */
const noteFreq = (semitones: number): number => A4_FREQ * Math.pow(2, semitones / 12);

// Note frequencies for C4 octave (Middle C = C4 = MIDI 60)
export const NOTE_FREQS = {
    C4:  noteFreq(-9),   // 261.63 Hz
    Cs4: noteFreq(-8),   // 277.18 Hz (C#4/Db4)
    D4:  noteFreq(-7),   // 293.66 Hz
    Ds4: noteFreq(-6),   // 311.13 Hz (D#4/Eb4)
    E4:  noteFreq(-5),   // 329.63 Hz
    F4:  noteFreq(-4),   // 349.23 Hz
    Fs4: noteFreq(-3),   // 369.99 Hz (F#4/Gb4)
    G4:  noteFreq(-2),   // 392.00 Hz
    Gs4: noteFreq(-1),   // 415.30 Hz (G#4/Ab4)
    A4:  noteFreq(0),    // 440.00 Hz
    As4: noteFreq(1),    // 466.16 Hz (A#4/Bb4)
    B4:  noteFreq(2),    // 493.88 Hz
    C5:  noteFreq(3),    // 523.25 Hz
} as const;

/**
 * Computer keyboard to frequency mapping for Oscillator 1
 * Layout: Z-M row = C4 to C5 chromatic scale
 * Black keys on S, D, G, H, J
 */
export const KEYBOARD_MAP_OSC1: Readonly<Record<string, number>> = {
    // White keys (C major scale)
    'z': NOTE_FREQS.C4,   // C4
    'x': NOTE_FREQS.D4,   // D4
    'c': NOTE_FREQS.E4,   // E4
    'v': NOTE_FREQS.F4,   // F4
    'b': NOTE_FREQS.G4,   // G4
    'n': NOTE_FREQS.A4,   // A4
    'm': NOTE_FREQS.B4,   // B4
    ',': NOTE_FREQS.C5,   // C5
    // Black keys (sharps/flats)
    's': NOTE_FREQS.Cs4,  // C#4
    'd': NOTE_FREQS.Ds4,  // D#4
    'g': NOTE_FREQS.Fs4,  // F#4
    'h': NOTE_FREQS.Gs4,  // G#4
    'j': NOTE_FREQS.As4,  // A#4
};

/**
 * Computer keyboard to frequency mapping for Oscillator 2
 * Layout: Q-I row = C4 to C5 chromatic scale
 * Black keys on 2, 3, 5, 6, 7
 */
export const KEYBOARD_MAP_OSC2: Readonly<Record<string, number>> = {
    // White keys (C major scale)
    'q': NOTE_FREQS.C4,   // C4
    'w': NOTE_FREQS.D4,   // D4
    'e': NOTE_FREQS.E4,   // E4
    'r': NOTE_FREQS.F4,   // F4
    't': NOTE_FREQS.G4,   // G4
    'y': NOTE_FREQS.A4,   // A4
    'u': NOTE_FREQS.B4,   // B4
    'i': NOTE_FREQS.C5,   // C5
    // Black keys (sharps/flats)
    '2': NOTE_FREQS.Cs4,  // C#4
    '3': NOTE_FREQS.Ds4,  // D#4
    '5': NOTE_FREQS.Fs4,  // F#4
    '6': NOTE_FREQS.Gs4,  // G#4
    '7': NOTE_FREQS.As4,  // A#4
};
