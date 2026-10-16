interface Props<T extends string | number> {
  label: string;
  options: { value: T; text: string }[];
  value: T | null;
  onChange: (v: T) => void;
  disabled?: boolean;
  small?: boolean;
  /** Columns in the chip grid (default from CSS: 4, or 6 when small). */
  cols?: number;
  /** Smaller text chips (e.g. set type). */
  compact?: boolean;
}

/** Single-select chip row. */
export default function Chips<T extends string | number>({ label, options, value, onChange, disabled, small, cols, compact }: Props<T>) {
  return (
    <div className="field">
      <span className="field-label" aria-hidden="true">{label}</span>
      <div className={small ? 'chips chips-small' : compact ? 'chips chips-text' : 'chips'} role="radiogroup" aria-label={label}
        style={cols ? { gridTemplateColumns: `repeat(${cols}, 1fr)` } : undefined}>
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value}
            className={value === o.value ? 'chip chip-on' : 'chip'} disabled={disabled}
            onClick={() => onChange(o.value)}>
            {o.text}
          </button>
        ))}
      </div>
    </div>
  );
}
