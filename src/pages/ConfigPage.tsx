import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { parse as parseYaml, parseDocument } from 'yaml';
import { usePageTransitionLayer } from '@/components/common/PageTransitionLayer';
import { PageHero } from '@/components/layout/PageHero';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SegmentedTabs, type SegmentedTabsItem } from '@/components/ui/SegmentedTabs';
import {
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconCode,
  IconDiamond,
  IconRefreshCw,
  IconSearch,
  IconSettings,
  IconShield,
  IconTrendingUp,
} from '@/components/ui/icons';
import {
  getVisualSectionGroupDefinitions,
  VISUAL_SECTION_GROUP_IDS,
  type VisualSectionGroupId,
  VisualConfigEditor,
} from '@/components/config/VisualConfigEditor';
import { DiffModal } from '@/components/config/DiffModal';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useVisualConfig } from '@/hooks/useVisualConfig';
import { useNotificationStore, useAuthStore, useThemeStore, useConfigStore } from '@/stores';
import { configFileApi } from '@/services/api/configFile';
import styles from './ConfigPage.module.scss';

type ConfigEditorTab = VisualSectionGroupId | 'source';

const LazyConfigSourceEditor = lazy(() => import('@/components/config/ConfigSourceEditor'));

function isVisualConfigTab(value: string | null): value is VisualSectionGroupId {
  return value !== null && VISUAL_SECTION_GROUP_IDS.some((tab) => tab === value);
}

function readCommercialModeFromYaml(yamlContent: string): boolean {
  try {
    const parsed = parseYaml(yamlContent);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
    return Boolean((parsed as Record<string, unknown>)['commercial-mode']);
  } catch {
    return false;
  }
}

