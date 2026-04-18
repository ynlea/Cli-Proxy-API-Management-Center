/**
 * Quota management page - coordinates the provider quota workspaces.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { PageHero } from '@/components/layout/PageHero';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { useAuthStore } from '@/stores';
import { authFilesApi, configFileApi } from '@/services/api';
import {
  QuotaSection,
  ANTIGRAVITY_CONFIG,
  CLAUDE_CONFIG,
  CODEX_CONFIG,
  GEMINI_CLI_CONFIG,
  KIMI_CONFIG,
} from '@/components/quota';
import type { AuthFileItem } from '@/types';
import styles from './QuotaPage.module.scss';

type QuotaPanelId = 'claude' | 'antigravity' | 'codex' | 'gemini-cli' | 'kimi';

export function QuotaPage() {
  const { t } = useTranslation();
  const connectionStatus = useAuthStore((state) => state.connectionStatus);

  const [files, setFiles] = useState<AuthFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePanel, setActivePanel] = useState<QuotaPanelId>('claude');
  const [hasResolvedInitialPanel, setHasResolvedInitialPanel] = useState(false);
  const [hasManualPanelSelection, setHasManualPanelSelection] = useState(false);

  const disableControls = connectionStatus !== 'connected';

  const loadConfig = useCallback(async () => {
    try {
      await configFileApi.fetchConfigYaml();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('notification.refresh_failed');
      setError((prev) => prev || errorMessage);
    }
  }, [t]);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await authFilesApi.list();
      setFiles(data?.files || []);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('notification.refresh_failed');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const handleHeaderRefresh = useCallback(async () => {
    await Promise.all([loadConfig(), loadFiles()]);
  }, [loadConfig, loadFiles]);

  useHeaderRefresh(handleHeaderRefresh);

  useEffect(() => {
    loadFiles();
    loadConfig();
  }, [loadFiles, loadConfig]);

  const quotaPanels = useMemo(
    () => [
      {
        id: 'claude' as const,
        label: t(`${CLAUDE_CONFIG.i18nPrefix}.title`),
        count: files.filter((file) => CLAUDE_CONFIG.filterFn(file)).length,
      },
      {
        id: 'antigravity' as const,
        label: t(`${ANTIGRAVITY_CONFIG.i18nPrefix}.title`),
        count: files.filter((file) => ANTIGRAVITY_CONFIG.filterFn(file)).length,
      },
      {
        id: 'codex' as const,
        label: t(`${CODEX_CONFIG.i18nPrefix}.title`),
        count: files.filter((file) => CODEX_CONFIG.filterFn(file)).length,
      },
      {
        id: 'gemini-cli' as const,
        label: t(`${GEMINI_CLI_CONFIG.i18nPrefix}.title`),
        count: files.filter((file) => GEMINI_CLI_CONFIG.filterFn(file)).length,
      },
      {
        id: 'kimi' as const,
        label: t(`${KIMI_CONFIG.i18nPrefix}.title`),
        count: files.filter((file) => KIMI_CONFIG.filterFn(file)).length,
      },
    ],
    [files, t]
  );
  const tabItems = useMemo(
    () =>
      quotaPanels.map((panel) => ({
        value: panel.id,
        label: panel.label,
        trailing: <span className={styles.panelTabCount}>{panel.count}</span>,
      })),
    [quotaPanels]
  );
  const preferredInitialPanel = useMemo<QuotaPanelId>(
    () => quotaPanels.find((panel) => panel.count > 0)?.id ?? 'claude',
    [quotaPanels]
  );

  useEffect(() => {
    if (loading || hasResolvedInitialPanel || hasManualPanelSelection) {
      return;
    }

    setActivePanel(preferredInitialPanel);
    setHasResolvedInitialPanel(true);
  }, [hasManualPanelSelection, hasResolvedInitialPanel, loading, preferredInitialPanel]);

  const handlePanelChange = useCallback((nextPanel: QuotaPanelId) => {
    setHasManualPanelSelection(true);
    setActivePanel(nextPanel);
  }, []);

  const renderActiveSection = () => {
    if (activePanel === 'claude') {
      return (
        <QuotaSection
          config={CLAUDE_CONFIG}
          files={files}
          loading={loading}
          disabled={disableControls}
        />
      );
    }

    if (activePanel === 'antigravity') {
      return (
        <QuotaSection
          config={ANTIGRAVITY_CONFIG}
          files={files}
          loading={loading}
          disabled={disableControls}
        />
      );
    }

    if (activePanel === 'codex') {
      return (
        <QuotaSection
          config={CODEX_CONFIG}
          files={files}
          loading={loading}
          disabled={disableControls}
        />
      );
    }

    if (activePanel === 'gemini-cli') {
      return (
        <QuotaSection
          config={GEMINI_CLI_CONFIG}
          files={files}
          loading={loading}
          disabled={disableControls}
        />
      );
    }

    return (
      <QuotaSection
        config={KIMI_CONFIG}
        files={files}
        loading={loading}
        disabled={disableControls}
      />
    );
  };

  return (
    <div className={styles.container}>
      <PageHero title={t('quota_management.title')} description={t('quota_management.description')}>
        <SegmentedTabs
          items={tabItems}
          value={activePanel}
          onChange={handlePanelChange}
          variant="card"
          ariaLabel={t('quota_management.title')}
        />
      </PageHero>

      {error && <div className={styles.errorBox}>{error}</div>}

      <div className={styles.workspaceShell}>
        <div className={styles.quotaStage}>{renderActiveSection()}</div>
      </div>
    </div>
  );
}
