
// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Formats pan value for display
 * @param val - Pan value (0-1024, 512 = center)
 * @returns Formatted string ("CENTER", "L XX", or "R XX")
 */
export const getPanDisplay = (val: number): string => {
    if (val === 512) return "CENTER";
    if (val < 512) return `L ${Math.round((512 - val) / 5.12)}`;
    return `R ${Math.round((val - 512) / 5.12)}`;
};

/**
 * Calculates pulse width percentage for display
 * @param val - PWM value (0-1024)
 * @returns Percentage string (e.g., "25.0")
 */
export const calcPwmPercent = (val: number): string => {
    return (50 - (val / 1024) * 50).toFixed(1);
};
