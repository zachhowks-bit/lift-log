interface Props {
  label: string;
  value: number;
  min?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

/** Whole-number stepper (reps). */
export default function Stepper({ label, value, min = 0, onChange, disabled }: Props) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="stepper">
        <button type="button" className="step-btn" aria-label={`Less ${label.toLowerCase()}`}
          disabled={disabled || value <= min} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
        <output className="step-value" aria-label={label}>{value}</output>
        <button type="button" className="step-btn" aria-label={`More ${label.toLowerCase()}`}
          disabled={disabled} onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  );
}
