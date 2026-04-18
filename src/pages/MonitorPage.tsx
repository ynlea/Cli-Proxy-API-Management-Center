import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SegmentedTabs, type SegmentedTabsItem } from '@/components/ui/SegmentedTabs';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { preloadMonitorInsightsData } from '@/hooks/useMonitorInsightsData';
import { useUsageStatsStore } from '@/stores';
import { ChannelsModelsPage } from '@/pages/ChannelsModelsPage';
import { CostsConsumptionPage } from '@/pages/CostsConsumptionPage';
import { RequestLogsPage } from '@/pages/RequestLogsPage';
import { TrendsOverviewPage } from '@/pages/TrendsOverviewPage';
import styles from './MonitorPage.module.scss';

type MonitorTab = 'request-logs' | 'trends' | 'channels' | 'costs';

const DEFAULT_TAB: MonitorTab = 'request-logs';

const isMonitorTab = (value: string | null): value is MonitorTab =>
  value === 'request-logs' || value === 'trends' || value === 'channels' || value === 'costs';

export function MonitorPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const usageLoading = useUsageStatsStore((state) => state.loading);
  const lastRefreshedAtTs = useUsageStatsStore((state) => state.lastRefreshedAt);
  const queryTab = searchParams.get('tab');
  const resolvedTab = isMonitorTab(queryTab) ? queryTab : DEFAULT_TAB;

  const [activeTab, setActiveTab] = useState<MonitorTab>(resolvedTab);
  const [loadedTabs, setLoadedTabs] = useState<MonitorTab[]>([resolvedTab]);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await preloadMonitorInsightsData(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void preloadMonitorInsightsData();
  }, []);

  useHeaderRefresh(handleRefresh);

  useEffect(() => {
    setActiveTab(resolvedTab);
    setLoadedTabs((previous) =>
      previous.includes(resolvedTab) ? previous : [...previous, resolvedTab]
    );
  }, [resolvedTab]);

  const handleTabChange = (nextTab: MonitorTab) => {
    setActiveTab(nextTab);
    setLoadedTabs((previous) => (previous.includes(nextTab) ? previous : [...previous, nextTab]));
    setSearchParams(nextTab === DEFAULT_TAB ? {} : { tab: nextTab }, { replace: true });
  };

  const tabItems = useMemo<ReadonlyArray<SegmentedTabsItem<MonitorTab>>>(
    () => [
      { value: 'request-logs', label: t('nav.request_logs') },
      { value: 'trends', label: t('nav.trends_overview') },
      { value: 'channels', label: t('nav.channels_models') },
      { value: 'costs', label: t('nav.costs_consumption') },
    ],
    [t]
  );
  const lastUpdatedText = useMemo(
    () => (lastRefreshedAtTs ? new Date(lastRefreshedAtTs).toLocaleString() : ''),
    [lastRefreshedAtTs]
  );

  return (
    <div className={styles.container}>
      <div className={styles.pageHero}>
        <div className={styles.header}>
          <div className={styles.pageHeaderCopy}>
            <div className={styles.titleRow}>
              <h1 className={styles.pageTitle}>{t('monitor.title')}</h1>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing || usageLoading}
                loading={refreshing}
              >
                {t('common.refresh')}
              </Button>
            </div>
            {lastUpdatedText ? (
              <div className={styles.pageMetaText}>
                {t('usage_stats.last_updated')}: {lastUpdatedText}
              </div>
            ) : null}
          </div>
        </div>

        <SegmentedTabs
          items={tabItems}
          value={activeTab}
          onChange={handleTabChange}
          variant="card"
          ariaLabel={t('monitor.title')}
          className={styles.monitorTabs}
        />
      </div>

      <div className={styles.monitorPanels}>
        {loadedTabs.includes('request-logs') ? (
          <section
            className={styles.monitorPanel}
            hidden={activeTab !== 'request-logs'}
            aria-hidden={activeTab !== 'request-logs'}
          >
            <RequestLogsPage embedded registerHeaderRefresh={false} />
          </section>
        ) : null}

        {loadedTabs.includes('trends') ? (
          <section
            className={styles.monitorPanel}
            hidden={activeTab !== 'trends'}
            aria-hidden={activeTab !== 'trends'}
          >
            <TrendsOverviewPage embedded registerHeaderRefresh={false} />
          </section>
        ) : null}

        {loadedTabs.includes('channels') ? (
          <section
            className={styles.monitorPanel}
            hidden={activeTab !== 'channels'}
            aria-hidden={activeTab !== 'channels'}
          >
            <ChannelsModelsPage embedded registerHeaderRefresh={false} />
          </section>
        ) : null}

        {loadedTabs.includes('costs') ? (
          <section
            className={styles.monitorPanel}
            hidden={activeTab !== 'costs'}
            aria-hidden={activeTab !== 'costs'}
          >
            <CostsConsumptionPage embedded registerHeaderRefresh={false} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
