import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { RequestLogs } from '@/components/monitor/RequestLogs';
import { RequestEventsDetailsCard } from '@/components/usage/RequestEventsDetailsCard';
import { useMonitorInsightsData } from '@/hooks/useMonitorInsightsData';
import { useConfigStore } from '@/stores';
import styles from './MonitorPage.module.scss';

interface RequestLogsPageProps {
  embedded?: boolean;
  registerHeaderRefresh?: boolean;
}

export function RequestLogsPage({
  embedded = false,
  registerHeaderRefresh = !embedded,
}: RequestLogsPageProps) {
  const { t } = useTranslation();
  const config = useConfigStore((state) => state.config);
  const {
    loading,
    error,
    usageData,
    reload,
    providerMap,
    providerTypeMap,
    sourceInfoMap,
    authFileMap,
  } = useMonitorInsightsData(7, { registerHeaderRefresh });

  return (
    <div className={embedded ? styles.embeddedSection : styles.container}>
      {loading && !usageData && (
        <div className={styles.loadingOverlay} aria-busy="true">
          <div
            className={styles.loadingOverlayContent}
            aria-live="polite"
            data-watermark={t('title.abbr')}
          >
            <span className={styles.loadingOverlayKicker}>{t('title.main')}</span>
            <LoadingSpinner size={28} className={styles.loadingOverlaySpinner} />
            <span className={styles.loadingOverlayText}>{t('common.loading')}</span>
            <span className={styles.loadingOverlayMeter} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </div>
        </div>
      )}

      {!embedded ? (
        <div className={styles.pageHero}>
          <div className={styles.header}>
            <div className={styles.pageHeaderCopy}>
              <h1 className={styles.pageTitle}>{t('nav.request_logs')}</h1>
            </div>
            <div className={styles.headerActions}>
              <Button variant="secondary" size="sm" onClick={reload} disabled={loading}>
                {loading ? t('common.loading') : t('common.refresh')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {error && <div className={styles.errorBox}>{error}</div>}

      <div className={styles.contentStack}>
        <RequestLogs
          data={usageData}
          loading={loading}
          providerMap={providerMap}
          providerTypeMap={providerTypeMap}
          sourceInfoMap={sourceInfoMap}
          authFileMap={authFileMap}
          liveFetching={!embedded}
          showRefreshControls={!embedded}
        />

        <RequestEventsDetailsCard
          usage={usageData}
          loading={loading}
          geminiKeys={config?.geminiApiKeys || []}
          claudeConfigs={config?.claudeApiKeys || []}
          codexConfigs={config?.codexApiKeys || []}
          vertexConfigs={config?.vertexApiKeys || []}
          openaiProviders={config?.openaiCompatibility || []}
        />
      </div>
    </div>
  );
}
