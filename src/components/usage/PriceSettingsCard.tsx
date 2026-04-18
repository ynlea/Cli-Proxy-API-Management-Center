import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import type { ModelPrice } from '@/utils/usage';
import type { ModelPriceSourceInfo } from '@/utils/modelPricing';
import styles from '@/pages/UsagePage.module.scss';

export interface PriceSettingsCardProps {
  modelNames: string[];
  modelPrices: Record<string, ModelPrice>;
  manualModelPrices: Record<string, ModelPrice>;
  modelPriceSources: Record<string, ModelPriceSourceInfo>;
  onPricesChange: (prices: Record<string, ModelPrice>) => void;
}

interface PriceDraft {
  prompt: string;
  completion: string;
  cache: string;
}

const EMPTY_DRAFT: PriceDraft = {
  prompt: '',
  completion: '',
  cache: '',
};

const toDraft = (price?: ModelPrice): PriceDraft =>
  price
    ? {
        prompt: price.prompt.toString(),
        completion: price.completion.toString(),
        cache: price.cache.toString(),
      }
    : EMPTY_DRAFT;

export function PriceSettingsCard({
  modelNames,
  modelPrices,
  manualModelPrices,
  modelPriceSources,
  onPricesChange,
}: PriceSettingsCardProps) {
  const { t } = useTranslation();

  // Add form state
  const [selectedModel, setSelectedModel] = useState('');
  const [draftByModel, setDraftByModel] = useState<Record<string, PriceDraft>>({});

  // Edit modal state
  const [editModel, setEditModel] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editCompletion, setEditCompletion] = useState('');
  const [editCache, setEditCache] = useState('');

  const getSourceLabel = (source: ModelPriceSourceInfo | undefined) => {
    if (!source) {
      return '';
    }
    if (source.source === 'custom') {
      return source.overriddenPreset
        ? t('usage_stats.model_price_source_custom_override')
        : t('usage_stats.model_price_source_custom');
    }
    return t('usage_stats.model_price_source_preset');
  };

  const clearDraft = (model: string) => {
    setDraftByModel((current) => {
      if (!current[model]) {
        return current;
      }
      const next = { ...current };
      delete next[model];
      return next;
    });
  };

  const updateDraft = (model: string, patch: Partial<PriceDraft>) => {
    if (!model) {
      return;
    }
    setDraftByModel((current) => ({
      ...current,
      [model]: {
        ...(current[model] ?? toDraft(modelPrices[model])),
        ...patch,
      },
    }));
  };

  const handleSavePrice = () => {
    if (!selectedModel) return;
    const draft = draftByModel[selectedModel] ?? toDraft(modelPrices[selectedModel]);
    const prompt = parseFloat(draft.prompt) || 0;
    const completion = parseFloat(draft.completion) || 0;
    const cache = draft.cache.trim() === '' ? prompt : parseFloat(draft.cache) || 0;
    const newPrices = { ...manualModelPrices, [selectedModel]: { prompt, completion, cache } };
    onPricesChange(newPrices);
    clearDraft(selectedModel);
    setSelectedModel('');
  };

  const handleDeletePrice = (model: string) => {
    const newPrices = { ...manualModelPrices };
    delete newPrices[model];
    onPricesChange(newPrices);
    clearDraft(model);
  };

  const handleOpenEdit = (model: string) => {
    const price = modelPrices[model];
    setEditModel(model);
    setEditPrompt(price?.prompt?.toString() || '');
    setEditCompletion(price?.completion?.toString() || '');
    setEditCache(price?.cache?.toString() || '');
  };

  const handleSaveEdit = () => {
    if (!editModel) return;
    const prompt = parseFloat(editPrompt) || 0;
    const completion = parseFloat(editCompletion) || 0;
    const cache = editCache.trim() === '' ? prompt : parseFloat(editCache) || 0;
    const newPrices = { ...manualModelPrices, [editModel]: { prompt, completion, cache } };
    onPricesChange(newPrices);
    setEditModel(null);
  };

  const handleModelSelect = (value: string) => {
    setSelectedModel(value);
  };

  const options = useMemo(
    () => [
      { value: '', label: t('usage_stats.model_price_select_placeholder') },
      ...modelNames.map((name) => ({ value: name, label: name })),
    ],
    [modelNames, t]
  );
  const selectedSource = selectedModel ? modelPriceSources[selectedModel] : undefined;
  const selectedDraft = selectedModel
    ? draftByModel[selectedModel] ?? toDraft(modelPrices[selectedModel])
    : EMPTY_DRAFT;
  const sortedPriceEntries = useMemo(
    () => Object.entries(modelPrices).sort(([left], [right]) => left.localeCompare(right)),
    [modelPrices]
  );

  return (
    <Card title={t('usage_stats.model_price_settings')}>
      <div className={styles.pricingSection}>
        <div className={styles.pricingHint}>{t('usage_stats.model_price_auto_hint')}</div>

        {/* Price Form */}
        <div className={styles.priceForm}>
          <div className={styles.formRow}>
            <div className={styles.formField}>
              <label>{t('usage_stats.model_name')}</label>
              <Select
                value={selectedModel}
                options={options}
                onChange={handleModelSelect}
                placeholder={t('usage_stats.model_price_select_placeholder')}
              />
            </div>
            <div className={styles.formField}>
              <label>{t('usage_stats.model_price_prompt')} ($/1M)</label>
              <Input
                type="number"
                value={selectedDraft.prompt}
                onChange={(e) => updateDraft(selectedModel, { prompt: e.target.value })}
                placeholder="0.00"
                step="0.0001"
              />
            </div>
            <div className={styles.formField}>
              <label>{t('usage_stats.model_price_completion')} ($/1M)</label>
              <Input
                type="number"
                value={selectedDraft.completion}
                onChange={(e) => updateDraft(selectedModel, { completion: e.target.value })}
                placeholder="0.00"
                step="0.0001"
              />
            </div>
            <div className={styles.formField}>
              <label>{t('usage_stats.model_price_cache')} ($/1M)</label>
              <Input
                type="number"
                value={selectedDraft.cache}
                onChange={(e) => updateDraft(selectedModel, { cache: e.target.value })}
                placeholder="0.00"
                step="0.0001"
              />
            </div>
            <Button variant="primary" onClick={handleSavePrice} disabled={!selectedModel}>
              {t('common.save')}
            </Button>
          </div>
          {selectedModel && selectedSource ? (
            <div className={styles.priceSourceRow}>
              <span className={styles.priceSourceBadge}>{getSourceLabel(selectedSource)}</span>
              {selectedSource.presetModel ? (
                <span className={styles.priceSourceMeta}>
                  {t('usage_stats.model_price_match_hint', {
                    provider: selectedSource.presetProvider || '-',
                    model: selectedSource.presetModel,
                  })}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Saved Prices List */}
        <div className={styles.pricesList}>
          <h4 className={styles.pricesTitle}>{t('usage_stats.effective_prices')}</h4>
          {sortedPriceEntries.length > 0 ? (
            <div className={styles.pricesGrid}>
              {sortedPriceEntries.map(([model, price]) => {
                const source = modelPriceSources[model];
                const hasManualOverride = Boolean(manualModelPrices[model]);
                const resetLabel = source?.overriddenPreset
                  ? t('usage_stats.model_price_restore_preset')
                  : t('common.delete');

                return (
                  <div key={model} className={styles.priceItem}>
                    <div className={styles.priceInfo}>
                      <div className={styles.priceHeader}>
                        <span className={styles.priceModel}>{model}</span>
                        {source ? (
                          <span className={styles.priceSourceBadge}>{getSourceLabel(source)}</span>
                        ) : null}
                      </div>
                      {source?.presetModel ? (
                        <span className={styles.priceSourceMeta}>
                          {t('usage_stats.model_price_match_hint', {
                            provider: source.presetProvider || '-',
                            model: source.presetModel,
                          })}
                        </span>
                      ) : null}
                      <div className={styles.priceMeta}>
                        <span>
                          {t('usage_stats.model_price_prompt')}: ${price.prompt.toFixed(4)}/1M
                        </span>
                        <span>
                          {t('usage_stats.model_price_completion')}:{' '}
                          ${price.completion.toFixed(4)}/1M
                        </span>
                        <span>
                          {t('usage_stats.model_price_cache')}: ${price.cache.toFixed(4)}/1M
                        </span>
                      </div>
                    </div>
                    <div className={styles.priceActions}>
                      <Button variant="secondary" size="sm" onClick={() => handleOpenEdit(model)}>
                        {t('common.edit')}
                      </Button>
                      {hasManualOverride ? (
                        <Button
                          variant={source?.overriddenPreset ? 'secondary' : 'danger'}
                          size="sm"
                          onClick={() => handleDeletePrice(model)}
                        >
                          {resetLabel}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.hint}>{t('usage_stats.model_price_empty')}</div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        open={editModel !== null}
        title={editModel ?? ''}
        onClose={() => setEditModel(null)}
        footer={
          <div className={styles.priceActions}>
            <Button variant="secondary" onClick={() => setEditModel(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleSaveEdit}>
              {t('common.save')}
            </Button>
          </div>
        }
        width={420}
      >
        <div className={styles.editModalBody}>
          <div className={styles.formField}>
            <label>{t('usage_stats.model_price_prompt')} ($/1M)</label>
            <Input
              type="number"
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              placeholder="0.00"
              step="0.0001"
            />
          </div>
          <div className={styles.formField}>
            <label>{t('usage_stats.model_price_completion')} ($/1M)</label>
            <Input
              type="number"
              value={editCompletion}
              onChange={(e) => setEditCompletion(e.target.value)}
              placeholder="0.00"
              step="0.0001"
            />
          </div>
          <div className={styles.formField}>
            <label>{t('usage_stats.model_price_cache')} ($/1M)</label>
            <Input
              type="number"
              value={editCache}
              onChange={(e) => setEditCache(e.target.value)}
              placeholder="0.00"
              step="0.0001"
            />
          </div>
        </div>
      </Modal>
    </Card>
  );
}
