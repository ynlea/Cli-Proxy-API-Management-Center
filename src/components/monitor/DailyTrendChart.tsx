import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Chart } from 'react-chartjs-2';
import type { UsageData } from '@/pages/MonitorPage';
import { formatLocalDateKey } from '@/utils/monitor';
import styles from '@/pages/MonitorPage.module.scss';

interface DailyTrendChartProps {
  data: UsageData | null;
  loading: boolean;
  isDark: boolean;
  timeRange: number;
}

interface DailyStat {
  date: string;
  requests: number;
  successRequests: number;
  failedRequests: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
}

export function DailyTrendChart({ data, loading, isDark, timeRange }: DailyTrendChartProps) {
  const { t } = useTranslation();

  // 按日期聚合数据
  const dailyData = useMemo((): DailyStat[] => {
    if (!data?.apis) return [];

    const dailyStats: Record<string, {
      requests: number;
      successRequests: number;
      failedRequests: number;
      inputTokens: number;
      outputTokens: number;
      reasoningTokens: number;
      cachedTokens: number;
    }> = {};

    Object.values(data.apis).forEach((apiData) => {
      Object.values(apiData.models).forEach((modelData) => {
        modelData.details.forEach((detail) => {
          // 使用本地日期而非 UTC 日期
          const date = formatLocalDateKey(new Date(detail.timestamp));
          if (!dailyStats[date]) {
            dailyStats[date] = {
              requests: 0,
              successRequests: 0,
              failedRequests: 0,
              inputTokens: 0,
              outputTokens: 0,
              reasoningTokens: 0,
              cachedTokens: 0,
            };
          }
          dailyStats[date].requests++;
          if (detail.failed) {
            dailyStats[date].failedRequests++;
          } else {
            dailyStats[date].successRequests++;
            // 只统计成功请求的 Token
            dailyStats[date].inputTokens += detail.tokens.input_tokens || 0;
            dailyStats[date].outputTokens += detail.tokens.output_tokens || 0;
            dailyStats[date].reasoningTokens += detail.tokens.reasoning_tokens || 0;
            dailyStats[date].cachedTokens += detail.tokens.cached_tokens || 0;
          }
        });
      });
    });

    // 转换为数组并按日期排序
    return Object.entries(dailyStats)
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  // 图表数据
  const chartData = useMemo(() => {
    const labels = dailyData.map((item) => {
      const [, month, day] = item.date.split('-');
      return `${Number(month)}/${Number(day)}`;
    });

    return {
      labels,
      datasets: [
        {
          type: 'line' as const,
          label: t('monitor.trend.requests'),
          data: dailyData.map((item) => item.requests),
          borderColor: '#39d5ff',
          backgroundColor: '#39d5ff',
          borderWidth: 3,
          fill: false,
          tension: 0.35,
          yAxisID: 'y1',
          order: 0,
          pointRadius: 3,
          pointBackgroundColor: '#39d5ff',
        },
        {
          type: 'bar' as const,
          label: t('monitor.trend.input_tokens'),
          data: dailyData.map((item) => item.inputTokens / 1000),
          backgroundColor: 'rgba(117, 255, 122, 0.66)',
          borderColor: 'rgba(117, 255, 122, 0.66)',
          borderWidth: 1,
          borderRadius: 0,
          yAxisID: 'y',
          order: 1,
          stack: 'tokens',
        },
        {
          type: 'bar' as const,
          label: t('monitor.trend.output_tokens'),
          data: dailyData.map((item) => item.outputTokens / 1000),
          backgroundColor: 'rgba(255, 93, 228, 0.62)',
          borderColor: 'rgba(255, 93, 228, 0.62)',
          borderWidth: 1,
          borderRadius: 4,
          yAxisID: 'y',
          order: 1,
          stack: 'tokens',
        },
      ],
    };
  }, [dailyData, t]);

  // 图表配置
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
        labels: {
          color: isDark ? '#b7f6ff' : '#4b5875',
          usePointStyle: true,
          padding: 16,
          font: {
            size: 11,
          },
          generateLabels: (chart: any) => {
            return chart.data.datasets.map((dataset: any, i: number) => {
              const isLine = dataset.type === 'line';
              return {
                text: dataset.label,
                fillStyle: dataset.backgroundColor,
                strokeStyle: dataset.borderColor,
                lineWidth: 0,
                hidden: !chart.isDatasetVisible(i),
                datasetIndex: i,
                pointStyle: isLine ? 'circle' : 'rect',
              };
            });
          },
        },
      },
      tooltip: {
        backgroundColor: isDark ? 'rgba(4, 8, 18, 0.96)' : 'rgba(248, 251, 255, 0.98)',
        titleColor: isDark ? '#75ff7a' : '#0c1834',
        bodyColor: isDark ? '#daf9ff' : '#2b3a58',
        borderColor: isDark ? 'rgba(57, 213, 255, 0.24)' : 'rgba(74, 123, 255, 0.18)',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || '';
            const value = context.raw;
            if (context.dataset.yAxisID === 'y1') {
              return `${label}: ${value.toLocaleString()}`;
            }
            return `${label}: ${value.toFixed(1)}K`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: isDark ? 'rgba(57, 213, 255, 0.12)' : 'rgba(12, 24, 52, 0.10)',
        },
        ticks: {
          color: isDark ? '#b7f6ff' : '#4b5875',
          font: {
            size: 11,
          },
        },
      },
      y: {
        type: 'linear' as const,
        position: 'left' as const,
        stacked: true,
        grid: {
          color: isDark ? 'rgba(57, 213, 255, 0.12)' : 'rgba(12, 24, 52, 0.10)',
        },
        ticks: {
          color: isDark ? '#b7f6ff' : '#4b5875',
          font: {
            size: 11,
          },
          callback: (value: string | number) => `${value}K`,
        },
        title: {
          display: true,
          text: 'Tokens (K)',
          color: isDark ? '#b7f6ff' : '#4b5875',
          font: {
            size: 11,
          },
        },
      },
      y1: {
        type: 'linear' as const,
        position: 'right' as const,
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          color: isDark ? '#b7f6ff' : '#4b5875',
          font: {
            size: 11,
          },
        },
        title: {
          display: true,
          text: t('monitor.trend.requests'),
          color: isDark ? '#b7f6ff' : '#4b5875',
          font: {
            size: 11,
          },
        },
      },
    },
  }), [isDark, t]);

  const timeRangeLabel = timeRange === 1
    ? t('monitor.today')
    : t('monitor.last_n_days', { n: timeRange });

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div>
          <h3 className={styles.chartTitle}>{t('monitor.trend.title')}</h3>
          <p className={styles.chartSubtitle}>
            {timeRangeLabel} · {t('monitor.trend.subtitle')}
          </p>
        </div>
      </div>

      <div className={styles.chartContent}>
        {loading || dailyData.length === 0 ? (
          <div className={styles.chartEmpty}>
            {loading ? t('common.loading') : t('monitor.no_data')}
          </div>
        ) : (
          <Chart type="bar" data={chartData} options={chartOptions} />
        )}
      </div>
    </div>
  );
}
