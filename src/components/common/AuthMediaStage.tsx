import type { ReactNode } from 'react';
import { AUTH_STAGE_MEDIA_URL } from '@/constants/media';
import { StreamVideo } from './StreamVideo';
import styles from './AuthMediaStage.module.scss';

interface AuthMediaStageProps {
  label: string;
  status: string;
  title: string;
  description: string;
  children: ReactNode;
  controls?: ReactNode;
  className?: string;
  contentClassName?: string;
  hideMeta?: boolean;
}

export function AuthMediaStage({
  label,
  status,
  title,
  description,
  children,
  controls,
  className,
  contentClassName,
  hideMeta = false,
}: AuthMediaStageProps) {
  const stageClassName = [styles.stage, className].filter(Boolean).join(' ');
  const contentBodyClassName = [styles.infoBody, contentClassName].filter(Boolean).join(' ');
  const infoHeaderClassName = [
    styles.infoHeader,
    hideMeta ? styles.infoHeaderCompact : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={stageClassName}>
      <div className={styles.mediaPanel}>
        <StreamVideo
          src={AUTH_STAGE_MEDIA_URL}
          className={styles.video}
          aria-hidden="true"
          tabIndex={-1}
        />
        <div className={styles.mediaShade} aria-hidden="true" />
        <div className={styles.mediaGlow} aria-hidden="true" />
      </div>

      <div className={styles.infoCard}>
        <div className={infoHeaderClassName}>
          <div className={styles.infoIntro}>
            {!hideMeta ? (
              <div className={styles.infoMeta}>
                <span className={styles.infoLabel}>{label}</span>
                <span className={styles.infoStatus}>{status}</span>
              </div>
            ) : null}
            <h1 className={styles.infoTitle}>{title}</h1>
            <p className={styles.infoDescription}>{description}</p>
          </div>
          {controls ? <div className={styles.infoControls}>{controls}</div> : null}
        </div>
        <div className={contentBodyClassName}>{children}</div>
      </div>
    </section>
  );
}
