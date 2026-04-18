import {
  useCallback,
  useId,
  useMemo,
  type ComponentType,
  type ReactNode,
} from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import {
  IconCode,
  IconDiamond,
  IconKey,
  IconSatellite,
  IconSettings,
  IconShield,
  IconTimer,
  IconTrendingUp,
  type IconProps,
} from '@/components/ui/icons';
import { ConfigSection } from '@/components/config/ConfigSection';
import type {
  PayloadFilterRule,
  PayloadParamValidationErrorCode,
  PayloadRule,
  VisualConfigFieldPath,
  VisualConfigValidationErrorCode,
  VisualConfigValidationErrors,
  VisualConfigValues,
} from '@/types/visualConfig';
import {
  ApiKeysCardEditor,
  PayloadFilterRulesEditor,
  PayloadRulesEditor,
} from './VisualConfigEditorBlocks';
import styles from './VisualConfigEditor.module.scss';

type VisualSectionId =
  | 'server'
  | 'tls'
  | 'remote'
  | 'auth'
  | 'system'
  | 'network'
  | 'quota'
  | 'streaming'
  | 'payload';

export const VISUAL_SECTION_GROUP_IDS = ['core', 'access', 'runtime', 'advanced'] as const;
export type VisualSectionGroupId = (typeof VISUAL_SECTION_GROUP_IDS)[number];

type VisualSection = {
  id: VisualSectionId;
  indexLabel: string;
  groupId: VisualSectionGroupId;
  title: string;
  description: string;
  icon: ComponentType<IconProps>;
  errorCount: number;
};

type VisualSectionGroupDefinition = {
  id: VisualSectionGroupId;
  sectionIds: VisualSectionId[];
  title: string;
  description: string;
};

const visualSectionGroupMeta = [
  {
    id: 'core',
    sectionIds: ['server', 'tls', 'remote'],
    titleKey: 'config_management.visual.groups.core.title',
    descriptionKey: 'config_management.visual.groups.core.description',
    defaultTitle: '基础配置',
    defaultDescription: '服务器、TLS 和远程管理放在一起，先把服务入口定稳。',
  },
  {
    id: 'access',
    sectionIds: ['auth', 'network'],
    titleKey: 'config_management.visual.groups.access.title',
    descriptionKey: 'config_management.visual.groups.access.description',
    defaultTitle: '接入与路由',
    defaultDescription: '认证目录、密钥和请求路由收在同一组，减少来回切换。',
  },
  {
    id: 'runtime',
    sectionIds: ['system', 'quota', 'streaming'],
    titleKey: 'config_management.visual.groups.runtime.title',
    descriptionKey: 'config_management.visual.groups.runtime.description',
    defaultTitle: '运行策略',
    defaultDescription: '系统行为、配额和流式选项统一管理，更适合连续调参。',
  },
  {
    id: 'advanced',
    sectionIds: ['payload'],
    titleKey: 'config_management.visual.groups.advanced.title',
    descriptionKey: 'config_management.visual.groups.advanced.description',
    defaultTitle: '高级规则',
    defaultDescription: '负载规则独立成区，保留足够空间给长表单和复杂规则。',
  },
] as const;

export function getVisualSectionGroupDefinitions(
  t: TFunction
): VisualSectionGroupDefinition[] {
  return visualSectionGroupMeta.map((group) => ({
    id: group.id,
    sectionIds: [...group.sectionIds],
    title: t(group.titleKey, { defaultValue: group.defaultTitle }),
    description: t(group.descriptionKey, { defaultValue: group.defaultDescription }),
  }));
}

interface VisualConfigEditorProps {
  activeGroupId: VisualSectionGroupId;
  values: VisualConfigValues;
  validationErrors?: VisualConfigValidationErrors;
  hasPayloadValidationErrors?: boolean;
  disabled?: boolean;
  onChange: (values: Partial<VisualConfigValues>) => void;
}

function getValidationMessage(
  t: ReturnType<typeof useTranslation>['t'],
  errorCode?: VisualConfigValidationErrorCode | PayloadParamValidationErrorCode
) {
  if (!errorCode) return undefined;
  return t(`config_management.visual.validation.${errorCode}`);
}

