import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PageHero } from '@/components/layout/PageHero';
import { Card } from '@/components/ui/Card';
import {
  IconActivity,
  IconBot,
  IconChartLine,
  IconFileText,
  IconKey,
  IconSatellite,
  IconTimer,
  IconTrendingUp,
} from '@/components/ui/icons';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  USAGE_STATS_STALE_TIME_MS,
  useAuthStore,
  useConfigStore,
  useModelsStore,
  useThemeStore,
  useUsageStatsStore,
} from '@/stores';
import { apiKeysApi, authFilesApi, providersApi } from '@/services/api';
import { buildChartOptions } from '@/utils/usage/chartConfig';
import {
  calculateRecentPerMinuteRates,
  collectUsageDetails,
  extractTotalTokens,
  formatCompactNumber,
  formatPerMinuteValue,
} from '@/utils/usage';
import styles from './DashboardPage.module.scss';

interface QuickStat {
  label: string;
  value: number | string;
  icon: ReactNode;
  path: string;
  loading?: boolean;
  sublabel?: string;
  accent: string;
  accentSoft: string;
  accentBorder: string;
}

interface ProviderStats {
  gemini: number | null;
  codex: number | null;
  claude: number | null;
  openai: number | null;
}

interface ConfigItem {
  label: string;
  value: number | string;
  wide?: boolean;
  mono?: boolean;
  tone?: 'on' | 'off';
  badgeClass?: string;
}

interface DailyUsageSnapshot {
  key: string;
  dateLabel: string;
  weekdayLabel: string;
  totalRequests: number;
  totalTokens: number;
}

type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

const normalizeApiKeyList = (input: unknown): string[] => {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const keys: string[] = [];

  input.forEach((item) => {
    const record =
      item !== null && typeof item === 'object' && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : null;
    const value =
      typeof item === 'string'
        ? item
        : record
          ? (record['api-key'] ?? record['apiKey'] ?? record.key ?? record.Key)
          : '';
    const trimmed = String(value ?? '').trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    keys.push(trimmed);
  });

  return keys;
};

const formatLocalDayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const isDark = resolvedTheme === 'dark';

  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const apiBase = useAuthStore((state) => state.apiBase);
  const config = useConfigStore((state) => state.config);

  const models = useModelsStore((state) => state.models);
  const modelsLoading = useModelsStore((state) => state.loading);
  const fetchModelsFromStore = useModelsStore((state) => state.fetchModels);

  const usage = useUsageStatsStore((state) => state.usage);
  const usageLoading = useUsageStatsStore((state) => state.loading);
  const usageLastRefreshedAtTs = useUsageStatsStore((state) => state.lastRefreshedAt);
  const loadUsageStats = useUsageStatsStore((state) => state.loadUsageStats);

  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState<{
    apiKeys: number | null;
    authFiles: number | null;
  }>({
    apiKeys: null,
    authFiles: null,
  });

  const [providerStats, setProviderStats] = useState<ProviderStats>({
    gemini: null,
    codex: null,
    claude: null,
    openai: null,
  });

  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(getTimeOfDay);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const apiKeysCache = useRef<string[]>([]);

  useEffect(() => {
    apiKeysCache.current = [];
  }, [apiBase, config?.apiKeys]);

  useEffect(() => {
    const id = setInterval(() => {
      setTimeOfDay(getTimeOfDay());
      setCurrentTime(new Date());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const resolveApiKeysForModels = useCallback(async () => {
    if (apiKeysCache.current.length) {
      return apiKeysCache.current;
    }

    const configKeys = normalizeApiKeyList(config?.apiKeys);
    if (configKeys.length) {
      apiKeysCache.current = configKeys;
      return configKeys;
    }

    try {
      const list = await apiKeysApi.list();
      const normalized = normalizeApiKeyList(list);
      if (normalized.length) {
        apiKeysCache.current = normalized;
      }
      return normalized;
    } catch {
      return [];
    }
  }, [config?.apiKeys]);

  const fetchModels = useCallback(async () => {
    if (connectionStatus !== 'connected' || !apiBase) {
      return;
    }

    try {
      const apiKeys = await resolveApiKeysForModels();
      await fetchModelsFromStore(apiBase, apiKeys[0]);
    } catch {
      // Ignore model fetch errors on dashboard.
    }
  }, [apiBase, connectionStatus, fetchModelsFromStore, resolveApiKeysForModels]);

  useEffect(() => {
    const fetchStats = async () => {
      setStatsLoading(true);
      try {
        const [keysRes, filesRes, geminiRes, codexRes, claudeRes, openaiRes] =
          await Promise.allSettled([
            apiKeysApi.list(),
            authFilesApi.list(),
            providersApi.getGeminiKeys(),
            providersApi.getCodexConfigs(),
            providersApi.getClaudeConfigs(),
            providersApi.getOpenAIProviders(),
          ]);

        setStats({
          apiKeys: keysRes.status === 'fulfilled' ? keysRes.value.length : null,
          authFiles: filesRes.status === 'fulfilled' ? filesRes.value.files.length : null,
        });

        setProviderStats({
          gemini: geminiRes.status === 'fulfilled' ? geminiRes.value.length : null,
          codex: codexRes.status === 'fulfilled' ? codexRes.value.length : null,
          claude: claudeRes.status === 'fulfilled' ? claudeRes.value.length : null,
          openai: openaiRes.status === 'fulfilled' ? openaiRes.value.length : null,
        });
      } finally {
        setStatsLoading(false);
      }
    };

    if (connectionStatus === 'connected') {
      void loadUsageStats({ staleTimeMs: USAGE_STATS_STALE_TIME_MS }).catch(() => {});
      void fetchStats();
      void fetchModels();
    } else {
      setStatsLoading(false);
    }
  }, [connectionStatus, fetchModels, loadUsageStats]);

  const providerStatsReady =
    providerStats.gemini !== null &&
    providerStats.codex !== null &&
    providerStats.claude !== null &&
    providerStats.openai !== null;
  const hasProviderStats =
    providerStats.gemini !== null ||
    providerStats.codex !== null ||
    providerStats.claude !== null ||
    providerStats.openai !== null;
  const totalProviderKeys = providerStatsReady
    ? (providerStats.gemini ?? 0) +
      (providerStats.codex ?? 0) +
      (providerStats.claude ?? 0) +
      (providerStats.openai ?? 0)
    : 0;

  const quickStats: QuickStat[] = [
    {
      label: t('dashboard.management_keys'),
      value: stats.apiKeys ?? '-',
      icon: <IconKey size={20} />,
      path: '/config',
      loading: statsLoading && stats.apiKeys === null,
      sublabel: t('nav.config_management'),
      accent: '#7a90e8',
      accentSoft: 'rgba(122, 144, 232, 0.22)',
      accentBorder: 'rgba(122, 144, 232, 0.38)',
    },
    {
      label: t('nav.ai_providers'),
      value: statsLoading ? '-' : providerStatsReady ? totalProviderKeys : '-',
      icon: <IconBot size={20} />,
      path: '/ai-providers',
      loading: statsLoading,
      sublabel: hasProviderStats
        ? t('dashboard.provider_keys_detail', {
            gemini: providerStats.gemini ?? '-',
            codex: providerStats.codex ?? '-',
            claude: providerStats.claude ?? '-',
            openai: providerStats.openai ?? '-',
          })
        : undefined,
      accent: '#d97db1',
      accentSoft: 'rgba(217, 125, 177, 0.2)',
      accentBorder: 'rgba(217, 125, 177, 0.34)',
    },
    {
      label: t('nav.auth_files'),
      value: stats.authFiles ?? '-',
      icon: <IconFileText size={20} />,
      path: '/auth-files',
      loading: statsLoading && stats.authFiles === null,
      sublabel: t('dashboard.oauth_credentials'),
      accent: '#77bfae',
      accentSoft: 'rgba(119, 191, 174, 0.2)',
      accentBorder: 'rgba(119, 191, 174, 0.34)',
    },
    {
      label: t('dashboard.available_models'),
      value: modelsLoading ? '-' : models.length,
      icon: <IconSatellite size={20} />,
      path: '/system',
      loading: modelsLoading,
      sublabel: t('dashboard.available_models_desc'),
      accent: '#d7a06c',
      accentSoft: 'rgba(215, 160, 108, 0.2)',
      accentBorder: 'rgba(215, 160, 108, 0.34)',
    },
  ];

  const routingStrategyRaw = config?.routingStrategy?.trim() || '';
  const routingStrategyDisplay = !routingStrategyRaw
    ? '-'
    : routingStrategyRaw === 'round-robin'
      ? t('basic_settings.routing_strategy_round_robin')
      : routingStrategyRaw === 'fill-first'
        ? t('basic_settings.routing_strategy_fill_first')
        : routingStrategyRaw;
  const routingStrategyBadgeClass = !routingStrategyRaw
    ? styles.configBadgeUnknown
    : routingStrategyRaw === 'round-robin'
      ? styles.configBadgeRoundRobin
      : routingStrategyRaw === 'fill-first'
        ? styles.configBadgeFillFirst
        : styles.configBadgeUnknown;

  const greetingKey = `dashboard.greeting_${timeOfDay}`;
  const caringKey = `dashboard.caring_${timeOfDay}`;

  const formattedDate = currentTime.toLocaleDateString(i18n.language, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const usageLastRefreshedAt = usageLastRefreshedAtTs ? new Date(usageLastRefreshedAtTs) : null;
  const usageDetails = useMemo(() => collectUsageDetails(usage), [usage]);
  const recentRateStats = useMemo(() => calculateRecentPerMinuteRates(30, usage), [usage]);

  const todayUsage = useMemo(() => {
    const startOfDay = new Date(currentTime);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfDayMs = startOfDay.getTime();
    const nowMs = currentTime.getTime();

    let totalRequests = 0;
    let totalTokens = 0;
    let successCount = 0;
    let failureCount = 0;
    const modelSet = new Set<string>();

    usageDetails.forEach((detail) => {
      const timestampMs =
        typeof detail.__timestampMs === 'number'
          ? detail.__timestampMs
          : Date.parse(detail.timestamp);
      if (!Number.isFinite(timestampMs) || timestampMs < startOfDayMs || timestampMs > nowMs) {
        return;
      }

      totalRequests += 1;
      totalTokens += extractTotalTokens(detail);
      if (detail.failed) {
        failureCount += 1;
      } else {
        successCount += 1;
      }
      if (detail.__modelName) {
        modelSet.add(detail.__modelName);
      }
    });

    return {
      totalRequests,
      totalTokens,
      successCount,
      failureCount,
      modelsUsed: modelSet.size,
      successRate: totalRequests > 0 ? (successCount / totalRequests) * 100 : 0,
    };
  }, [currentTime, usageDetails]);

  const recent7DayUsage = useMemo(() => {
    const endOfWindow = currentTime.getTime();
    const startOfToday = new Date(currentTime);
    startOfToday.setHours(0, 0, 0, 0);

    const dailyBuckets = new Map<
      string,
      {
        dateLabel: string;
        weekdayLabel: string;
        totalRequests: number;
        totalTokens: number;
      }
    >();

    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date(startOfToday);
      date.setDate(startOfToday.getDate() - offset);
      const key = formatLocalDayKey(date);
      dailyBuckets.set(key, {
        dateLabel: date.toLocaleDateString(i18n.language, {
          month: 'short',
          day: 'numeric',
        }),
        weekdayLabel: date.toLocaleDateString(i18n.language, { weekday: 'short' }),
        totalRequests: 0,
        totalTokens: 0,
      });
    }

    const startOfWindow = new Date(startOfToday);
    startOfWindow.setDate(startOfToday.getDate() - 6);
    const startOfWindowMs = startOfWindow.getTime();

    usageDetails.forEach((detail) => {
      const timestampMs =
        typeof detail.__timestampMs === 'number'
          ? detail.__timestampMs
          : Date.parse(detail.timestamp);

      if (
        !Number.isFinite(timestampMs) ||
        timestampMs < startOfWindowMs ||
        timestampMs > endOfWindow
      ) {
        return;
      }

      const bucket = dailyBuckets.get(formatLocalDayKey(new Date(timestampMs)));
      if (!bucket) return;

      bucket.totalRequests += 1;
      bucket.totalTokens += extractTotalTokens(detail);
    });

    const daily: DailyUsageSnapshot[] = Array.from(dailyBuckets.entries()).map(([key, bucket]) => ({
      key,
      dateLabel: bucket.dateLabel,
      weekdayLabel: bucket.weekdayLabel,
      totalRequests: bucket.totalRequests,
      totalTokens: bucket.totalTokens,
    }));

    const peakDay = daily.reduce<DailyUsageSnapshot | null>((currentPeak, day) => {
      if (!currentPeak) {
        return day.totalRequests > 0 ? day : null;
      }
      if (day.totalRequests > currentPeak.totalRequests) {
        return day;
      }
      if (
        day.totalRequests === currentPeak.totalRequests &&
        day.totalTokens > currentPeak.totalTokens
      ) {
        return day;
      }
      return currentPeak;
    }, null);

    return {
      daily,
      peakDay,
      totalRequests: daily.reduce((sum, day) => sum + day.totalRequests, 0),
      totalTokens: daily.reduce((sum, day) => sum + day.totalTokens, 0),
      activeDays: daily.filter((day) => day.totalRequests > 0).length,
      peakRequests: daily.reduce((peak, day) => Math.max(peak, day.totalRequests), 0),
    };
  }, [currentTime, i18n.language, usageDetails]);

  const todayUsageMetrics = [
    {
      label: t('dashboard.total_requests'),
      value: usageLoading ? '--' : todayUsage.totalRequests.toLocaleString(),
      icon: <IconActivity size={18} />,
      accent: '#7a90e8',
    },
    {
      label: t('dashboard.total_tokens'),
      value: usageLoading ? '--' : formatCompactNumber(todayUsage.totalTokens),
      icon: <IconChartLine size={18} />,
      accent: '#d97db1',
    },
    {
      label: t('dashboard.models_used'),
      value: usageLoading ? '--' : todayUsage.modelsUsed.toLocaleString(),
      icon: <IconTrendingUp size={18} />,
      accent: '#77bfae',
    },
    {
      label: t('dashboard.rpm_30min'),
      value: usageLoading ? '--' : formatPerMinuteValue(recentRateStats.rpm),
      icon: <IconTimer size={18} />,
      accent: '#d7a06c',
    },
  ];

  const usageFooterText = usageLoading
    ? t('common.loading')
    : todayUsage.totalRequests > 0
      ? `${t('monitor.kpi.success')}: ${todayUsage.successCount.toLocaleString()} · ${t('monitor.kpi.failed')}: ${todayUsage.failureCount.toLocaleString()} · ${t('monitor.kpi.rate')}: ${todayUsage.successRate.toFixed(1)}%`
      : config?.usageStatisticsEnabled === false
        ? `${t('basic_settings.usage_statistics_enable')}: ${t('common.no')}`
        : t('dashboard.no_usage_data');

  const usageRefreshText = usageLastRefreshedAt
    ? `${t('usage_stats.last_updated')}: ${usageLastRefreshedAt.toLocaleTimeString(i18n.language, {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : null;

  const configItems: ConfigItem[] = config
    ? [
        {
          label: t('basic_settings.debug_enable'),
          value: config.debug ? t('common.yes') : t('common.no'),
          tone: config.debug ? 'on' : 'off',
        },
        {
          label: t('basic_settings.usage_statistics_enable'),
          value: config.usageStatisticsEnabled ? t('common.yes') : t('common.no'),
          tone: config.usageStatisticsEnabled ? 'on' : 'off',
        },
        {
          label: t('basic_settings.logging_to_file_enable'),
          value: config.loggingToFile ? t('common.yes') : t('common.no'),
          tone: config.loggingToFile ? 'on' : 'off',
        },
        {
          label: t('basic_settings.retry_count_label'),
          value: config.requestRetry ?? 0,
        },
        {
          label: t('basic_settings.ws_auth_enable'),
          value: config.wsAuth ? t('common.yes') : t('common.no'),
          tone: config.wsAuth ? 'on' : 'off',
        },
        {
          label: t('dashboard.routing_strategy'),
          value: routingStrategyDisplay,
          badgeClass: routingStrategyBadgeClass,
        },
        ...(config.proxyUrl
          ? [
              {
                label: t('basic_settings.proxy_url_label'),
                value: config.proxyUrl,
                wide: true,
                mono: true,
              } satisfies ConfigItem,
            ]
          : []),
      ]
    : [];

  const recent7DayMetrics = [
    {
      label: t('dashboard.total_requests'),
      value: usageLoading ? '--' : recent7DayUsage.totalRequests.toLocaleString(),
    },
    {
      label: t('dashboard.total_tokens'),
      value: usageLoading ? '--' : formatCompactNumber(recent7DayUsage.totalTokens),
    },
    {
      label: t('dashboard.active_days'),
      value: usageLoading ? '--' : recent7DayUsage.activeDays.toLocaleString(),
    },
    {
      label: t('dashboard.peak_requests'),
      value: usageLoading ? '--' : recent7DayUsage.peakRequests.toLocaleString(),
      meta: recent7DayUsage.peakDay
        ? `${recent7DayUsage.peakDay.weekdayLabel} · ${recent7DayUsage.peakDay.dateLabel}`
        : t('dashboard.no_usage_data'),
    },
  ];

  const recent7DayChartData = useMemo<ChartData<'line'>>(
    () => ({
      labels: recent7DayUsage.daily.map((day) => day.key),
      datasets: [
        {
          label: t('dashboard.total_requests'),
          data: recent7DayUsage.daily.map((day) => day.totalRequests),
          fill: true,
          borderColor: isDark ? '#9cc3ff' : '#5f7df3',
          backgroundColor: isDark ? 'rgba(156, 195, 255, 0.18)' : 'rgba(95, 125, 243, 0.16)',
          pointBackgroundColor: isDark ? '#ffd0e3' : '#e7689f',
          pointBorderColor: isDark ? '#09111a' : '#fffaf5',
          pointHoverBackgroundColor: isDark ? '#ffe0ed' : '#d94685',
          pointHoverBorderColor: isDark ? '#09111a' : '#ffffff',
        },
      ],
    }),
    [isDark, recent7DayUsage.daily, t]
  );

  const recent7DayChartOptions = useMemo<ChartOptions<'line'>>(() => {
    const labels = recent7DayUsage.daily.map((day) => day.key);
    const baseOptions = buildChartOptions({
      period: 'day',
      labels,
      isDark,
      isMobile,
    });
    const baseTooltip =
      typeof baseOptions.plugins?.tooltip === 'object' ? baseOptions.plugins.tooltip : {};
    const axisBorderColor = isDark ? 'rgba(117, 255, 122, 0.18)' : 'rgba(12, 24, 52, 0.16)';
    const gridColor = isDark ? 'rgba(57, 213, 255, 0.12)' : 'rgba(12, 24, 52, 0.10)';
    const tickColor = isDark ? 'rgba(218, 249, 255, 0.82)' : 'rgba(12, 24, 52, 0.76)';
    const tickFontSize = isMobile ? 10 : 12;

    return {
      responsive: baseOptions.responsive,
      maintainAspectRatio: baseOptions.maintainAspectRatio,
      interaction: baseOptions.interaction,
      elements: baseOptions.elements,
      plugins: {
        ...baseOptions.plugins,
        tooltip: {
          ...baseTooltip,
          callbacks: {
            title: (items) => {
              const item = items[0];
              const day = item ? recent7DayUsage.daily[item.dataIndex] : undefined;
              return day ? `${day.weekdayLabel} · ${day.dateLabel}` : '';
            },
            label: (context) =>
              `${t('dashboard.total_requests')}: ${Number(context.parsed.y ?? 0).toLocaleString()}`,
            afterLabel: (context) => {
              const day = recent7DayUsage.daily[context.dataIndex];
              return day
                ? `${t('dashboard.total_tokens')}: ${formatCompactNumber(day.totalTokens)}`
                : '';
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          border: {
            color: axisBorderColor,
          },
          ticks: {
            color: tickColor,
            font: { size: tickFontSize },
            maxRotation: 0,
            minRotation: 0,
            autoSkip: false,
            callback: (_value, index) => recent7DayUsage.daily[index]?.weekdayLabel ?? '',
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: gridColor,
          },
          border: {
            color: axisBorderColor,
          },
          ticks: {
            color: tickColor,
            font: { size: tickFontSize },
            precision: 0,
          },
        },
      },
    };
  }, [isDark, isMobile, recent7DayUsage.daily, t]);

  const recentUsageStatusText = usageLoading
    ? t('common.loading')
    : config?.usageStatisticsEnabled === false
      ? `${t('basic_settings.usage_statistics_enable')}: ${t('common.no')}`
      : usageRefreshText || t('dashboard.no_usage_data');

  return (
    <div className={styles.dashboard}>
      <PageHero
        className={styles.pageHero}
        supportClassName={styles.heroSupport}
        eyebrow={t(greetingKey)}
        title={t('dashboard.title')}
        description={
          <span className={styles.heroDescription}>
            <span className={styles.heroDescriptionStrong}>{t('dashboard.welcome_back')}</span>
            <span className={styles.heroDescriptionDivider} aria-hidden="true">
              /
            </span>
            <span>{t(caringKey)}</span>
          </span>
        }
      >
        <Link to="/usage" className={styles.todayUsageCard}>
          <div className={styles.todayUsageHeader}>
            <div className={styles.todayUsageHeadingGroup}>
              <span className={styles.todayUsageEyebrow}>{t('dashboard.usage_overview')}</span>
              <span className={styles.todayUsageTitle}>{formattedDate}</span>
            </div>
            <span className={styles.todayUsageAction}>{t('dashboard.view_detailed_usage')}</span>
          </div>

          <div className={styles.todayUsageMetrics}>
            {todayUsageMetrics.map((metric) => (
              <div
                key={metric.label}
                className={styles.todayUsageMetric}
                style={{ '--metric-accent': metric.accent } as CSSProperties}
              >
                <span className={styles.todayUsageMetricIcon}>{metric.icon}</span>
                <span className={styles.todayUsageMetricValue}>{metric.value}</span>
                <span className={styles.todayUsageMetricLabel}>{metric.label}</span>
              </div>
            ))}
          </div>

          <div className={styles.todayUsageFooter}>
            <span>{usageFooterText}</span>
            {usageRefreshText ? <span>{usageRefreshText}</span> : null}
          </div>
        </Link>
      </PageHero>

      <div className={styles.contentGrid}>
        <Card
          className={styles.overviewCard}
          title={t('dashboard.system_overview')}
          extra={
            <Link to="/config" className={styles.cardAction}>
              {t('dashboard.edit_settings')}
            </Link>
          }
        >
          <div className={styles.overviewBody}>
            <section className={styles.sectionBlock}>
              <div className={styles.summaryGrid}>
                {quickStats.map((stat) => (
                  <Link
                    key={stat.path}
                    to={stat.path}
                    className={styles.summaryLink}
                    style={
                      {
                        '--accent': stat.accent,
                        '--accent-soft': stat.accentSoft,
                        '--accent-border': stat.accentBorder,
                      } as CSSProperties
                    }
                  >
                    <div className={styles.summaryHeader}>
                      <span className={styles.summaryLabel}>{stat.label}</span>
                      <span className={styles.summaryIcon}>{stat.icon}</span>
                    </div>
                    <span className={styles.summaryValue}>{stat.loading ? '--' : stat.value}</span>
                    {stat.sublabel ? (
                      <span className={styles.summarySubLabel}>{stat.sublabel}</span>
                    ) : null}
                  </Link>
                ))}
              </div>
            </section>

            <div className={styles.sectionDivider} />

            <section className={styles.sectionBlock}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>{t('dashboard.current_config')}</span>
              </div>

              {configItems.length ? (
                <div className={styles.configGrid}>
                  {configItems.map((item) => (
                    <div
                      key={item.label}
                      className={`${styles.configPill} ${item.wide ? styles.configPillWide : ''}`.trim()}
                    >
                      <span className={styles.configPillLabel}>{item.label}</span>

                      {item.badgeClass ? (
                        <span className={`${styles.configBadge} ${item.badgeClass}`}>
                          {item.value}
                        </span>
                      ) : item.mono ? (
                        <span className={styles.configPillMono}>{item.value}</span>
                      ) : (
                        <span
                          className={`${styles.configPillValue} ${
                            item.tone === 'on' ? styles.on : item.tone === 'off' ? styles.off : ''
                          }`.trim()}
                        >
                          {item.value}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.configEmpty}>{t('common.loading')}</div>
              )}
            </section>
          </div>
        </Card>

        <Card
          className={styles.recentUsageCard}
          title={t('dashboard.recent_7d_usage')}
          extra={
            <Link to="/usage" className={styles.cardAction}>
              {t('dashboard.view_detailed_usage')}
            </Link>
          }
        >
          <div className={styles.recentUsagePanel}>
            <div className={styles.recentUsageMetrics}>
              {recent7DayMetrics.map((metric) => (
                <div key={metric.label} className={styles.recentUsageMetric}>
                  <span className={styles.recentUsageMetricValue}>{metric.value}</span>
                  <span className={styles.recentUsageMetricLabel}>{metric.label}</span>
                  {metric.meta ? (
                    <span className={styles.recentUsageMetricMeta}>{metric.meta}</span>
                  ) : null}
                </div>
              ))}
            </div>

            <div className={styles.recentUsageChartWrap}>
              <div className={styles.recentUsageChart}>
                <Line data={recent7DayChartData} options={recent7DayChartOptions} />
              </div>
            </div>

            <div className={styles.recentUsageStatus}>{recentUsageStatusText}</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
