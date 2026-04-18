import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import {
  useAuthStore,
  useConfigStore,
  useThemeStore,
  useUsageStatsStore,
  USAGE_STATS_STALE_TIME_MS,
} from '@/stores';
import { authFilesApi } from '@/services/api';
import type { CredentialInfo, SourceInfo } from '@/types/sourceInfo';
import type { Config, ModelAlias } from '@/types';
import type { MonitorTimeRange, UsageData } from '@/types/monitor';
import { buildSourceInfoMap } from '@/utils/sourceResolver';
import { filterDataByApiFilter, filterDataByTimeRange } from '@/utils/monitor';
import { normalizeAuthIndex } from '@/utils/usage';

export const MONITOR_TIME_RANGES: MonitorTimeRange[] = [1, 7, 14, 30];

const MONITOR_METADATA_STALE_TIME_MS = 240_000;

interface UseMonitorInsightsDataReturn {
  isDark: boolean;
  loading: boolean;
  error: string | null;
  usageData: UsageData | null;
  timeRange: MonitorTimeRange;
  setTimeRange: (range: MonitorTimeRange) => void;
  apiFilter: string;
  setApiFilter: (value: string) => void;
  reload: () => Promise<void>;
  apiFilteredData: UsageData | null;
  filteredData: UsageData | null;
  providerMap: Record<string, string>;
  providerModels: Record<string, Set<string>>;
  providerTypeMap: Record<string, string>;
  sourceInfoMap: Map<string, SourceInfo>;
  authFileMap: Map<string, CredentialInfo>;
}

interface UseMonitorInsightsOptions {
  registerHeaderRefresh?: boolean;
}

interface MonitorMetadata {
  authFileMap: Map<string, CredentialInfo>;
}

interface MonitorMetadataCache {
  scopeKey: string;
  timestamp: number;
  value: MonitorMetadata;
}

let monitorMetadataCache: MonitorMetadataCache | null = null;
let inFlightMonitorMetadataRequest: { scopeKey: string; promise: Promise<MonitorMetadata> } | null =
  null;

const buildModelSet = (models?: ModelAlias[]): Set<string> => {
  const modelSet = new Set<string>();
  (models || []).forEach((model) => {
    if (model.alias) modelSet.add(model.alias);
    if (model.name) modelSet.add(model.name);
  });
  return modelSet;
};

const buildProviderMetadata = (config: Config | null) => {
  const providerMap: Record<string, string> = {};
  const providerModels: Record<string, Set<string>> = {};
  const providerTypeMap: Record<string, string> = {};

  (config?.openaiCompatibility || []).forEach((provider) => {
    const providerName = provider.headers?.['X-Provider'] || provider.name || 'unknown';
    const modelSet = buildModelSet(provider.models);

    (provider.apiKeyEntries || []).forEach((entry) => {
      if (!entry.apiKey) return;
      providerMap[entry.apiKey] = providerName;
      providerTypeMap[entry.apiKey] = 'OpenAI';
      if (modelSet.size) {
        providerModels[entry.apiKey] = new Set(modelSet);
      }
    });

    if (provider.name) {
      providerMap[provider.name] = providerName;
      providerTypeMap[provider.name] = 'OpenAI';
      if (modelSet.size) {
        providerModels[provider.name] = new Set(modelSet);
      }
    }
  });

  (config?.geminiApiKeys || []).forEach((provider, index) => {
    if (!provider.apiKey) return;
    providerMap[provider.apiKey] = provider.prefix?.trim() || `Gemini #${index + 1}`;
    providerTypeMap[provider.apiKey] = 'Gemini';
    const modelSet = buildModelSet(provider.models);
    if (modelSet.size) {
      providerModels[provider.apiKey] = modelSet;
    }
  });

  (config?.claudeApiKeys || []).forEach((provider, index) => {
    if (!provider.apiKey) return;
    providerMap[provider.apiKey] = provider.prefix?.trim() || `Claude #${index + 1}`;
    providerTypeMap[provider.apiKey] = 'Claude';
    const modelSet = buildModelSet(provider.models);
    if (modelSet.size) {
      providerModels[provider.apiKey] = modelSet;
    }
  });

  (config?.codexApiKeys || []).forEach((provider, index) => {
    if (!provider.apiKey) return;
    providerMap[provider.apiKey] = provider.prefix?.trim() || `Codex #${index + 1}`;
    providerTypeMap[provider.apiKey] = 'Codex';
    const modelSet = buildModelSet(provider.models);
    if (modelSet.size) {
      providerModels[provider.apiKey] = modelSet;
    }
  });

  (config?.vertexApiKeys || []).forEach((provider, index) => {
    if (!provider.apiKey) return;
    providerMap[provider.apiKey] = provider.prefix?.trim() || `Vertex #${index + 1}`;
    providerTypeMap[provider.apiKey] = 'Vertex';
    const modelSet = buildModelSet(provider.models);
    if (modelSet.size) {
      providerModels[provider.apiKey] = modelSet;
    }
  });

  return {
    providerMap,
    providerModels,
    providerTypeMap,
    sourceInfoMap: buildSourceInfoMap({
      geminiApiKeys: config?.geminiApiKeys || [],
      claudeApiKeys: config?.claudeApiKeys || [],
      codexApiKeys: config?.codexApiKeys || [],
      vertexApiKeys: config?.vertexApiKeys || [],
      openaiCompatibility: config?.openaiCompatibility || [],
    }),
  };
};

