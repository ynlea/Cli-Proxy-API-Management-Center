import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useChartData, useSparklines, useUsageData } from '@/components/usage';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useConfigStore, useThemeStore } from '@/stores';
import {
  filterUsageByTimeRange,
  getApiStats,
  getModelNamesFromUsage,
  getModelStats,
  type UsageTimeRange,
} from '@/utils/usage';
import type { Config } from '@/types';

const CHART_LINES_STORAGE_KEY = 'cli-proxy-usage-chart-lines-v1';
const TIME_RANGE_STORAGE_KEY = 'cli-proxy-usage-time-range-v1';
const DEFAULT_CHART_LINES = ['all'];
const DEFAULT_TIME_RANGE: UsageTimeRange = '24h';
const MAX_CHART_LINES = 9;
const TIME_RANGE_OPTIONS: ReadonlyArray<{ value: UsageTimeRange; labelKey: string }> = [
  { value: 'all', labelKey: 'usage_stats.range_all' },
  { value: '7h', labelKey: 'usage_stats.range_7h' },
  { value: '24h', labelKey: 'usage_stats.range_24h' },
  { value: '7d', labelKey: 'usage_stats.range_7d' },
];
const HOUR_WINDOW_BY_TIME_RANGE: Record<Exclude<UsageTimeRange, 'all'>, number> = {
  '7h': 7,
  '24h': 24,
  '7d': 7 * 24,
};

const isUsageTimeRange = (value: unknown): value is UsageTimeRange =>
  value === '7h' || value === '24h' || value === '7d' || value === 'all';

const normalizeChartLines = (value: unknown, maxLines = MAX_CHART_LINES): string[] => {
  if (!Array.isArray(value)) {
    return DEFAULT_CHART_LINES;
  }

  const filtered = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxLines);

  return filtered.length ? filtered : DEFAULT_CHART_LINES;
};

const loadChartLines = (): string[] => {
  try {
    if (typeof localStorage === 'undefined') {
      return DEFAULT_CHART_LINES;
    }
    const raw = localStorage.getItem(CHART_LINES_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_CHART_LINES;
    }
    return normalizeChartLines(JSON.parse(raw));
  } catch {
    return DEFAULT_CHART_LINES;
  }
};

const loadTimeRange = (defaultValue: UsageTimeRange): UsageTimeRange => {
  try {
    if (typeof localStorage === 'undefined') {
      return defaultValue;
    }
    const raw = localStorage.getItem(TIME_RANGE_STORAGE_KEY);
    return isUsageTimeRange(raw) ? raw : defaultValue;
  } catch {
    return defaultValue;
  }
};

interface UseUsageInsightsDataReturn {
  config: Config | null;
  isDark: boolean;
  isMobile: boolean;
  usage: ReturnType<typeof useUsageData>['usage'];
  filteredUsage: ReturnType<typeof useUsageData>['usage'];
  loading: boolean;
  error: string;
  lastRefreshedAt: Date | null;
  modelPrices: ReturnType<typeof useUsageData>['modelPrices'];
  manualModelPrices: ReturnType<typeof useUsageData>['manualModelPrices'];
  presetModelPrices: ReturnType<typeof useUsageData>['presetModelPrices'];
  modelPriceSources: ReturnType<typeof useUsageData>['modelPriceSources'];
  setModelPrices: ReturnType<typeof useUsageData>['setModelPrices'];
  loadUsage: () => Promise<void>;
  handleExport: () => Promise<void>;
  handleImport: () => void;
  handleImportChange: ReturnType<typeof useUsageData>['handleImportChange'];
  importInputRef: ReturnType<typeof useUsageData>['importInputRef'];
  exporting: boolean;
  importing: boolean;
  timeRange: UsageTimeRange;
  setTimeRange: (value: UsageTimeRange) => void;
  timeRangeOptions: Array<{ value: UsageTimeRange; label: string }>;
  chartLines: string[];
  handleChartLinesChange: (lines: string[]) => void;
  hourWindowHours: number | undefined;
  requestsSparkline: ReturnType<typeof useSparklines>['requestsSparkline'];
  tokensSparkline: ReturnType<typeof useSparklines>['tokensSparkline'];
  rpmSparkline: ReturnType<typeof useSparklines>['rpmSparkline'];
  tpmSparkline: ReturnType<typeof useSparklines>['tpmSparkline'];
  costSparkline: ReturnType<typeof useSparklines>['costSparkline'];
  requestsPeriod: ReturnType<typeof useChartData>['requestsPeriod'];
  setRequestsPeriod: ReturnType<typeof useChartData>['setRequestsPeriod'];
  tokensPeriod: ReturnType<typeof useChartData>['tokensPeriod'];
  setTokensPeriod: ReturnType<typeof useChartData>['setTokensPeriod'];
  requestsChartData: ReturnType<typeof useChartData>['requestsChartData'];
  tokensChartData: ReturnType<typeof useChartData>['tokensChartData'];
  requestsChartOptions: ReturnType<typeof useChartData>['requestsChartOptions'];
  tokensChartOptions: ReturnType<typeof useChartData>['tokensChartOptions'];
  modelNames: string[];
  apiStats: ReturnType<typeof getApiStats>;
  modelStats: ReturnType<typeof getModelStats>;
  hasPrices: boolean;
}

