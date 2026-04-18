import { useTranslation } from 'react-i18next';
import { WebdavConnectionCard } from './components/WebdavConnectionCard';
import { ManualBackupCard } from './components/ManualBackupCard';
import { RestoreCard } from './components/RestoreCard';
import styles from './BackupPage.module.scss';

export function BackupPage() {
  const { t } = useTranslation();

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderCopy}>
          <h1 className={styles.pageTitle}>{t('backup.page_title')}</h1>
          <p className={styles.description}>{t('backup.page_subtitle')}</p>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.primarySection}>
          <WebdavConnectionCard />
        </div>

        <div className={styles.secondaryGrid}>
          <div className={styles.secondaryCard}>
            <ManualBackupCard />
          </div>
          <div className={styles.secondaryCard}>
            <RestoreCard />
          </div>
        </div>
      </div>
    </div>
  );
}
