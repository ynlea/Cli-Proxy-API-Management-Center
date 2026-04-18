import { useMemo, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { UsageData } from '@/types/monitor';
import styles from '@/pages/MonitorPage.module.scss';

interface KpiCardsProps {
  data: UsageData | null;
  loading: boolean;
  timeRange: number;
}

// 格式化数字
function formatNumber(num: number): string {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(2) + 'B';
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(2) + 'K';
  }
  return num.toLocaleString();
}

export function KpiCards({ data, loading, timeRange: _timeRange }: KpiCardsProps) {
  const { t } = useTranslation();

  // 计算统计数据
  const stats = useMemo(() => {
    if (!data?.apis) {
      return {
        totalRequests: 0,
        successRequests: 0,
        failedRequests: 0,
        successRate: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        cachedTokens: 0,
        avgTpm: 0,
        avgRpm: 0,
        avgRpd: 0,
      };
    }

    let totalRequests = 0;
    let successRequests = 0;
    let failedRequests = 0;
    let totalTokens = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let reasoningTokens = 0;
    let cachedTokens = 0;

    // 追踪时间戳范围用于计算 TPM/RPM
    let minTime = Infinity;
    let maxTime = -Infinity;

    Object.values(data.apis).forEach((apiData) => {
      Object.values(apiData.models).forEach((modelData) => {
        modelData.details.forEach((detail) => {
          totalRequests++;
          if (detail.failed) {
            failedRequests++;
          } else {
            successRequests++;
          }

          totalTokens += detail.tokens.total_tokens || 0;
          inputTokens += detail.tokens.input_tokens || 0;
          outputTokens += detail.tokens.output_tokens || 0;
          reasoningTokens += detail.tokens.reasoning_tokens || 0;
          cachedTokens += detail.tokens.cached_tokens || 0;

          const ts = new Date(detail.timestamp).getTime();
          if (ts < minTime) minTime = ts;
          if (ts > maxTime) maxTime = ts;
        });
      });
    });

    const successRate = totalRequests > 0 ? (successRequests / totalRequests) * 100 : 0;

    // 计算 TPM 和 RPM（基于实际时间跨度）
    let avgTpm = 0;
    let avgRpm = 0;
    let avgRpd = 0;

    if (minTime !== Infinity) {
      const timeSpanMinutes = Math.max((maxTime - minTime) / (1000 * 60), 1);
      const timeSpanDays = Math.max(timeSpanMinutes / (60 * 24), 1);

      avgTpm = Math.round(totalTokens / timeSpanMinutes);
      avgRpm = Math.round((totalRequests / timeSpanMinutes) * 10) / 10;
      avgRpd = Math.round(totalRequests / timeSpanDays);
    }

    return {
      totalRequests,
      successRequests,
      failedRequests,
      successRate,
      totalTokens,
      inputTokens,
      outputTokens,
      reasoningTokens,
      cachedTokens,
      avgTpm,
      avgRpm,
      avgRpd,
    };
  }, [data]);

  const kpiCards = [
    {
      key: 'requests',
      accent: '#7a90e8',
      accentSoft: 'rgba(122, 144, 232, 0.22)',
      accentBorder: 'rgba(122, 144, 232, 0.38)',
      label: t('monitor.kpi.requests'),
      value: loading ? '--' : formatNumber(stats.totalRequests),
      meta: (
        <>
          <span className={styles.kpiSuccess}>
            {t('monitor.kpi.success')}: {loading ? '--' : stats.successRequests.toLocaleString()}
          </span>
          <span className={styles.kpiFailure}>
            {t('monitor.kpi.failed')}: {loading ? '--' : stats.failedRequests.toLocaleString()}
          </span>
          <span>
            {t('monitor.kpi.rate')}: {loading ? '--' : stats.successRate.toFixed(1)}%
          </span>
        </>
      ),
    },
    {
      key: 'tokens',
      accent: '#d97db1',
      accentSoft: 'rgba(217, 125, 177, 0.2)',
      accentBorder: 'rgba(217, 125, 177, 0.34)',
      label: t('monitor.kpi.tokens'),
      value: loading ? '--' : formatNumber(stats.totalTokens),
      meta: (
        <>
          <span>
            {t('monitor.kpi.input')}: {loading ? '--' : formatNumber(stats.inputTokens)}
          </span>
          <span>
            {t('monitor.kpi.output')}: {loading ? '--' : formatNumber(stats.outputTokens)}
          </span>
          {(stats.reasoningTokens > 0 || stats.cachedTokens > 0) && (
            <span>
              {t('monitor.kpi.cached')}: {loading ? '--' : formatNumber(stats.cachedTokens)}
            </span>
          )}
        </>
      ),
    },
    {
      key: 'throughput',
      accent: '#77bfae',
      accentSoft: 'rgba(119, 191, 174, 0.2)',
      accentBorder: 'rgba(119, 191, 174, 0.34)',
      label: t('monitor.kpi.avg_tpm'),
      value: loading ? '--' : formatNumber(stats.avgTpm),
      meta: (
        <>
          <span>{t('monitor.kpi.tokens_per_minute')}</span>
          <span>
            {t('monitor.kpi.avg_rpm')}: {loading ? '--' : stats.avgRpm.toFixed(1)}
          </span>
          <span>
            {t('monitor.kpi.avg_rpd')}: {loading ? '--' : formatNumber(stats.avgRpd)}
          </span>
        </>
      ),
    },
  ];

  return (
    <div className={styles.kpiGrid}>
      {kpiCards.map((card) => (
        <div
          key={card.key}
          className={styles.kpiCard}
          style={
            {
              '--accent': card.accent,
              '--accent-soft': card.accentSoft,
              '--accent-border': card.accentBorder,
            } as CSSProperties
          }
        >
          <div className={styles.kpiTitle}>
            <span className={styles.kpiLabel}>{card.label}</span>
          </div>
          <div className={styles.kpiValue}>{card.value}</div>
          <div className={styles.kpiMeta}>{card.meta}</div>
        </div>
      ))}
    </div>
  );
}
