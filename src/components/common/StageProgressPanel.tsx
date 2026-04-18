import styles from './StageProgressPanel.module.scss';

type StageProgressState = 'loading' | 'success';

interface StageProgressPanelProps {
  label: string;
  metaLabel?: string;
  metaValue?: string;
  state?: StageProgressState;
}

export function StageProgressPanel({
  label,
  metaLabel,
  metaValue,
  state = 'loading',
}: StageProgressPanelProps) {
  const panelClassName = [styles.panel, state === 'success' ? styles.panelSuccess : '']
    .filter(Boolean)
    .join(' ');
  const dotClassName = [styles.dot, state === 'success' ? styles.dotSuccess : '']
    .filter(Boolean)
    .join(' ');
  const barClassName = [styles.bar, state === 'success' ? styles.barSuccess : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={panelClassName}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <span className={dotClassName} aria-hidden="true" />
      </div>
      <div className={styles.track}>
        <div className={barClassName} />
      </div>
      {metaLabel && metaValue ? (
        <div className={styles.meta}>
          <span className={styles.metaLabel}>{metaLabel}</span>
          <span className={styles.metaValue}>{metaValue}</span>
        </div>
      ) : null}
      <div className={styles.ticks} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