interface UseUsageInsightsOptions {
  registerHeaderRefresh?: boolean;
}

export function useUsageInsightsData(
  initialTimeRange: UsageTimeRange = DEFAULT_TIME_RANGE,
  options: UseUsageInsightsOptions = {}
): UseUsageInsightsDataReturn {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const config = useConfigStore((state) => state.config);
  const isDark = resolvedTheme === 'dark';
  const { registerHeaderRefresh = true } = options;

  const {
    usage,
    loading,
    error,
    lastRefreshedAt,
    modelPrices,
    manualModelPrices,
    presetModelPrices,
    modelPriceSources,
    setModelPrices,
    loadUsage,
    handleExport,
    handleImport,
    handleImportChange,
    importInputRef,
    exporting,
    importing,
  } = useUsageData();

  useHeaderRefresh(loadUsage, registerHeaderRefresh);

  const [chartLines, setChartLines] = useState<string[]>(loadChartLines);
  const [timeRange, setTimeRange] = useState<UsageTimeRange>(() => loadTimeRange(initialTimeRange));

  const timeRangeOptions = useMemo(
    () =>
      TIME_RANGE_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    [t]
  );

  const filteredUsage = useMemo(
    () => (usage ? filterUsageByTimeRange(usage, timeRange) : null),
    [timeRange, usage]
  );

  const hourWindowHours = timeRange === 'all' ? undefined : HOUR_WINDOW_BY_TIME_RANGE[timeRange];

  const handleChartLinesChange = useCallback((lines: string[]) => {
    setChartLines(normalizeChartLines(lines));
  }, []);

  useEffect(() => {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(CHART_LINES_STORAGE_KEY, JSON.stringify(chartLines));
    } catch {
      // Ignore storage errors.
    }
  }, [chartLines]);

  useEffect(() => {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(TIME_RANGE_STORAGE_KEY, timeRange);
    } catch {
      // Ignore storage errors.
    }
  }, [timeRange]);

  const nowMs = lastRefreshedAt?.getTime() ?? 0;
  const { requestsSparkline, tokensSparkline, rpmSparkline, tpmSparkline, costSparkline } =
    useSparklines({ usage: filteredUsage, loading, nowMs });

  const {
    requestsPeriod,
    setRequestsPeriod,
    tokensPeriod,
    setTokensPeriod,
    requestsChartData,
    tokensChartData,
    requestsChartOptions,
    tokensChartOptions,
  } = useChartData({ usage: filteredUsage, chartLines, isDark, isMobile, hourWindowHours });

  const modelNames = useMemo(() => getModelNamesFromUsage(usage), [usage]);
  const apiStats = useMemo(
    () => getApiStats(filteredUsage, modelPrices),
    [filteredUsage, modelPrices]
  );
  const modelStats = useMemo(
    () => getModelStats(filteredUsage, modelPrices),
    [filteredUsage, modelPrices]
  );
  const hasPrices = Object.keys(modelPrices).length > 0;

  return {
    config,
    isDark,
    isMobile,
    usage,
    filteredUsage,
    loading,
    error,
    lastRefreshedAt,
    modelPrices,
    manualModelPrices,
    presetModelPrices,
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
    chartLines,
    handleChartLinesChange,
    hourWindowHours,
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
    apiStats,
    modelStats,
    hasPrices,
  };
}
