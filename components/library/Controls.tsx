
import React from 'react';
import { TYPO, BTN_ACTIVE, BTN_INACTIVE } from '../../data/constants';

// ============================================================================
// ATOMIC UI PRIMITIVES
// ============================================================================

interface BaseProps {
    className?: string;
    disabled?: boolean;
}

// --- TYPOGRAPHY ---

/**
 * Label primitive.
 *
 * Important: many places use <Label> purely as a visual caption next to a slider,
 * not as a real HTML <label> associated with a form control.
 *
 * To avoid a11y warnings ("No label associated") we only render a real <label>
 * when htmlFor is provided; otherwise we render a <span>.
 */
export const Label: React.FC<{ children: React.ReactNode; className?: string; htmlFor?: string }> = ({ children, className = "", htmlFor }) => {
    if (htmlFor) {
        return <label htmlFor={htmlFor} className={`${TYPO.LABEL} ${className}`}>{children}</label>;
    }

    return <span className={`${TYPO.LABEL} ${className}`}>{children}</span>;
};

export const Value: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
    <span className={`${TYPO.VALUE} ${className}`}>{children}</span>
);

export const PanelTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className={TYPO.PANEL_TITLE}>{children}</div>
);

export const SubSectionTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
    <div className={`${TYPO.SUB_SECTION} ${className}`}>{children}</div>
);

export const Row: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
    <div className={`flex justify-between mb-1.5 items-baseline ${className}`}>{children}</div>
);

// --- INPUTS ---

interface FaderProps extends BaseProps {
    id?: string;
    name?: string;
    ariaLabel?: string;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    orientation?: 'horizontal' | 'vertical';
    onChange: (val: number) => void;
}

export const Fader: React.FC<FaderProps> = React.memo(({ id, name, ariaLabel, value, onChange, min = 0, max = 1024, step = 1, orientation = 'horizontal', disabled, className = "" }) => {
    const rid = React.useId().replace(/[:]/g, '');
    const finalId = id ?? `fader-${rid}`;
    const finalName = name ?? finalId;
    const finalAriaLabel = ariaLabel ?? finalName;
    const orientationClass = orientation === 'vertical' ? '_c-fader-vertical' : '';
    const rafRef = React.useRef<number | null>(null);
    const pendingRef = React.useRef<number | null>(null);
    const lastSentRef = React.useRef<number | null>(null);

    const flushPending = React.useCallback(() => {
        rafRef.current = null;
        const next = pendingRef.current;
        if (next === null) return;
        if (lastSentRef.current === next) return;
        lastSentRef.current = next;
        onChange(next);
    }, [onChange]);

    const scheduleChange = React.useCallback((next: number) => {
        pendingRef.current = next;
        if (rafRef.current === null) {
            rafRef.current = requestAnimationFrame(flushPending);
        }
    }, [flushPending]);

    React.useEffect(() => {
        return () => {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, []);

    return (
        <input
            id={finalId}
            name={finalName}
            aria-label={finalAriaLabel}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => scheduleChange(Number(e.target.value))}
            disabled={disabled}
            className={`_c-fader ${orientationClass} ${className} ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
        />
    );
});

interface SelectProps extends BaseProps {
    id?: string;
    name?: string;
    ariaLabel?: string;
    value: string | number;
    onChange: (val: string) => void;
    options?: { value: string | number; label: string }[];
    children?: React.ReactNode;
}

export const Select: React.FC<SelectProps> = React.memo(({ id, name, ariaLabel, value, onChange, options, children, disabled, className = "" }) => {
    const rid = React.useId().replace(/[:]/g, '');
    const finalId = id ?? `select-${rid}`;
    const finalName = name ?? finalId;
    const finalAriaLabel = ariaLabel ?? finalName;

    return (
        <select
            id={finalId}
            name={finalName}
            aria-label={finalAriaLabel}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={`_c-input _t-input custom-select _b-widget border w-full px-2 outline-none uppercase cursor-pointer font-bold ${className} ${disabled ? 'opacity-50' : ''}`}
        >
            {options ? options.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
            )) : children}
        </select>
    );
});

interface InputProps extends BaseProps {
    id?: string;
    name?: string;
    ariaLabel?: string;
    autoComplete?: string;
    value: string | number;
    onChange: (val: string) => void;
    type?: 'text' | 'number';
    min?: number;
    max?: number;
    placeholder?: string;
}

export const Input: React.FC<InputProps> = React.memo(({ id, name, ariaLabel, autoComplete, value, onChange, type = "text", min, max, placeholder, disabled, className = "" }) => {
    const rid = React.useId().replace(/[:]/g, '');
    const finalId = id ?? `input-${rid}`;
    const finalName = name ?? finalId;
    const finalAriaLabel = ariaLabel ?? placeholder ?? finalName;

    return (
        <input
            id={finalId}
            name={finalName}
            aria-label={finalAriaLabel}
            autoComplete={autoComplete}
            type={type}
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={`_c-input _t-input _b-widget border w-full px-2 outline-none uppercase font-bold ${className} ${disabled ? 'opacity-50' : ''}`}
        />
    );
});

// --- BUTTONS ---

interface ButtonProps extends BaseProps {
    children: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
    active?: boolean;
    animate?: boolean;
    variant?: 'default' | 'ghost' | 'danger'; 
    title?: string;
}

export const Button: React.FC<ButtonProps> = React.memo(({ children, onClick, active = false, animate = false, variant = 'default', disabled, className = "", title }) => {
    let stateClass = "";

    if (variant === 'ghost') {
        stateClass = "_s-header";
    } else if (variant === 'danger') {
        stateClass = active ? "bg-black border-red-500 text-red-500" : "_s-inactive hover:text-red-500 hover:border-red-500";
    } else {
        stateClass = active ? BTN_ACTIVE : BTN_INACTIVE;
    }

    if (active && animate) stateClass += " animate-pulse";
    if (disabled) stateClass += " opacity-30 cursor-not-allowed";

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`px-2 _c-btn _t-btn border transition-colors ${stateClass} ${className}`}
        >
            {children}
        </button>
    );
});

interface ButtonGroupProps {
    children: React.ReactNode;
    className?: string;
}

export const ButtonGroup: React.FC<ButtonGroupProps> = React.memo(({ children, className = "" }) => (
    <div className={`flex gap-2 ${className}`}>
        {children}
    </div>
));
