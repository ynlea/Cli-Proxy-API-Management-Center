import bundledPresetPricing from '../../public/data/pricepertoken/latest.json';
import type { ModelPrice } from './usage';

export interface ModelPricePresetItem {
  providerId: string;
  providerName: string;
  model: string;
  modelName: string;
  slug: string;
  inputPricePer1M: number | null;
  outputPricePer1M: number | null;
  cacheReadPricePer1M: number | null;
  hasCurrentPricing: boolean;
  updatedAt: string;
}

export interface ModelPriceSourceInfo {
  source: 'preset' | 'custom';
  matchedBy?: 'exact' | 'suffix';
  presetModel?: string;
  presetProvider?: string;
  overriddenPreset?: boolean;
}

interface ModelPricePresetMatch {
  price: ModelPrice;
  source: ModelPriceSourceInfo;
}

interface ModelPriceCandidateKey {
  value: string;
  weight: number;
}

const PRESET_PRICING_URL = `${import.meta.env.BASE_URL}data/pricepertoken/latest.json`;
const VERSION_LIKE_SUFFIX_REGEX =
  /^[-._](latest|preview(?:[-._][a-z0-9]+)*|exp(?:[-._][a-z0-9]+)*|v\d+(?:[-._][a-z0-9]+)*|20\d{2}(?:[-._]?\d{2}){1,3}|\d{6,8}|\d{2}(?:[-._]?\d{2}){1,2})$/i;
const TRIMMABLE_SUFFIX_PATTERNS = [
  /-latest$/i,
  /-(?:preview|exp)(?:-\d+(?:-\d+)*)?$/i,
  /-(?:20\d{2}-\d{2}-\d{2}|20\d{6}|\d{8}|\d{2}-\d{2}(?:-\d{2})?)$/i,
];
const KNOWN_PROVIDER_PREFIXES = [
  'openai',
  'anthropic',
  'google',
  'vertex-ai',
  'vertex',
  'azure-openai',
  'azure',
  'mistral-ai',
  'mistral',
  'xai',
  'groq',
  'deepseek',
  'openrouter',
  'moonshot',
  'alibaba',
  'qwen',
  'meta',
  'cohere',
  'fireworks-ai',
  'fireworks',
  'perplexity',
  'minimax',
  'zhipu-ai',
  'together-ai',
  'together',
  'bedrock',
  'amazon-bedrock',
  'amazon',
];