type ToggleRowProps = {
  title: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
};

function ToggleRow({ title, description, checked, disabled, onChange }: ToggleRowProps) {
  return (
    <div className={styles.toggleRow}>
      <div className={styles.toggleCopy}>
        <div className={styles.toggleTitle}>{title}</div>
        {description ? <div className={styles.toggleDescription}>{description}</div> : null}
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} disabled={disabled} ariaLabel={title} />
    </div>
  );
}

function SectionGrid({ children }: { children: ReactNode }) {
  return <div className={styles.sectionGrid}>{children}</div>;
}

function SectionStack({ children }: { children: ReactNode }) {
  return <div className={styles.sectionStack}>{children}</div>;
}

function Divider() {
  return <div className={styles.divider} />;
}

function SectionSubsection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.subsection}>
      <div className={styles.subsectionHeader}>
        <h3 className={styles.subsectionTitle}>{title}</h3>
        {description ? <p className={styles.subsectionDescription}>{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

function FieldShell({
  label,
  labelId,
  htmlFor,
  hint,
  hintId,
  error,
  errorId,
  children,
}: {
  label: string;
  labelId?: string;
  htmlFor?: string;
  hint?: string;
  hintId?: string;
  error?: string;
  errorId?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.fieldShell}>
      <label id={labelId} htmlFor={htmlFor} className={styles.fieldLabel}>
        {label}
      </label>
      {children}
      {error ? (
        <div id={errorId} className="error-box">
          {error}
        </div>
      ) : null}
      {hint ? (
        <div id={hintId} className={styles.fieldHint}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function VisualConfigEditor({
  activeGroupId,
  values,
  validationErrors,
  hasPayloadValidationErrors = false,
  disabled = false,
  onChange,
}: VisualConfigEditorProps) {
  const { t } = useTranslation();
  const routingStrategyLabelId = useId();
  const routingStrategyHintId = `${routingStrategyLabelId}-hint`;
  const keepaliveInputId = useId();
  const keepaliveHintId = `${keepaliveInputId}-hint`;
  const keepaliveErrorId = `${keepaliveInputId}-error`;
  const nonstreamKeepaliveInputId = useId();
  const nonstreamKeepaliveHintId = `${nonstreamKeepaliveInputId}-hint`;
  const nonstreamKeepaliveErrorId = `${nonstreamKeepaliveInputId}-error`;

  const isKeepaliveDisabled =
    values.streaming.keepaliveSeconds === '' || values.streaming.keepaliveSeconds === '0';
  const isNonstreamKeepaliveDisabled =
    values.streaming.nonstreamKeepaliveInterval === '' ||
    values.streaming.nonstreamKeepaliveInterval === '0';

  const portError = getValidationMessage(t, validationErrors?.port);
  const logsMaxSizeError = getValidationMessage(t, validationErrors?.logsMaxTotalSizeMb);
  const requestRetryError = getValidationMessage(t, validationErrors?.requestRetry);
  const maxRetryCredentialsError = getValidationMessage(t, validationErrors?.maxRetryCredentials);
  const maxRetryIntervalError = getValidationMessage(t, validationErrors?.maxRetryInterval);
  const keepaliveError = getValidationMessage(t, validationErrors?.['streaming.keepaliveSeconds']);
  const bootstrapRetriesError = getValidationMessage(
    t,
    validationErrors?.['streaming.bootstrapRetries']
  );
  const nonstreamKeepaliveError = getValidationMessage(
    t,
    validationErrors?.['streaming.nonstreamKeepaliveInterval']
  );

  const handleApiKeysTextChange = useCallback(
    (apiKeysText: string) => onChange({ apiKeysText }),
    [onChange]
  );
  const handlePayloadDefaultRulesChange = useCallback(
    (payloadDefaultRules: PayloadRule[]) => onChange({ payloadDefaultRules }),
    [onChange]
  );
  const handlePayloadDefaultRawRulesChange = useCallback(
    (payloadDefaultRawRules: PayloadRule[]) => onChange({ payloadDefaultRawRules }),
    [onChange]
  );
  const handlePayloadOverrideRulesChange = useCallback(
    (payloadOverrideRules: PayloadRule[]) => onChange({ payloadOverrideRules }),
    [onChange]
  );
  const handlePayloadOverrideRawRulesChange = useCallback(
    (payloadOverrideRawRules: PayloadRule[]) => onChange({ payloadOverrideRawRules }),
    [onChange]
  );
  const handlePayloadFilterRulesChange = useCallback(
    (payloadFilterRules: PayloadFilterRule[]) => onChange({ payloadFilterRules }),
    [onChange]
  );

  const countErrors = useCallback(
    (fields: VisualConfigFieldPath[]) =>
      fields.reduce((total, field) => total + (validationErrors?.[field] ? 1 : 0), 0),
    [validationErrors]
  );

  const sections = useMemo<VisualSection[]>(
    () => [
      {
        id: 'server',
        indexLabel: '01',
        groupId: 'core',
        title: t('config_management.visual.sections.server.title'),
        description: t('config_management.visual.sections.server.description'),
        icon: IconSettings,
        errorCount: countErrors(['port']),
      },
      {
        id: 'tls',
        indexLabel: '02',
        groupId: 'core',
        title: t('config_management.visual.sections.tls.title'),
        description: t('config_management.visual.sections.tls.description'),
        icon: IconShield,
        errorCount: 0,
      },
      {
        id: 'remote',
        indexLabel: '03',
        groupId: 'core',
        title: t('config_management.visual.sections.remote.title'),
        description: t('config_management.visual.sections.remote.description'),
        icon: IconSatellite,
        errorCount: 0,
      },
      {
        id: 'auth',
        indexLabel: '04',
        groupId: 'access',
        title: t('config_management.visual.sections.auth.title'),
        description: t('config_management.visual.sections.auth.description'),
        icon: IconKey,
        errorCount: 0,
      },
      {
        id: 'system',
        indexLabel: '05',
        groupId: 'runtime',
        title: t('config_management.visual.sections.system.title'),
        description: t('config_management.visual.sections.system.description'),
        icon: IconDiamond,
        errorCount: countErrors(['logsMaxTotalSizeMb']),
      },
      {
        id: 'network',
        indexLabel: '06',
        groupId: 'access',
        title: t('config_management.visual.sections.network.title'),
        description: t('config_management.visual.sections.network.description'),
        icon: IconTrendingUp,
        errorCount: countErrors(['requestRetry', 'maxRetryCredentials', 'maxRetryInterval']),
      },
      {
        id: 'quota',
        indexLabel: '07',
        groupId: 'runtime',
        title: t('config_management.visual.sections.quota.title'),
        description: t('config_management.visual.sections.quota.description'),
        icon: IconTimer,
        errorCount: 0,
      },
      {
        id: 'streaming',
        indexLabel: '08',
        groupId: 'runtime',
        title: t('config_management.visual.sections.streaming.title'),
        description: t('config_management.visual.sections.streaming.description'),
        icon: IconSatellite,
        errorCount: countErrors([
          'streaming.keepaliveSeconds',
          'streaming.bootstrapRetries',
          'streaming.nonstreamKeepaliveInterval',
        ]),
      },
      {
        id: 'payload',
        indexLabel: '09',
        groupId: 'advanced',
        title: t('config_management.visual.sections.payload.title'),
        description: t('config_management.visual.sections.payload.description'),
        icon: IconCode,
        errorCount: hasPayloadValidationErrors ? 1 : 0,
      },
    ],
    [countErrors, hasPayloadValidationErrors, t]
  );

  const sectionsById = useMemo(
    () =>
      Object.fromEntries(sections.map((section) => [section.id, section])) as Record<
        VisualSectionId,
        VisualSection
      >,
    [sections]
  );
  const groupDefinitions = useMemo(() => getVisualSectionGroupDefinitions(t), [t]);
  const activeGroup =
    groupDefinitions.find((group) => group.id === activeGroupId) ?? groupDefinitions[0];

  const renderSection = useCallback(
    (sectionId: VisualSectionId) => {
      const section = sectionsById[sectionId];
      const Icon = section.icon;
      const baseProps = {
        key: section.id,
        id: section.id,
        indexLabel: section.indexLabel,
        icon: <Icon size={16} />,
        title: section.title,
        description: section.description,
      };

      switch (sectionId) {
        case 'server':
          return (
            <ConfigSection {...baseProps}>
              <SectionGrid>
                <Input
                  label={t('config_management.visual.sections.server.host')}
                  placeholder="0.0.0.0"
                  value={values.host}
                  onChange={(e) => onChange({ host: e.target.value })}
                  disabled={disabled}
                />
                <Input
                  label={t('config_management.visual.sections.server.port')}
                  type="number"
                  placeholder="8317"
                  value={values.port}
                  onChange={(e) => onChange({ port: e.target.value })}
                  disabled={disabled}
                  error={portError}
                />
              </SectionGrid>
            </ConfigSection>
          );
        case 'tls':
          return (
            <ConfigSection {...baseProps}>
              <SectionStack>
                <ToggleRow
                  title={t('config_management.visual.sections.tls.enable')}
                  description={t('config_management.visual.sections.tls.enable_desc')}
                  checked={values.tlsEnable}
                  disabled={disabled}
                  onChange={(tlsEnable) => onChange({ tlsEnable })}
                />

                {values.tlsEnable ? (
                  <>
                    <Divider />
                    <SectionGrid>
                      <Input
                        label={t('config_management.visual.sections.tls.cert')}
                        placeholder="/path/to/cert.pem"
                        value={values.tlsCert}
                        onChange={(e) => onChange({ tlsCert: e.target.value })}
                        disabled={disabled}
                      />
                      <Input
                        label={t('config_management.visual.sections.tls.key')}
                        placeholder="/path/to/key.pem"
                        value={values.tlsKey}
                        onChange={(e) => onChange({ tlsKey: e.target.value })}
                        disabled={disabled}
                      />
                    </SectionGrid>
                  </>
                ) : null}
              </SectionStack>
            </ConfigSection>
          );
        case 'remote':
          return (
            <ConfigSection {...baseProps}>
              <SectionStack>
                <ToggleRow
                  title={t('config_management.visual.sections.remote.allow_remote')}
                  description={t('config_management.visual.sections.remote.allow_remote_desc')}
                  checked={values.rmAllowRemote}
                  disabled={disabled}
                  onChange={(rmAllowRemote) => onChange({ rmAllowRemote })}
                />
                <ToggleRow
                  title={t('config_management.visual.sections.remote.disable_panel')}
                  description={t('config_management.visual.sections.remote.disable_panel_desc')}
                  checked={values.rmDisableControlPanel}
                  disabled={disabled}
                  onChange={(rmDisableControlPanel) => onChange({ rmDisableControlPanel })}
                />
                <SectionGrid>
                  <Input
                    label={t('config_management.visual.sections.remote.secret_key')}
                    type="password"
                    placeholder={t(
                      'config_management.visual.sections.remote.secret_key_placeholder'
                    )}
                    value={values.rmSecretKey}
                    onChange={(e) => onChange({ rmSecretKey: e.target.value })}
                    disabled={disabled}
                  />
                  <Input
                    label={t('config_management.visual.sections.remote.panel_repo')}
                    placeholder="https://github.com/router-for-me/Cli-Proxy-API-Management-Center"
                    value={values.rmPanelRepo}
                    onChange={(e) => onChange({ rmPanelRepo: e.target.value })}
                    disabled={disabled}
                  />
                </SectionGrid>
              </SectionStack>
            </ConfigSection>
          );
        case 'auth':
          return (
            <ConfigSection {...baseProps}>
              <SectionStack>
                <Input
                  label={t('config_management.visual.sections.auth.auth_dir')}
                  placeholder="~/.cli-proxy-api"
                  value={values.authDir}
                  onChange={(e) => onChange({ authDir: e.target.value })}
                  disabled={disabled}
                  hint={t('config_management.visual.sections.auth.auth_dir_hint')}
                />
                <div className={styles.subsection}>
                  <ApiKeysCardEditor
                    value={values.apiKeysText}
                    disabled={disabled}
                    onChange={handleApiKeysTextChange}
                  />
                </div>
              </SectionStack>
            </ConfigSection>
          );
        case 'system':
          return (
            <ConfigSection {...baseProps}>
              <SectionStack>
                <SectionGrid>
                  <ToggleRow
                    title={t('config_management.visual.sections.system.debug')}
                    description={t('config_management.visual.sections.system.debug_desc')}
                    checked={values.debug}
                    disabled={disabled}
                    onChange={(debug) => onChange({ debug })}
                  />
                  <ToggleRow
                    title={t('config_management.visual.sections.system.commercial_mode')}
                    description={t('config_management.visual.sections.system.commercial_mode_desc')}
                    checked={values.commercialMode}
                    disabled={disabled}
                    onChange={(commercialMode) => onChange({ commercialMode })}
                  />
                  <ToggleRow
                    title={t('config_management.visual.sections.system.logging_to_file')}
                    description={t('config_management.visual.sections.system.logging_to_file_desc')}
                    checked={values.loggingToFile}
                    disabled={disabled}
                    onChange={(loggingToFile) => onChange({ loggingToFile })}
                  />
                  <ToggleRow
                    title={t('config_management.visual.sections.system.usage_statistics')}
                    description={t(
                      'config_management.visual.sections.system.usage_statistics_desc'
                    )}
                    checked={values.usageStatisticsEnabled}
                    disabled={disabled}
                    onChange={(usageStatisticsEnabled) => onChange({ usageStatisticsEnabled })}
                  />
                </SectionGrid>

                <SectionGrid>
                  <Input
                    label={t('config_management.visual.sections.system.logs_max_size')}
                    type="number"
                    placeholder="0"
                    value={values.logsMaxTotalSizeMb}
                    onChange={(e) => onChange({ logsMaxTotalSizeMb: e.target.value })}
                    disabled={disabled}
                    error={logsMaxSizeError}
                  />
                </SectionGrid>
              </SectionStack>
            </ConfigSection>
          );
        case 'network':
          return (
            <ConfigSection {...baseProps}>
              <SectionStack>
                <SectionGrid>
                  <Input
                    label={t('config_management.visual.sections.network.proxy_url')}
                    placeholder="socks5://user:pass@127.0.0.1:1080/"
                    value={values.proxyUrl}
                    onChange={(e) => onChange({ proxyUrl: e.target.value })}
                    disabled={disabled}
                  />
                  <Input
                    label={t('config_management.visual.sections.network.request_retry')}
                    type="number"
                    placeholder="3"
                    value={values.requestRetry}
                    onChange={(e) => onChange({ requestRetry: e.target.value })}
                    disabled={disabled}
                    error={requestRetryError}
                  />
                  <Input
                    label={t('config_management.visual.sections.network.max_retry_credentials')}
                    type="number"
                    placeholder="0"
                    value={values.maxRetryCredentials}
                    onChange={(e) => onChange({ maxRetryCredentials: e.target.value })}
                    disabled={disabled}
                    hint={t('config_management.visual.sections.network.max_retry_credentials_hint')}
                    error={maxRetryCredentialsError}
                  />
                  <Input
                    label={t('config_management.visual.sections.network.max_retry_interval')}
                    type="number"
                    placeholder="30"
                    value={values.maxRetryInterval}
                    onChange={(e) => onChange({ maxRetryInterval: e.target.value })}
                    disabled={disabled}
                    error={maxRetryIntervalError}
                  />
                  <FieldShell
                    label={t('config_management.visual.sections.network.routing_strategy')}
                    labelId={routingStrategyLabelId}
                    hint={t('config_management.visual.sections.network.routing_strategy_hint')}
                    hintId={routingStrategyHintId}
                  >
                    <Select
                      value={values.routingStrategy}
                      options={[
                        {
                          value: 'round-robin',
                          label: t(
                            'config_management.visual.sections.network.strategy_round_robin'
                          ),
                        },
                        {
                          value: 'fill-first',
                          label: t('config_management.visual.sections.network.strategy_fill_first'),
                        },
                      ]}
                      id={`${routingStrategyLabelId}-select`}
                      disabled={disabled}
                      ariaLabelledBy={routingStrategyLabelId}
                      ariaDescribedBy={routingStrategyHintId}
                      onChange={(nextValue) =>
                        onChange({
                          routingStrategy: nextValue as VisualConfigValues['routingStrategy'],
                        })
                      }
                    />
                  </FieldShell>
                </SectionGrid>

                <SectionGrid>
                  <ToggleRow
                    title={t('config_management.visual.sections.network.force_model_prefix')}
                    description={t(
                      'config_management.visual.sections.network.force_model_prefix_desc'
                    )}
                    checked={values.forceModelPrefix}
                    disabled={disabled}
                    onChange={(forceModelPrefix) => onChange({ forceModelPrefix })}
                  />
                  <ToggleRow
                    title={t('config_management.visual.sections.network.ws_auth')}
                    description={t('config_management.visual.sections.network.ws_auth_desc')}
                    checked={values.wsAuth}
                    disabled={disabled}
                    onChange={(wsAuth) => onChange({ wsAuth })}
                  />
                </SectionGrid>
              </SectionStack>
            </ConfigSection>
          );
        case 'quota':
          return (
            <ConfigSection {...baseProps}>
              <SectionGrid>
                <ToggleRow
                  title={t('config_management.visual.sections.quota.switch_project')}
                  description={t('config_management.visual.sections.quota.switch_project_desc')}
                  checked={values.quotaSwitchProject}
                  disabled={disabled}
                  onChange={(quotaSwitchProject) => onChange({ quotaSwitchProject })}
                />
                <ToggleRow
                  title={t('config_management.visual.sections.quota.switch_preview_model')}
                  description={t(
                    'config_management.visual.sections.quota.switch_preview_model_desc'
                  )}
                  checked={values.quotaSwitchPreviewModel}
                  disabled={disabled}
                  onChange={(quotaSwitchPreviewModel) => onChange({ quotaSwitchPreviewModel })}
                />
                <ToggleRow
                  title={t('config_management.visual.sections.quota.antigravity_credits')}
                  description={t(
                    'config_management.visual.sections.quota.antigravity_credits_desc'
                  )}
                  checked={values.quotaAntigravityCredits}
                  disabled={disabled}
                  onChange={(quotaAntigravityCredits) => onChange({ quotaAntigravityCredits })}
                />
              </SectionGrid>
            </ConfigSection>
          );
        case 'streaming':
          return (
            <ConfigSection {...baseProps}>
              <SectionStack>
                <SectionGrid>
                  <FieldShell
                    label={t('config_management.visual.sections.streaming.keepalive_seconds')}
                    htmlFor={keepaliveInputId}
                    hint={t('config_management.visual.sections.streaming.keepalive_hint')}
                    hintId={keepaliveHintId}
                    error={keepaliveError}
                    errorId={keepaliveErrorId}
                  >
                    <div className={styles.fieldControl}>
                      <input
                        id={keepaliveInputId}
                        className="input"
                        type="number"
                        placeholder="0"
                        value={values.streaming.keepaliveSeconds}
                        onChange={(e) =>
                          onChange({
                            streaming: {
                              ...values.streaming,
                              keepaliveSeconds: e.target.value,
                            },
                          })
                        }
                        disabled={disabled}
                      />
                      {isKeepaliveDisabled ? (
                        <span className={styles.inlinePill}>
                          {t('config_management.visual.sections.streaming.disabled')}
                        </span>
                      ) : null}
                    </div>
                  </FieldShell>

                  <Input
                    label={t('config_management.visual.sections.streaming.bootstrap_retries')}
                    type="number"
                    placeholder="1"
                    value={values.streaming.bootstrapRetries}
                    onChange={(e) =>
                      onChange({
                        streaming: {
                          ...values.streaming,
                          bootstrapRetries: e.target.value,
                        },
                      })
                    }
                    disabled={disabled}
                    hint={t('config_management.visual.sections.streaming.bootstrap_hint')}
                    error={bootstrapRetriesError}
                  />
                </SectionGrid>

                <SectionGrid>
                  <FieldShell
                    label={t('config_management.visual.sections.streaming.nonstream_keepalive')}
                    htmlFor={nonstreamKeepaliveInputId}
                    hint={t('config_management.visual.sections.streaming.nonstream_keepalive_hint')}
                    hintId={nonstreamKeepaliveHintId}
                    error={nonstreamKeepaliveError}
                    errorId={nonstreamKeepaliveErrorId}
                  >
                    <div className={styles.fieldControl}>
                      <input
                        id={nonstreamKeepaliveInputId}
                        className="input"
                        type="number"
                        placeholder="0"
                        value={values.streaming.nonstreamKeepaliveInterval}
                        onChange={(e) =>
                          onChange({
                            streaming: {
                              ...values.streaming,
                              nonstreamKeepaliveInterval: e.target.value,
                            },
                          })
                        }
                        disabled={disabled}
                      />
                      {isNonstreamKeepaliveDisabled ? (
                        <span className={styles.inlinePill}>
                          {t('config_management.visual.sections.streaming.disabled')}
                        </span>
                      ) : null}
                    </div>
                  </FieldShell>
                </SectionGrid>
              </SectionStack>
            </ConfigSection>
          );
        case 'payload':
          return (
            <ConfigSection {...baseProps}>
              <SectionStack>
                <SectionSubsection
                  title={t('config_management.visual.sections.payload.default_rules')}
                  description={t('config_management.visual.sections.payload.default_rules_desc')}
                >
                  <PayloadRulesEditor
                    value={values.payloadDefaultRules}
                    disabled={disabled}
                    onChange={handlePayloadDefaultRulesChange}
                  />
                </SectionSubsection>

                <SectionSubsection
                  title={t('config_management.visual.sections.payload.default_raw_rules')}
                  description={t(
                    'config_management.visual.sections.payload.default_raw_rules_desc'
                  )}
                >
                  <PayloadRulesEditor
                    value={values.payloadDefaultRawRules}
                    disabled={disabled}
                    rawJsonValues
                    onChange={handlePayloadDefaultRawRulesChange}
                  />
                </SectionSubsection>

                <SectionSubsection
                  title={t('config_management.visual.sections.payload.override_rules')}
                  description={t('config_management.visual.sections.payload.override_rules_desc')}
                >
                  <PayloadRulesEditor
                    value={values.payloadOverrideRules}
                    disabled={disabled}
                    protocolFirst
                    onChange={handlePayloadOverrideRulesChange}
                  />
                </SectionSubsection>

                <SectionSubsection
                  title={t('config_management.visual.sections.payload.override_raw_rules')}
                  description={t(
                    'config_management.visual.sections.payload.override_raw_rules_desc'
                  )}
                >
                  <PayloadRulesEditor
                    value={values.payloadOverrideRawRules}
                    disabled={disabled}
                    protocolFirst
                    rawJsonValues
                    onChange={handlePayloadOverrideRawRulesChange}
                  />
                </SectionSubsection>

                <SectionSubsection
                  title={t('config_management.visual.sections.payload.filter_rules')}
                  description={t('config_management.visual.sections.payload.filter_rules_desc')}
                >
                  <PayloadFilterRulesEditor
                    value={values.payloadFilterRules}
                    disabled={disabled}
                    onChange={handlePayloadFilterRulesChange}
                  />
                </SectionSubsection>
              </SectionStack>
            </ConfigSection>
          );
        default:
          return null;
      }
    },
    [
      disabled,
      handleApiKeysTextChange,
      handlePayloadDefaultRawRulesChange,
      handlePayloadDefaultRulesChange,
      handlePayloadFilterRulesChange,
      handlePayloadOverrideRawRulesChange,
      handlePayloadOverrideRulesChange,
      keepaliveError,
      keepaliveErrorId,
      keepaliveHintId,
      keepaliveInputId,
      logsMaxSizeError,
      maxRetryCredentialsError,
      maxRetryIntervalError,
      nonstreamKeepaliveError,
      nonstreamKeepaliveErrorId,
      nonstreamKeepaliveHintId,
      nonstreamKeepaliveInputId,
      onChange,
      portError,
      requestRetryError,
      routingStrategyHintId,
      routingStrategyLabelId,
      sectionsById,
      t,
      values,
      isKeepaliveDisabled,
      isNonstreamKeepaliveDisabled,
      bootstrapRetriesError,
    ]
  );

  return (
    <div className={styles.visualEditor}>
      {activeGroup.sectionIds.map((sectionId) => renderSection(sectionId))}
    </div>
  );
}