const buildAuthFileMap = (files: unknown[] | undefined): Map<string, CredentialInfo> => {
  const credentialMap = new Map<string, CredentialInfo>();

  (files || []).forEach((file) => {
    if (!file || typeof file !== 'object') return;
    const item = file as Record<string, unknown>;
    const key = normalizeAuthIndex(item['auth_index'] ?? item['authIndex']);
    if (!key) return;
    credentialMap.set(key, {
      name: String(item.name || key),
      type: String(item.type || item.provider || ''),
    });
  });

  return credentialMap;
};

const getMonitorScopeKey = () => {
  const { apiBase = '', managementKey = '' } = useAuthStore.getState();
  return `${apiBase}::${managementKey}`;
};

const getCachedMonitorMetadata = (scopeKey: string): MonitorMetadata | null => {
  if (!monitorMetadataCache || monitorMetadataCache.scopeKey !== scopeKey) {
    return null;
  }

  if (Date.now() - monitorMetadataCache.timestamp > MONITOR_METADATA_STALE_TIME_MS) {
    return null;
  }

  return monitorMetadataCache.value;
};

const loadMonitorMetadata = async (scopeKey: string, force = false): Promise<MonitorMetadata> => {
  if (!scopeKey) {
    return { authFileMap: new Map() };
  }

  const cached = getCachedMonitorMetadata(scopeKey);
  if (!force && cached) {
    return cached;
  }

  if (inFlightMonitorMetadataRequest && inFlightMonitorMetadataRequest.scopeKey === scopeKey) {
    return inFlightMonitorMetadataRequest.promise;
  }

  if (inFlightMonitorMetadataRequest && inFlightMonitorMetadataRequest.scopeKey !== scopeKey) {
    inFlightMonitorMetadataRequest = null;
  }

  const requestPromise = authFilesApi
    .list()
    .then((response) => {
      const nextValue = {
        authFileMap: buildAuthFileMap((response as { files?: unknown[] })?.files),
      };
      monitorMetadataCache = {
        scopeKey,
        timestamp: Date.now(),
        value: nextValue,
      };
      return nextValue;
    })
    .finally(() => {
      if (inFlightMonitorMetadataRequest?.scopeKey === scopeKey) {
        inFlightMonitorMetadataRequest = null;
      }
    });

  inFlightMonitorMetadataRequest = { scopeKey, promise: requestPromise };
  return requestPromise;
};

