import type { ReactNode } from 'react';
import styles from './PageHero.module.scss';

type PageHeroProps = {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  className?: string;
  supportClassName?: string;
  children?: ReactNode;
};

const joinClassNames = (...values: Array<string | undefined>) => values.filter(Boolean).join(' ');

export function PageHero({
  title,
  description,
  eyebrow,
  meta,
  className,
  supportClassName,
  children,
}: PageHeroProps) {
  return (
    <section className={joinClassNames(styles.root, className)}>
      <div className={joinClassNames(styles.header, meta ? undefined : styles.headerSingle)}>
        <div className={styles.copy}>
          {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
          <h1 className={styles.title}>{title}</h1>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        {meta ? <div className={styles.meta}>{meta}</div> : null}
      </div>
      {children ? <div className={joinClassNames(styles.support, supportClassName)}>{children}</div> : null}
    </section>
  );
}
