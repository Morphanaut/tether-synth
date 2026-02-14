/** Maximum recording duration in seconds (10 minutes) */
export const MAX_RECORDING_DURATION = 10 * 60;

/**
 * Maximum duration allowed for offline rendering (Varispeed Export).
 * 5 Minutes @ 48kHz Stereo Float32 ~= 115MB raw data + processing overhead.
 */
export const MAX_OFFLINE_RENDER_DURATION = 300;

/** Micro-fade duration for click prevention (seconds) */
export const FADE_DURATION = 0.005;

/** Playback speed range */
export const SPEED_MIN = 0.2;
export const SPEED_MAX = 1.8;
export const SPEED_CENTER = 1.0;
export const SPEED_RANGE = SPEED_MAX - SPEED_MIN; // 1.6

/** Magnetic snap threshold for speed slider (0-1024 scale) */
export const SPEED_SNAP_THRESHOLD = 16;

/** Random loop timing bounds (ms) */
export const RANDOM_LOOP_MIN_MS = 200;
export const RANDOM_LOOP_MAX_MS = 2000;
export const RANDOM_LOOP_MIN_DURATION = 0.05; // 50ms minimum loop

/** Tolerance for floating point comparisons (seconds) */
export const TIME_EPSILON = 0.001;

/** UI update rate limit (ms) to prevent React render thrashing */
export const UI_UPDATE_INTERVAL = 100;
