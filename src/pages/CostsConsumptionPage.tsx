import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Select } from '@/components/ui/Select';
import { HourlyTokenChart } from '@/components/monitor/HourlyTokenChart';
import {
  ApiDetailsCard,
  CostTrendChart,
  CredentialStatsCard,
  ModelStatsCard,
  PriceSettingsCard,
  TokenBreakdownChart,
} from '@/components/usage';
import { useUsageInsightsData } from '@/hooks/useUsageInsightsData';
import type { UsageData } from '@/types/monitor';
import styles from './UsagePage.module.scss';

interface CostsConsumptionPageProps {
  embedded?: boolean;
  registerHeaderRefresh?: boolean;
}

export function CostsConsumptionPage({
  embedded = false,
  registerHeaderRefresh = !embedded,
}: CostsConsumptionPageProps) {
  const { t } = useTranslation();
  const {
    config,
    isDark,
    usage,
    filteredUsage,
    loading,
    error,
    lastRefreshedAt,
    modelPrices,
    manualModelPrices,
    modelPriceSources,
    setModelPrices,
    loadUsage,
    handleExport,
    handleImport,
    handleImportChange,
    importInputRef,
    exporting,
    importing,
    timeRange,
    setTimeRange,
    timeRangeOptions,
    hourWindowHours,
    modelNames,
    apiStats,
    modelStats,
    hasPrices,
  } = useUsageInsightsData('7d', { registerHeaderRefresh });

  const monitorUsage = filteredUsage as UsageData | null;

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

      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        hidden
        onChange={handleImportChange}
      />

      <div className={styles.pageHero}>
        <div className={styles.header}>
          {!embedded ? (
            <div className={styles.pageHeaderCopy}>
              <h1 className={styles.pageTitle}>{t('nav.costs_consumption')}</h1>
            </div>
          ) : null}
          {!embedded ? (
            <div className={styles.headerActions}>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExport}
                loading={exporting}
                disabled={loading || importing}
              >
                {t('usage_stats.export')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleImport}
                loading={importing}
                disabled={loading || exporting}
              >
                {t('usage_stats.import')}
              </Button>
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
        <div className={styles.chartsGrid}>
          <TokenBreakdownChart
            usage={filteredUsage}
            loading={loading}
            isDark={isDark}
            isMobile={false}
            hourWindowHours={hourWindowHours}
          />
          <CostTrendChart
            usage={filteredUsage}
            loading={loading}
            isDark={isDark}
            isMobile={false}
            modelPrices={modelPrices}
            hourWindowHours={hourWindowHours}
          />
        </div>

        <HourlyTokenChart data={monitorUsage} loading={loading} isDark={isDark} />

        <div className={styles.detailsGrid}>
          <ApiDetailsCard apiStats={apiStats} loading={loading} hasPrices={hasPrices} />
          <ModelStatsCard modelStats={modelStats} loading={loading} hasPrices={hasPrices} />
        </div>

        <div className={styles.detailsGrid}>
          <CredentialStatsCard
            usage={filteredUsage}
            loading={loading}
            geminiKeys={config?.geminiApiKeys || []}
            claudeConfigs={config?.claudeApiKeys || []}
            codexConfigs={config?.codexApiKeys || []}
            vertexConfigs={config?.vertexApiKeys || []}
            openaiProviders={config?.openaiCompatibility || []}
          />
          <PriceSettingsCard
            modelNames={modelNames}
            modelPrices={modelPrices}
            manualModelPrices={manualModelPrices}
            modelPriceSources={modelPriceSources}
            onPricesChange={setModelPrices}
          />
        </div>
      </div>
    </div>
  );
}
