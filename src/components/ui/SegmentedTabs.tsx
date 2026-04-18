import type { ReactNode } from 'react';
import styles from './SegmentedTabs.module.scss';

type SegmentedTabsVariant = 'compact' | 'card';

export interface SegmentedTabsItem<T extends string> {
  value: T;
  label: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  title?: string;
  disabled?: boolean;
}

interface SegmentedTabsProps<T extends string> {
  items: ReadonlyArray<SegmentedTabsItem<T>>;
  value: T;
  onChange: (value: T) => void;
  variant?: SegmentedTabsVariant;
  ariaLabel?: string;
  className?: string;
}

const joinClasses = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  variant = 'compact',
  ariaLabel,
  className,
}: SegmentedTabsProps<T>) {
  return (
    <div
      className={joinClasses(
        styles.tabList,
        variant === 'card' ? styles.card : styles.compact,
        className
      )}
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const isActive = item.value === value;

        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            disabled={item.disabled}
            title={item.title}
            className={joinClasses(
              styles.tabItem,
              variant === 'card' ? styles.cardItem : styles.compactItem,
              isActive && styles.active,
              item.disabled && styles.disabled
            )}
            onClick={() => {
              if (!item.disabled && item.value !== value) {
                onChange(item.value);
              }
            }}
          >
            {item.leading ? <span className={styles.leading}>{item.leading}</span> : null}

            <span className={styles.body}>
              <span className={styles.label}>{item.label}</span>
              {item.description ? (
                <span className={styles.description}>{item.description}</span>
              ) : null}
            </span>

            {item.trailing ? <span className={styles.trailing}>{item.trailing}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
