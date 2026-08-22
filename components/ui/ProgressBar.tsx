type ProgressBarProps = {
  value: number;
  max?: number;
  label?: string;
};

export function ProgressBar({ value, max = 100, label }: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="ui-progress" aria-label={label}>
      <div className="ui-progress-track">
        <div className="ui-progress-value" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
