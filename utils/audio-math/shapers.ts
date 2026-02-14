
import { CURVE_SAMPLES } from './common';

export const makeBigMuffClipCurve = (): Float32Array => {
    const curve = new Float32Array(CURVE_SAMPLES);
    const threshold = 0.16;
    const knee = 0.03;

    for (let i = 0; i < CURVE_SAMPLES; i++) {
        const x = (i * 2) / CURVE_SAMPLES - 1;
        const absX = Math.abs(x);
        const sign = Math.sign(x) || 1;
        const linearEnd = threshold - knee;
        const clipStart = threshold + knee;

        if (absX <= linearEnd) {
            curve[i] = x / threshold;
            continue;
        }

        if (absX >= clipStart) {
            curve[i] = sign;
            continue;
        }

        const t = (absX - linearEnd) / (clipStart - linearEnd);
        const smooth = t * t * (3 - 2 * t);
        const yLinear = absX / threshold;
        const y = yLinear + (1 - yLinear) * smooth;
        curve[i] = sign * y;
    }

    return curve;
};

export const makeSpringInputCurve = (): Float32Array => {
    const curve = new Float32Array(CURVE_SAMPLES);
    for (let i = 0; i < CURVE_SAMPLES; i++) {
        const x = (i * 2) / CURVE_SAMPLES - 1;
        let y: number;
        if (x >= 0) {
            y = Math.tanh(x * 1.6) * 0.92;
        } else {
            y = Math.tanh(x * 1.9) * 0.88;
        }
        curve[i] = y;
    }
    return curve;
};

export const makeSpringOutputCurve = (): Float32Array => {
    const curve = new Float32Array(CURVE_SAMPLES);
    for (let i = 0; i < CURVE_SAMPLES; i++) {
        const x = (i * 2) / CURVE_SAMPLES - 1;
        const y = x / (1 + 0.28 * Math.abs(x));
        curve[i] = y * 1.1;
    }
    return curve;
};

export const makePT2399SaturationCurve = (): Float32Array => {
    const curve = new Float32Array(CURVE_SAMPLES);
    for (let i = 0; i < CURVE_SAMPLES; i++) {
        const x = (i * 2) / CURVE_SAMPLES - 1;
        let y: number;
        if (x >= 0) y = Math.tanh(x * 1.2) * 0.92;
        else y = Math.tanh(x * 0.9);
        y += 0.03 * x * x * Math.sign(x);
        curve[i] = y;
    }
    return curve;
};

export const makeConsoleSaturationCurve = (): Float32Array => {
    const curve = new Float32Array(CURVE_SAMPLES);
    for (let i = 0; i < CURVE_SAMPLES; i++) {
        const x = (i * 2) / CURVE_SAMPLES - 1;
        if (x > 0) curve[i] = x / (1 + x * 0.3);
        else curve[i] = x / (1 + Math.abs(x) * 0.6);
        curve[i] *= 1.1;
    }
    return curve;
};

export const makeWarmthCurve = (amount: number = 0.12): Float32Array => {
  const samples = 8192;
  const curve = new Float32Array(samples);
  const a = Math.max(0, Math.min(0.5, amount));

  for (let i = 0; i < samples; i++) {
    const x = (i * 2 / samples) - 1;
    const t = Math.tanh(x);
    curve[i] = (1 - a) * x + a * (t / 0.7615941559557649);
  }
  return curve;
};

export const PWM_CURVE_SAMPLES = 1024;
const PWM_HALF = PWM_CURVE_SAMPLES / 2;
export const PWM_SHAPER_CURVE = new Float32Array(PWM_CURVE_SAMPLES);
for (let i = 0; i < PWM_CURVE_SAMPLES; i++) {
    PWM_SHAPER_CURVE[i] = i < PWM_HALF ? -1 : 1;
}

export const IDENTITY_CURVE = new Float32Array(PWM_CURVE_SAMPLES);
for (let i = 0; i < PWM_CURVE_SAMPLES; i++) {
    IDENTITY_CURVE[i] = (i - PWM_HALF) / PWM_HALF;
}

export const CACHED_WARMTH_006 = makeWarmthCurve(0.06);
export const CACHED_WARMTH_007 = makeWarmthCurve(0.07);
export const CACHED_WARMTH_008 = makeWarmthCurve(0.08);
export const CACHED_WARMTH_010 = makeWarmthCurve(0.10);
export const CACHED_PT2399_SAT = makePT2399SaturationCurve();
export const CACHED_BIG_MUFF = makeBigMuffClipCurve();
export const CACHED_CONSOLE_SAT = makeConsoleSaturationCurve();
export const CACHED_SPRING_INPUT = makeSpringInputCurve();
export const CACHED_SPRING_OUTPUT = makeSpringOutputCurve();