export function ConfigPage() {
  const { t } = useTranslation();
  const pageTransitionLayer = usePageTransitionLayer();
  const isCurrentLayer = pageTransitionLayer ? pageTransitionLayer.isCurrentLayer : true;
  const showNotification = useNotificationStore((state) => state.showNotification);
  const showConfirmation = useNotificationStore((state) => state.showConfirmation);
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const {
    visualValues,
    visualDirty,
    visualParseError,
    visualValidationErrors,
    visualHasPayloadValidationErrors,
    loadVisualValuesFromYaml,
    applyVisualChangesToYaml,
    setVisualValues,
  } = useVisualConfig();
  const visualGroupTabs = useMemo(() => getVisualSectionGroupDefinitions(t), [t]);

  const [activeTab, setActiveTab] = useState<ConfigEditorTab>(() => {
    const saved = localStorage.getItem('config-management:tab');
    if (saved === 'source') return saved;
    if (saved === 'visual') return 'core';
    if (isVisualConfigTab(saved)) return saved;
    return 'core';
  });

  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [serverYaml, setServerYaml] = useState('');
  const [mergedYaml, setMergedYaml] = useState('');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const [lastSearchedQuery, setLastSearchedQuery] = useState('');
  const editorRef = useRef<ReactCodeMirrorRef | null>(null);
  const floatingActionsRef = useRef<HTMLDivElement>(null);

  const disableControls = connectionStatus !== 'connected';
  const isSourceTab = activeTab === 'source';
  const activeVisualGroup = !isSourceTab
    ? visualGroupTabs.find((group) => group.id === activeTab) ?? visualGroupTabs[0]
    : null;
  const activeVisualGroupId = activeVisualGroup?.id ?? visualGroupTabs[0]?.id ?? 'core';
  const isDirty = dirty || visualDirty;
  const shouldRenderFloatingActions = isCurrentLayer;
  const hasVisualModeError = !!visualParseError;
  const hasVisualValidationErrors =
    !isSourceTab &&
    (Object.values(visualValidationErrors).some(Boolean) || visualHasPayloadValidationErrors);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await configFileApi.fetchConfigYaml();
      setContent(data);
      setDirty(false);
      setDiffModalOpen(false);
      setServerYaml(data);
      setMergedYaml(data);
      loadVisualValuesFromYaml(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('notification.refresh_failed');
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [loadVisualValuesFromYaml, t]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (isSourceTab || !visualParseError) return;

    setActiveTab('source');
    localStorage.setItem('config-management:tab', 'source');
    showNotification(
      t('config_management.visual_mode_unavailable_detail', { message: visualParseError }),
      'error'
    );
  }, [isSourceTab, showNotification, t, visualParseError]);

  const handleConfirmSave = async () => {
    setSaving(true);
    try {
      const previousCommercialMode = readCommercialModeFromYaml(serverYaml);
      const nextCommercialMode = readCommercialModeFromYaml(mergedYaml);
      const commercialModeChanged = previousCommercialMode !== nextCommercialMode;

      await configFileApi.saveConfigYaml(mergedYaml);
      const latestContent = await configFileApi.fetchConfigYaml();
      setDirty(false);
      setDiffModalOpen(false);
      setContent(latestContent);
      setServerYaml(latestContent);
      setMergedYaml(latestContent);
      loadVisualValuesFromYaml(latestContent);

      // Keep the global config store in sync so sidebar / other pages reflect YAML changes immediately.
      try {
        useConfigStore.getState().clearCache();
        await useConfigStore.getState().fetchConfig(undefined, true);
      } catch (refreshError: unknown) {
        const message =
          refreshError instanceof Error
            ? refreshError.message
            : typeof refreshError === 'string'
              ? refreshError
              : '';
        showNotification(
          `${t('notification.refresh_failed')}${message ? `: ${message}` : ''}`,
          'error'
        );
      }

      showNotification(t('config_management.save_success'), 'success');
      if (commercialModeChanged) {
        showNotification(t('notification.commercial_mode_restart_required'), 'warning');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      showNotification(`${t('notification.save_failed')}: ${message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!isSourceTab && visualParseError) {
      showNotification(t('config_management.visual_mode_save_blocked'), 'error');
      return;
    }

    setSaving(true);
    try {
      const latestServerYaml = await configFileApi.fetchConfigYaml();

      if (!isSourceTab) {
        const latestDocument = parseDocument(latestServerYaml);
        if (latestDocument.errors.length > 0) {
          showNotification(
            t('config_management.visual_mode_latest_yaml_invalid', {
              message:
                latestDocument.errors[0]?.message ??
                t('config_management.visual_mode_save_blocked'),
            }),
            'error'
          );
          return;
        }
      }

      // In source mode, save exactly what the user edited. In visual mode, materialize visual changes into the latest YAML.
      const nextMergedYaml =
        isSourceTab ? content : applyVisualChangesToYaml(latestServerYaml);

      // In visual mode, applyVisualChangesToYaml re-serializes YAML via parseDocument → toString,
      // which may reformat comments/whitespace. Normalize the server YAML through the same pipeline
      // so the diff only shows actual value changes, not cosmetic reformatting.
      let diffOriginal = latestServerYaml;
      if (!isSourceTab) {
        try {
          const doc = parseDocument(latestServerYaml);
          diffOriginal = doc.toString({ indent: 2, lineWidth: 120, minContentWidth: 0 });
        } catch {
          /* keep raw on parse failure */
        }
      }

      if (diffOriginal === nextMergedYaml) {
        setDirty(false);
        setContent(latestServerYaml);
        setServerYaml(latestServerYaml);
        setMergedYaml(nextMergedYaml);
        loadVisualValuesFromYaml(latestServerYaml);
        showNotification(t('config_management.diff.no_changes'), 'info');
        return;
      }

      setServerYaml(diffOriginal);
      setMergedYaml(nextMergedYaml);
      setDiffModalOpen(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      showNotification(`${t('notification.save_failed')}: ${message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = useCallback((value: string) => {
    setContent(value);
    setDirty(true);
  }, []);

  const handleTabChange = useCallback(
    (tab: ConfigEditorTab) => {
      if (tab === activeTab) return;

      const nextIsSourceTab = tab === 'source';
      const currentIsSourceTab = activeTab === 'source';

      if (nextIsSourceTab && !currentIsSourceTab) {
        // Only rewrite YAML when there are pending visual changes; otherwise preserve raw YAML + comments.
        if (visualDirty) {
          const nextContent = applyVisualChangesToYaml(content);
          if (nextContent !== content) {
            setContent(nextContent);
            setDirty(true);
          }
        }
      } else if (!nextIsSourceTab && currentIsSourceTab) {
        const result = loadVisualValuesFromYaml(content);
        if (!result.ok) {
          showNotification(
            t('config_management.visual_mode_unavailable_detail', { message: result.error }),
            'error'
          );
          return;
        }
      }

      setActiveTab(tab);
      localStorage.setItem('config-management:tab', tab);
    },
    [
      activeTab,
      applyVisualChangesToYaml,
      content,
      loadVisualValuesFromYaml,
      showNotification,
      t,
      visualDirty,
    ]
  );

  // Search functionality
  const performSearch = useCallback((query: string, direction: 'next' | 'prev' = 'next') => {
    if (!query || !editorRef.current?.view) return;

    const view = editorRef.current.view;
    const doc = view.state.doc.toString();
    const matches: number[] = [];
    const lowerQuery = query.toLowerCase();
    const lowerDoc = doc.toLowerCase();

    let pos = 0;
    while (pos < lowerDoc.length) {
      const index = lowerDoc.indexOf(lowerQuery, pos);
      if (index === -1) break;
      matches.push(index);
      pos = index + 1;
    }

    if (matches.length === 0) {
      setSearchResults({ current: 0, total: 0 });
      return;
    }

    // Find current match based on cursor position
    const selection = view.state.selection.main;
    const cursorPos = direction === 'prev' ? selection.from : selection.to;
    let currentIndex = 0;

    if (direction === 'next') {
      // Find next match after cursor
      for (let i = 0; i < matches.length; i++) {
        if (matches[i] > cursorPos) {
          currentIndex = i;
          break;
        }
        // If no match after cursor, wrap to first
        if (i === matches.length - 1) {
          currentIndex = 0;
        }
      }
    } else {
      // Find previous match before cursor
      for (let i = matches.length - 1; i >= 0; i--) {
        if (matches[i] < cursorPos) {
          currentIndex = i;
          break;
        }
        // If no match before cursor, wrap to last
        if (i === 0) {
          currentIndex = matches.length - 1;
        }
      }
    }

    const matchPos = matches[currentIndex];
    setSearchResults({ current: currentIndex + 1, total: matches.length });

    // Scroll to and select the match
    view.dispatch({
      selection: { anchor: matchPos, head: matchPos + query.length },
      scrollIntoView: true,
    });
    view.focus();
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    // Do not auto-search on each keystroke. Clear previous results when query changes.
    if (!value) {
      setSearchResults({ current: 0, total: 0 });
      setLastSearchedQuery('');
    } else {
      setSearchResults({ current: 0, total: 0 });
    }
  }, []);

  const executeSearch = useCallback(
    (direction: 'next' | 'prev' = 'next') => {
      if (!searchQuery) return;
      setLastSearchedQuery(searchQuery);
      performSearch(searchQuery, direction);
    },
    [searchQuery, performSearch]
  );

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeSearch(e.shiftKey ? 'prev' : 'next');
      }
    },
    [executeSearch]
  );

  const handlePrevMatch = useCallback(() => {
    if (!lastSearchedQuery) return;
    performSearch(lastSearchedQuery, 'prev');
  }, [lastSearchedQuery, performSearch]);

  const handleNextMatch = useCallback(() => {
    if (!lastSearchedQuery) return;
    performSearch(lastSearchedQuery, 'next');
  }, [lastSearchedQuery, performSearch]);

  // Keep bottom floating actions from covering page content by syncing its height to a CSS variable.
  useLayoutEffect(() => {
    if (typeof window === 'undefined' || !shouldRenderFloatingActions) return;

    const actionsEl = floatingActionsRef.current;
    if (!actionsEl) return;

    const updatePadding = () => {
      const height = actionsEl.getBoundingClientRect().height;
      document.documentElement.style.setProperty('--config-action-bar-height', `${height}px`);
    };

    updatePadding();
    window.addEventListener('resize', updatePadding);

    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updatePadding);
    ro?.observe(actionsEl);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', updatePadding);
      document.documentElement.style.removeProperty('--config-action-bar-height');
    };
  }, [shouldRenderFloatingActions]);

  // Status text
  const getStatusText = () => {
    if (disableControls) return t('config_management.status_disconnected');
    if (loading) return t('config_management.status_loading');
    if (error) return t('config_management.status_load_failed');
    if (hasVisualModeError) return t('config_management.visual_mode_unavailable');
    if (hasVisualValidationErrors)
      return t('config_management.visual.validation.validation_blocked');
    if (saving) return t('config_management.status_saving');
    if (isDirty) return t('config_management.status_dirty');
    return t('config_management.status_loaded');
  };

  const getStatusClass = () => {
    if (error || hasVisualModeError || hasVisualValidationErrors) return styles.error;
    if (isDirty) return styles.modified;
    if (!loading && !saving) return styles.saved;
    return '';
  };

  const getFloatingStatusText = () => {
    if (!isMobile) return getStatusText();
    if (disableControls)
      return t('config_management.status_disconnected_short', { defaultValue: 'Disconnected' });
    if (loading) return t('config_management.status_loading_short', { defaultValue: 'Loading' });
    if (error) return t('config_management.status_load_failed_short', { defaultValue: 'Failed' });
    if (hasVisualModeError)
      return t('config_management.visual_mode_unavailable_short', { defaultValue: 'YAML issue' });
    if (hasVisualValidationErrors)
      return t('config_management.visual.validation_blocked_short', { defaultValue: 'Fix errors' });
    if (saving) return t('config_management.status_saving_short', { defaultValue: 'Saving' });
    if (isDirty) return t('config_management.status_dirty_short', { defaultValue: 'Unsaved' });
    return t('config_management.status_loaded_short', { defaultValue: 'Loaded' });
  };

  const handleReload = useCallback(() => {
    if (!isDirty) {
      void loadConfig();
      return;
    }

    showConfirmation({
      title: t('common.unsaved_changes_title'),
      message: t('config_management.reload_confirm_message'),
      confirmText: t('config_management.reload'),
      cancelText: t('common.cancel'),
      variant: 'danger',
      onConfirm: async () => {
        await loadConfig();
      },
    });
  }, [isDirty, loadConfig, showConfirmation, t]);

  const floatingActions = (
    <div className={styles.floatingActionContainer} ref={floatingActionsRef}>
      <div className={styles.floatingActionList}>
        <div
          className={`${styles.floatingStatus} ${
            isMobile ? styles.floatingStatusCompact : ''
          } ${getStatusClass()}`}
        >
          {getFloatingStatusText()}
        </div>
        <button
          type="button"
          className={styles.floatingActionButton}
          onClick={handleReload}
          disabled={loading || saving}
          title={t('config_management.reload')}
          aria-label={t('config_management.reload')}
        >
          <IconRefreshCw size={16} />
        </button>
        <button
          type="button"
          className={styles.floatingActionButton}
          onClick={handleSave}
          disabled={
            disableControls ||
            loading ||
            saving ||
            !isDirty ||
            diffModalOpen ||
            hasVisualModeError ||
            hasVisualValidationErrors
          }
          title={t('config_management.save')}
          aria-label={t('config_management.save')}
        >
          <IconCheck size={16} />
          {isDirty && <span className={styles.dirtyDot} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );

  const pageDescription = isSourceTab
    ? t('config_management.description')
    : activeVisualGroup?.description ??
      t('config_management.visual.notice', {
        defaultValue: '分组模式覆盖常用字段，未覆盖的配置仍需在源文件模式中查看或编辑。',
      });
  const activeTabLabel = isSourceTab
    ? t('config_management.tabs.source', { defaultValue: '源文件编辑' })
    : activeVisualGroup?.title ??
      t('config_management.tabs.visual', { defaultValue: '分组配置' });
  const toolbarContextLabel = isSourceTab
    ? 'YAML'
    : t('config_management.visual.group_section_total', {
        defaultValue: `${activeVisualGroup?.sectionIds.length ?? 0} 个区块`,
      });
  const topLevelTabs = useMemo<ReadonlyArray<SegmentedTabsItem<ConfigEditorTab>>>(
    () => [
      ...visualGroupTabs.map((group) => {
        const icon =
          group.id === 'core' ? (
            <IconSettings size={16} />
          ) : group.id === 'access' ? (
            <IconShield size={16} />
          ) : group.id === 'runtime' ? (
            <IconTrendingUp size={16} />
          ) : (
            <IconDiamond size={16} />
          );

        return {
          value: group.id as ConfigEditorTab,
          label: group.title,
          title: group.description,
          leading: icon,
          trailing: <span className={styles.tabItemBadge}>{group.sectionIds.length}</span>,
          disabled: saving || loading,
        };
      }),
      {
        value: 'source' as ConfigEditorTab,
        label: t('config_management.tabs.source', { defaultValue: '源文件编辑' }),
        leading: <IconCode size={16} />,
        trailing: <span className={styles.tabItemBadge}>YAML</span>,
        disabled: saving || loading,
      },
    ],
    [loading, saving, t, visualGroupTabs]
  );

  return (
    <div className={styles.container}>
      <PageHero
        eyebrow={t('config_management.editor_title', { defaultValue: '配置文件' })}
        title={t('config_management.title')}
        description={t('config_management.description')}
        meta={<div className={`${styles.statusBadge} ${getStatusClass()}`}>{getStatusText()}</div>}
        supportClassName={styles.heroSupport}
      >
        <SegmentedTabs
          items={topLevelTabs}
          value={activeTab}
          onChange={handleTabChange}
          variant="card"
          ariaLabel={t('config_management.title')}
          className={styles.tabBar}
        />
      </PageHero>

      <div className={styles.workspaceShell}>
        <div className={styles.content}>
          {error && <div className="error-box">{error}</div>}
          {!error && visualParseError && (
            <div className="error-box">
              {t('config_management.visual_mode_unavailable_detail', { message: visualParseError })}
            </div>
          )}

          <div className={styles.workspaceToolbar}>
            <div className={styles.toolbarMeta}>
              <div className={styles.toolbarCopy}>
                <span className={styles.toolbarTitle}>{activeTabLabel}</span>
                <p className={styles.toolbarHint}>{pageDescription}</p>
              </div>
              <div className={styles.toolbarBadges}>
                <div className={`${styles.inlineStatus} ${getStatusClass()}`}>
                  {getStatusText()}
                </div>
                <span className={styles.toolbarChip}>{toolbarContextLabel}</span>
                {isSourceTab && searchQuery && lastSearchedQuery === searchQuery && (
                  <span className={styles.toolbarChip}>
                    {searchResults.total > 0
                      ? `${searchResults.current} / ${searchResults.total}`
                      : t('config_management.search_no_results', {
                          defaultValue: '无结果',
                        })}
                  </span>
                )}
              </div>
            </div>

            <div className={styles.toolbarActions}>
              {isSourceTab && (
                <div className={styles.searchDock}>
                  <div className={styles.searchInputWrapper}>
                    <Input
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                      placeholder={t('config_management.search_placeholder', {
                        defaultValue: '搜索配置内容...',
                      })}
                      disabled={disableControls || loading}
                      className={styles.searchInput}
                      rightElement={
                        <div className={styles.searchRight}>
                          {searchQuery && lastSearchedQuery === searchQuery && (
                            <span className={styles.searchCount}>
                              {searchResults.total > 0
                                ? `${searchResults.current} / ${searchResults.total}`
                                : t('config_management.search_no_results', {
                                    defaultValue: '无结果',
                                  })}
                            </span>
                          )}
                          <button
                            type="button"
                            className={styles.searchButton}
                            onClick={() => executeSearch('next')}
                            disabled={!searchQuery || disableControls || loading}
                            title={t('config_management.search_button', {
                              defaultValue: '搜索',
                            })}
                          >
                            <IconSearch size={16} />
                          </button>
                        </div>
                      }
                    />
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    className={styles.iconAction}
                    onClick={handlePrevMatch}
                    disabled={
                      !searchQuery || lastSearchedQuery !== searchQuery || searchResults.total === 0
                    }
                    title={t('config_management.search_prev', { defaultValue: '上一个' })}
                  >
                    <IconChevronUp size={16} />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className={styles.iconAction}
                    onClick={handleNextMatch}
                    disabled={
                      !searchQuery || lastSearchedQuery !== searchQuery || searchResults.total === 0
                    }
                    title={t('config_management.search_next', { defaultValue: '下一个' })}
                  >
                    <IconChevronDown size={16} />
                  </Button>
                </div>
              )}

              <div className={styles.primaryActions}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleReload}
                  disabled={loading || saving}
                >
                  {t('config_management.reload')}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={
                    disableControls ||
                    loading ||
                    saving ||
                    !isDirty ||
                    diffModalOpen ||
                    hasVisualModeError ||
                    hasVisualValidationErrors
                  }
                >
                  {t('config_management.save')}
                </Button>
              </div>
            </div>
          </div>

          <div className={styles.stageSurface}>
            {!isSourceTab ? (
              <div className={styles.visualStage}>
                <VisualConfigEditor
                  activeGroupId={activeVisualGroupId}
                  values={visualValues}
                  validationErrors={visualValidationErrors}
                  hasPayloadValidationErrors={visualHasPayloadValidationErrors}
                  disabled={disableControls || loading}
                  onChange={setVisualValues}
                />
              </div>
            ) : (
              <div className={styles.sourceEditorStage}>
                <div className={styles.editorWrapper}>
                  <Suspense fallback={null}>
                    <LazyConfigSourceEditor
                      editorRef={editorRef}
                      value={content}
                      onChange={handleChange}
                      theme={resolvedTheme}
                      editable={!disableControls && !loading}
                      placeholder={t('config_management.editor_placeholder')}
                    />
                  </Suspense>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {shouldRenderFloatingActions && typeof document !== 'undefined'
        ? createPortal(floatingActions, document.body)
        : null}
      <DiffModal
        open={diffModalOpen}
        original={serverYaml}
        modified={mergedYaml}
        onConfirm={handleConfirmSave}
        onCancel={() => setDiffModalOpen(false)}
        loading={saving}
      />
    </div>
  );
}
