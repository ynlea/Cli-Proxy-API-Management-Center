import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ChannelStats } from '@/components/monitor/ChannelStats';
import { FailureAnalysis } from '@/components/monitor/FailureAnalysis';
import { HourlyModelChart } from '@/components/monitor/HourlyModelChart';
import { KpiCards } from '@/components/monitor/KpiCards';
import { ModelDistributionChart } from '@/components/monitor/ModelDistributionChart';
import {
  MONITOR_TIME_RANGES,
  useMonitorInsightsData,
} from '@/hooks/useMonitorInsightsData';
import styles from './MonitorPage.module.scss';

interface ChannelsModelsPageProps {
  embedded?: boolean;
  registerHeaderRefresh?: boolean;
}

export function ChannelsModelsPage({
  embedded = false,
  registerHeaderRefresh = !embedded,
}: ChannelsModelsPageProps) {
  const { t } = useTranslation();
  const {
    isDark,
    loading,
    error,
    usageData,
    timeRange,
    setTimeRange,
    apiFilter,
    setApiFilter,
    reload,
    apiFilteredData,
    filteredData,
    providerMap,
    providerModels,
    sourceInfoMap,
    authFileMap,
  } = useMonitorInsightsData(7, { registerHeaderRefresh });

  return (
    <div className={embedded ? styles.embeddedSection : styles.container}>
      {loading && !usageData && (
        <div className={styles.loadingOverlay} aria-busy="true">
          <div className={styles.loadingOverlayContent}>
            <LoadingSpinner size={28} className={styles.loadingOverlaySpinner} />
            <span className={styles.loadingOverlayText}>{t('common.loading')}</span>
          </div>
        </div>
      )}

      <div className={styles.pageHero}>
        <div className={styles.header}>
          {!embedded ? (
            <div className={styles.pageHeaderCopy}>
              <h1 className={styles.pageTitle}>{t('nav.channels_models')}</h1>
            </div>
          ) : null}
          {!embedded ? (
            <div className={styles.headerActions}>
              <Button variant="secondary" size="sm" onClick={reload} disabled={loading}>
                {loading ? t('common.loading') : t('common.refresh')}
              </Button>
            </div>
          ) : null}
        </div>

        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>{t('monitor.time_range')}</span>
            <div className={styles.timeButtons}>
              {MONITOR_TIME_RANGES.map((range) => (
                <button
                  key={range}
                  className={`${styles.timeButton} ${timeRange === range ? styles.active : ''}`}
                  onClick={() => setTimeRange(range)}
                >
                  {range === 1 ? t('monitor.today') : t('monitor.last_n_days', { n: range })}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>{t('monitor.api_filter')}</span>
            <div className={styles.filterControlRow}>
              <input
                type="text"
                className={styles.filterInput}
                placeholder={t('monitor.api_filter_placeholder')}
                value={apiFilter}
                onChange={(event) => setApiFilter(event.target.value)}
              />
              <Button variant="secondary" size="sm" onClick={reload} disabled={loading}>
                {t('common.refresh')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      <div className={styles.contentStack}>
        <KpiCards data={filteredData} loading={loading} timeRange={timeRange} />

        <div className={styles.chartsGrid}>
          <ModelDistributionChart
            data={filteredData}
            loading={loading}
            isDark={isDark}
            timeRange={timeRange}
          />
          <HourlyModelChart data={apiFilteredData} loading={loading} isDark={isDark} />
        </div>

        <div className={styles.statsGrid}>
          <ChannelStats
            data={filteredData}
            loading={loading}
            providerMap={providerMap}
            providerModels={providerModels}
            sourceInfoMap={sourceInfoMap}
            authFileMap={authFileMap}
          />
          <FailureAnalysis
            data={filteredData}
            loading={loading}
            providerMap={providerMap}
            providerModels={providerModels}
            sourceInfoMap={sourceInfoMap}
            authFileMap={authFileMap}
          />
        </div>
      </div>
    </div>
  );
}
