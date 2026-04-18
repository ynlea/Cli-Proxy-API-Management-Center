import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Select } from '@/components/ui/Select';
import { DailyTrendChart } from '@/components/monitor/DailyTrendChart';
import { ChartLineSelector, ServiceHealthCard, StatCards, UsageChart } from '@/components/usage';
import { useUsageInsightsData } from '@/hooks/useUsageInsightsData';
import type { UsageData } from '@/types/monitor';
import { collectUsageDetails } from '@/utils/usage';
import styles from './UsagePage.module.scss';

const MAX_CHART_LINES = 9;

interface TrendsOverviewPageProps {
  embedded?: boolean;
  registerHeaderRefresh?: boolean;
}

export function TrendsOverviewPage({
  embedded = false,
  registerHeaderRefresh = !embedded,
}: TrendsOverviewPageProps) {
  const { t } = useTranslation();
  const {
    isDark,
    isMobile,
    usage,
    filteredUsage,
    loading,
    error,
    lastRefreshedAt,
    loadUsage,
    timeRange,
    setTimeRange,
    timeRangeOptions,
    chartLines,
    handleChartLinesChange,
    requestsSparkline,
    tokensSparkline,
    rpmSparkline,
    tpmSparkline,
    costSparkline,
    requestsPeriod,
    setRequestsPeriod,
    tokensPeriod,
    setTokensPeriod,
    requestsChartData,
    tokensChartData,
    requestsChartOptions,
    tokensChartOptions,
    modelNames,
    modelPrices,
  } = useUsageInsightsData('24h', { registerHeaderRefresh });

  const monitorUsage = filteredUsage as UsageData | null;
  const dailyTrendRange = useMemo(() => {
    const details = collectUsageDetails(filteredUsage);
    if (!details.length) {
      return timeRange === '7d' ? 7 : timeRange === 'all' ? 30 : 1;
    }

    let minTimestamp = Number.POSITIVE_INFINITY;
    let maxTimestamp = Number.NEGATIVE_INFINITY;
    details.forEach((detail) => {
      const timestamp =
        typeof detail.__timestampMs === 'number' && detail.__timestampMs > 0
          ? detail.__timestampMs
          : Date.parse(detail.timestamp);
      if (!Number.isFinite(timestamp)) return;
      minTimestamp = Math.min(minTimestamp, timestamp);
      maxTimestamp = Math.max(maxTimestamp, timestamp);
    });

    if (!Number.isFinite(minTimestamp) || !Number.isFinite(maxTimestamp)) {
      return timeRange === '7d' ? 7 : timeRange === 'all' ? 30 : 1;
    }

    return Math.max(1, Math.floor((maxTimestamp - minTimestamp) / 86400000) + 1);
  }, [filteredUsage, timeRange]);

  const nowMs = lastRefreshedAt?.getTime() ?? 0;

  return (
    <div className={embedded ? styles.embeddedSection : styles.container}>
      {loading && !usage && (
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

      <div className={styles.pageHero}>
        <div className={styles.header}>
          {!embedded ? (
            <div className={styles.pageHeaderCopy}>
              <h1 className={styles.pageTitle}>{t('nav.trends_overview')}</h1>
            </div>
          ) : null}
          {!embedded ? (
            <div className={styles.headerActions}>
              <Button variant="secondary" size="sm" onClick={loadUsage} disabled={loading}>
                {loading ? t('common.loading') : t('common.refresh')}
              </Button>
            </div>
          ) : null}
        </div>

        <div className={styles.headerMetaRow}>
          {!embedded && lastRefreshedAt ? (
            <span className={styles.lastRefreshed}>
              {t('usage_stats.last_updated')}: {lastRefreshedAt.toLocaleTimeString()}
            </span>
          ) : null}
          <div className={styles.timeRangeGroup}>
            <span className={styles.timeRangeLabel}>{t('usage_stats.time_range')}</span>
            <div className={styles.timeRangeSelectControl}>
              <Select
                value={timeRange}
                options={timeRangeOptions}
                onChange={(value) => setTimeRange(value as typeof timeRange)}
              />
            </div>
          </div>
        </div>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      <div className={styles.contentStack}>
        <StatCards
          usage={filteredUsage}
          loading={loading}
          modelPrices={modelPrices}
          nowMs={nowMs}
          sparklines={{
            requests: requestsSparkline,
            tokens: tokensSparkline,
            rpm: rpmSparkline,
            tpm: tpmSparkline,
            cost: costSparkline,
          }}
        />

        <div className={styles.supportGrid}>
          <ChartLineSelector
            chartLines={chartLines}
            modelNames={modelNames}
            maxLines={MAX_CHART_LINES}
            onChange={handleChartLinesChange}
          />
          <ServiceHealthCard usage={filteredUsage} loading={loading} />
        </div>

        <div className={styles.chartsGrid}>
          <UsageChart
            title={t('usage_stats.requests_trend')}
            period={requestsPeriod}
            onPeriodChange={setRequestsPeriod}
            chartData={requestsChartData}
            chartOptions={requestsChartOptions}
            loading={loading}
            isMobile={isMobile}
            emptyText={t('usage_stats.no_data')}
          />
          <UsageChart
            title={t('usage_stats.tokens_trend')}
            period={tokensPeriod}
            onPeriodChange={setTokensPeriod}
            chartData={tokensChartData}
            chartOptions={tokensChartOptions}
            loading={loading}
            isMobile={isMobile}
            emptyText={t('usage_stats.no_data')}
          />
        </div>

        <DailyTrendChart
          data={monitorUsage}
          loading={loading}
          isDark={isDark}
          timeRange={dailyTrendRange}
        />
      </div>
    </div>
  );
}