let presetPricingPromise: Promise<ModelPricePresetItem[]> | null = null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const toNonNegativeNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const normalizeModelToken = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/^models?\//, '')
    .replace(/@.*$/, '')
    .replace(/[\s_/.:]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const addTrimmedVariants = (variants: Set<string>, value: string) => {
  let current = normalizeModelToken(value);
  if (!current) {
    return;
  }

  variants.add(current);

  let matched = true;
  while (matched) {
    matched = false;
    for (const pattern of TRIMMABLE_SUFFIX_PATTERNS) {
      if (pattern.test(current)) {
        current = current.replace(pattern, '');
        if (current) {
          variants.add(current);
        }
        matched = true;
      }
    }
  }
};

const buildModelVariants = (rawModelName: string): string[] => {
  const variants = new Set<string>();
  const trimmed = rawModelName.trim();
  if (!trimmed) {
    return [];
  }

  addTrimmedVariants(variants, trimmed);

  const withoutAt = trimmed.replace(/@.*$/, '');
  addTrimmedVariants(variants, withoutAt);

  const segments = withoutAt.split(/[/:]/).filter(Boolean);
  if (segments.length) {
    addTrimmedVariants(variants, segments[segments.length - 1]);
  }

  const normalized = normalizeModelToken(withoutAt);
  KNOWN_PROVIDER_PREFIXES.forEach((prefix) => {
    const providerPrefix = `${prefix}-`;
    if (normalized.startsWith(providerPrefix)) {
      addTrimmedVariants(variants, normalized.slice(providerPrefix.length));
    }
  });

  return Array.from(variants);
};

const buildCandidateKeys = (item: ModelPricePresetItem): ModelPriceCandidateKey[] => {
  const keys = new Map<string, number>();
  const appendKeys = (value: string, weight: number) => {
    buildModelVariants(value).forEach((variant) => {
      const currentWeight = keys.get(variant) ?? 0;
      if (weight > currentWeight) {
        keys.set(variant, weight);
      }
    });
  };

  appendKeys(item.model, 120);
  appendKeys(item.providerId, 105);
  appendKeys(item.slug, 100);
  appendKeys(item.modelName, 70);

  return Array.from(keys.entries()).map(([value, weight]) => ({ value, weight }));
};

const toPresetPrice = (item: ModelPricePresetItem): ModelPrice | null => {
  const prompt = item.inputPricePer1M;
  const completion = item.outputPricePer1M;
  const cache = item.cacheReadPricePer1M;

  if (prompt === null && completion === null && cache === null) {
    return null;
  }

  return {
    prompt: prompt ?? 0,
    completion: completion ?? 0,
    cache: cache ?? prompt ?? 0,
  };
};

const normalizePresetItem = (value: unknown): ModelPricePresetItem | null => {
  const record = isRecord(value) ? value : null;
  if (!record) {
    return null;
  }

  const model = typeof record.model === 'string' ? record.model.trim() : '';
  const providerId = typeof record.provider_id === 'string' ? record.provider_id.trim() : '';
  const slug = typeof record.slug === 'string' ? record.slug.trim() : '';
  if (!model && !providerId && !slug) {
    return null;
  }

  return {
    providerId,
    providerName: typeof record.provider_name === 'string' ? record.provider_name.trim() : '',
    model,
    modelName: typeof record.model_name === 'string' ? record.model_name.trim() : '',
    slug,
    inputPricePer1M: toNonNegativeNumber(record.input_price_per_1m_tokens),
    outputPricePer1M: toNonNegativeNumber(record.output_price_per_1m_tokens),
    cacheReadPricePer1M: toNonNegativeNumber(record.pricing_input_cache_read),
    hasCurrentPricing: record.has_current_pricing !== false,
    updatedAt: typeof record.updated_at === 'string' ? record.updated_at : '',
  };
};

const parsePresetPayload = (payload: unknown): ModelPricePresetItem[] => {
  const record = isRecord(payload) ? payload : null;
  if (!record) {
    return [];
  }

  const itemsRaw = Array.isArray(record.items)
    ? record.items
    : Array.isArray(record.pricing)
      ? record.pricing
      : [];

  return itemsRaw
    .map((item) => normalizePresetItem(item))
    .filter((item): item is ModelPricePresetItem => Boolean(item && item.hasCurrentPricing));
};

const BUNDLED_PRESET_ITEMS = parsePresetPayload(bundledPresetPricing);

const matchPresetModelPrice = (
  modelName: string,
  presetItems: ModelPricePresetItem[]
): ModelPricePresetMatch | null => {
  const modelVariants = buildModelVariants(modelName);
  if (!modelVariants.length || !presetItems.length) {
    return null;
  }

  let bestMatch:
    | (ModelPricePresetMatch & {
        score: number;
      })
    | null = null;

  for (const item of presetItems) {
    const price = toPresetPrice(item);
    if (!price) {
      continue;
    }

    const candidateKeys = buildCandidateKeys(item);
    for (const { value, weight } of candidateKeys) {
      for (const modelVariant of modelVariants) {
        if (modelVariant === value) {
          const score = 10_000 + weight + value.length;
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = {
              price,
              source: {
                source: 'preset',
                matchedBy: 'exact',
                presetModel: item.model || item.providerId || item.slug,
                presetProvider: item.providerName || undefined,
              },
              score,
            };
          }
          continue;
        }

        if (!modelVariant.startsWith(value)) {
          continue;
        }

        const suffix = modelVariant.slice(value.length);
        if (!suffix || !VERSION_LIKE_SUFFIX_REGEX.test(suffix)) {
          continue;
        }

        const score = 5_000 + weight + value.length;
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = {
            price,
            source: {
              source: 'preset',
              matchedBy: 'suffix',
              presetModel: item.model || item.providerId || item.slug,
              presetProvider: item.providerName || undefined,
            },
            score,
          };
        }
      }
    }
  }

  if (!bestMatch) {
    return null;
  }

  return {
    price: bestMatch.price,
    source: bestMatch.source,
  };
};

export async function loadPresetModelPricing(): Promise<ModelPricePresetItem[]> {
  if (presetPricingPromise) {
    return presetPricingPromise;
  }

  if (typeof window === 'undefined' || window.location.protocol === 'file:') {
    presetPricingPromise = Promise.resolve(BUNDLED_PRESET_ITEMS);
    return presetPricingPromise;
  }

  presetPricingPromise = fetch(PRESET_PRICING_URL, { cache: 'force-cache' })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load preset pricing: ${response.status}`);
      }
      const payload: unknown = await response.json();
      return parsePresetPayload(payload);
    })
    .catch(() => {
      return BUNDLED_PRESET_ITEMS;
    });

  return presetPricingPromise;
}

export function buildPresetModelPrices(
  modelNames: string[],
  presetItems: ModelPricePresetItem[]
): {
  prices: Record<string, ModelPrice>;
  sources: Record<string, ModelPriceSourceInfo>;
} {
  const prices: Record<string, ModelPrice> = {};
  const sources: Record<string, ModelPriceSourceInfo> = {};

  modelNames.forEach((modelName) => {
    const match = matchPresetModelPrice(modelName, presetItems);
    if (!match) {
      return;
    }

    prices[modelName] = match.price;
    sources[modelName] = match.source;
  });

  return { prices, sources };
}

export function mergeModelPrices(
  presetPrices: Record<string, ModelPrice>,
  manualPrices: Record<string, ModelPrice>,
  presetSources: Record<string, ModelPriceSourceInfo>
): {
  prices: Record<string, ModelPrice>;
  sources: Record<string, ModelPriceSourceInfo>;
} {
  const prices: Record<string, ModelPrice> = { ...presetPrices, ...manualPrices };
  const sources: Record<string, ModelPriceSourceInfo> = {};

  Object.keys(prices).forEach((modelName) => {
    const manualPrice = manualPrices[modelName];
    const presetSource = presetSources[modelName];

    if (manualPrice) {
      sources[modelName] = presetSource
        ? {
            source: 'custom',
            overriddenPreset: true,
            matchedBy: presetSource.matchedBy,
            presetModel: presetSource.presetModel,
            presetProvider: presetSource.presetProvider,
          }
        : {
            source: 'custom',
          };
      return;
    }

    if (presetSource) {
      sources[modelName] = presetSource;
    }
  });

  return { prices, sources };
}