export async function preloadMonitorInsightsData(force = false): Promise<void> {
  const configState = useConfigStore.getState();
  const scopeKey = getMonitorScopeKey();

  const tasks: Array<Promise<unknown>> = [
    useUsageStatsStore.getState().loadUsageStats({ force, staleTimeMs: USAGE_STATS_STALE_TIME_MS }),
    loadMonitorMetadata(scopeKey, force),
  ];

  if (force || !configState.config) {
    tasks.push(configState.fetchConfig(undefined, force));
  }

  await Promise.allSettled(tasks);
}

export function useMonitorInsightsData(
  initialTimeRange: MonitorTimeRange = 7,
  options: UseMonitorInsightsOptions = {}
): UseMonitorInsightsDataReturn {
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const isDark = resolvedTheme === 'dark';
  const { registerHeaderRefresh = true } = options;

  const config = useConfigStore((state) => state.config);
  const fetchConfig = useConfigStore((state) => state.fetchConfig);

  const usageSnapshot = useUsageStatsStore((state) => state.usage);
  const usageLoading = useUsageStatsStore((state) => state.loading);
  const usageError = useUsageStatsStore((state) => state.error);
  const loadUsageStats = useUsageStatsStore((state) => state.loadUsageStats);

  const apiBase = useAuthStore((state) => state.apiBase);
  const managementKey = useAuthStore((state) => state.managementKey);
  const scopeKey = `${apiBase || ''}::${managementKey || ''}`;

  const [timeRange, setTimeRange] = useState<MonitorTimeRange>(initialTimeRange);
  const [apiFilter, setApiFilter] = useState('');
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [authFileMap, setAuthFileMap] = useState<Map<string, CredentialInfo>>(
    () => getCachedMonitorMetadata(scopeKey)?.authFileMap || new Map()
  );

  const usageData = useMemo(
    () =>
      usageSnapshot &&
      typeof usageSnapshot === 'object' &&
      'apis' in usageSnapshot &&
      usageSnapshot.apis &&
      typeof usageSnapshot.apis === 'object'
        ? (usageSnapshot as unknown as UsageData)
        : null,
    [usageSnapshot]
  );

  const { providerMap, providerModels, providerTypeMap, sourceInfoMap } = useMemo(
    () => buildProviderMetadata(config),
    [config]
  );

  const syncMetadata = useCallback(
    async (force = false) => {
      const cachedMetadata = !force ? getCachedMonitorMetadata(scopeKey) : null;
      const shouldShowLoading = force || !cachedMetadata;

      if (cachedMetadata) {
        setAuthFileMap(cachedMetadata.authFileMap);
      }

      if (force || !config) {
        try {
          await fetchConfig(undefined, force);
        } catch {
          // 配置获取失败时保持现有映射，避免阻塞主数据展示
        }
      }

      if (shouldShowLoading) {
        setMetadataLoading(true);
      }
      try {
        const metadata = await loadMonitorMetadata(scopeKey, force);
        setAuthFileMap(metadata.authFileMap);
      } catch (error) {
        console.warn('Monitor: Failed to load metadata:', error);
        setAuthFileMap(new Map());
      } finally {
        if (shouldShowLoading) {
          setMetadataLoading(false);
        }
      }
    },
    [config, fetchConfig, scopeKey]
  );

  const reload = useCallback(async () => {
    await Promise.allSettled([
      loadUsageStats({ force: true, staleTimeMs: USAGE_STATS_STALE_TIME_MS }),
      syncMetadata(true),
    ]);
  }, [loadUsageStats, syncMetadata]);

  useEffect(() => {
    void loadUsageStats({ staleTimeMs: USAGE_STATS_STALE_TIME_MS }).catch(() => undefined);
    void syncMetadata(false);
  }, [loadUsageStats, syncMetadata]);

  useHeaderRefresh(reload, registerHeaderRefresh);

  const apiFilteredData = useMemo(
    () => filterDataByApiFilter(usageData, apiFilter),
    [apiFilter, usageData]
  );
  const filteredData = useMemo(
    () => filterDataByTimeRange(apiFilteredData, timeRange),
    [apiFilteredData, timeRange]
  );

  return {
    isDark,
    loading: usageLoading || metadataLoading,
    error: usageError,
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
    providerTypeMap,
    sourceInfoMap,
    authFileMap,
  };
}
