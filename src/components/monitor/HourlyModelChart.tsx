import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chart } from 'react-chartjs-2';
import type { UsageData } from '@/pages/MonitorPage';
import { formatLocalHourKey, getHourlyRangeBounds } from '@/utils/monitor';
import styles from '@/pages/MonitorPage.module.scss';

interface HourlyModelChartProps {
  data: UsageData | null;
  loading: boolean;
  isDark: boolean;
}

// 颜色调色板
const COLORS = [
  'rgba(57, 213, 255, 0.68)',
  'rgba(117, 255, 122, 0.68)',
  'rgba(255, 224, 102, 0.64)',
  'rgba(255, 93, 228, 0.62)',
  'rgba(255, 93, 135, 0.62)',
  'rgba(74, 123, 255, 0.64)',
];

type HourRange = 6 | 12 | 24;

export function HourlyModelChart({ data, loading, isDark }: HourlyModelChartProps) {
  const { t } = useTranslation();
  const [hourRange, setHourRange] = useState<HourRange>(12);

  // 按小时聚合数据
  const hourlyData = useMemo(() => {
    if (!data?.apis) return { hours: [], models: [], modelData: {} as Record<string, number[]>, successRates: [] };

    const { start: cutoffTime, end: currentHour, bucketCount } = getHourlyRangeBounds(hourRange);

    // 生成所有小时的时间点
    const allHours: string[] = [];
    for (let i = 0; i < bucketCount; i++) {
      const hourTime = new Date(cutoffTime.getTime() + i * 60 * 60 * 1000);
      allHours.push(formatLocalHourKey(hourTime));
    }

    // 收集每小时每个模型的请求数
    const hourlyStats: Record<string, Record<string, { success: number; failed: number }>> = {};
    const modelSet = new Set<string>();

    // 初始化所有小时
    allHours.forEach((hour) => {
      hourlyStats[hour] = {};
    });

    Object.values(data.apis).forEach((apiData) => {
      Object.entries(apiData.models).forEach(([modelName, modelData]) => {
        modelSet.add(modelName);
        modelData.details.forEach((detail) => {
          const timestamp = new Date(detail.timestamp);
          timestamp.setMinutes(0, 0, 0);
          if (timestamp < cutoffTime || timestamp > currentHour) return;

          const hourKey = formatLocalHourKey(timestamp);
          if (!hourlyStats[hourKey]) {
            hourlyStats[hourKey] = {};
          }
          if (!hourlyStats[hourKey][modelName]) {
            hourlyStats[hourKey][modelName] = { success: 0, failed: 0 };
          }
          if (detail.failed) {
            hourlyStats[hourKey][modelName].failed++;
          } else {
            hourlyStats[hourKey][modelName].success++;
          }
        });
      });
    });

    // 获取排序后的小时列表
    const hours = allHours.sort();

    // 计算每个模型的总请求数，取 Top 6
    const modelTotals: Record<string, number> = {};
    hours.forEach((hour) => {
      Object.entries(hourlyStats[hour]).forEach(([model, stats]) => {
        modelTotals[model] = (modelTotals[model] || 0) + stats.success + stats.failed;
      });
    });

    const topModels = Object.entries(modelTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name);

    // 构建每个模型的数据数组
    const modelData: Record<string, number[]> = {};
    topModels.forEach((model) => {
      modelData[model] = hours.map((hour) => {
        const stats = hourlyStats[hour][model];
        return stats ? stats.success + stats.failed : 0;
      });
    });

    // 计算每小时的成功率
    const successRates = hours.map((hour) => {
      let totalSuccess = 0;
      let totalRequests = 0;
      Object.values(hourlyStats[hour]).forEach((stats) => {
        totalSuccess += stats.success;
        totalRequests += stats.success + stats.failed;
      });
      return totalRequests > 0 ? (totalSuccess / totalRequests) * 100 : 0;
    });

    return { hours, models: topModels, modelData, successRates };
  }, [data, hourRange]);

  // 获取时间范围标签
  const hourRangeLabel = useMemo(() => {
    if (hourRange === 6) return t('monitor.hourly.last_6h');
    if (hourRange === 12) return t('monitor.hourly.last_12h');
    return t('monitor.hourly.last_24h');
  }, [hourRange, t]);

  // 图表数据
  const chartData = useMemo(() => {
    const labels = hourlyData.hours.map((hour) => {
      return `${Number(hour.slice(11, 13))}:00`;
    });

    // 成功率折线放在最前面
    const datasets: any[] = [{
      type: 'line' as const,
      label: t('monitor.hourly.success_rate'),
      data: hourlyData.successRates,
      borderColor: '#75ff7a',
      backgroundColor: '#75ff7a',
      borderWidth: 2.5,
      tension: 0.4,
      yAxisID: 'y1',
      stack: '',
      pointRadius: 3,
      pointBackgroundColor: '#75ff7a',
      pointBorderColor: '#75ff7a',
    }];

    // 添加模型柱状图
    hourlyData.models.forEach((model, index) => {
      datasets.push({
        type: 'bar' as const,
        label: model,
        data: hourlyData.modelData[model],
        backgroundColor: COLORS[index % COLORS.length],
        borderColor: COLORS[index % COLORS.length],
        borderWidth: 1,
        borderRadius: 4,
        stack: 'models',
        yAxisID: 'y',
      });
    });

    return { labels, datasets };
  }, [hourlyData, t]);

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
          padding: 12,
          font: {
            size: 11,
          },
          generateLabels: (chart: any) => {
            return chart.data.datasets
              .map((dataset: any, i: number) => {
                const isLine = dataset.type === 'line';
                // 柱状图数据全为0时不显示标签
                if (!isLine && Array.isArray(dataset.data) && dataset.data.every((v: number) => v === 0)) {
                  return null;
                }
                return {
                  text: dataset.label,
                  fillStyle: dataset.backgroundColor,
                  strokeStyle: dataset.borderColor,
                  lineWidth: 0,
                  hidden: !chart.isDatasetVisible(i),
                  datasetIndex: i,
                  pointStyle: isLine ? 'circle' : 'rect',
                };
              })
              .filter(Boolean);
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
        filter: (tooltipItem: any) => {
          // 值为0的模型不在tooltip中显示
          return tooltipItem.raw !== 0;
        },
      },
    },
    scales: {
      x: {
        stacked: true,
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
        stacked: true,
        position: 'left' as const,
        grid: {
          color: isDark ? 'rgba(57, 213, 255, 0.12)' : 'rgba(12, 24, 52, 0.10)',
        },
        ticks: {
          color: isDark ? '#b7f6ff' : '#4b5875',
          font: {
            size: 11,
          },
        },
        title: {
          display: true,
          text: t('monitor.hourly.requests'),
          color: isDark ? '#b7f6ff' : '#4b5875',
          font: {
            size: 11,
          },
        },
      },
      y1: {
        position: 'right' as const,
        min: 0,
        max: 100,
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          color: isDark ? '#b7f6ff' : '#4b5875',
          font: {
            size: 11,
          },
          callback: (value: string | number) => `${value}%`,
        },
        title: {
          display: true,
          text: t('monitor.hourly.success_rate'),
          color: isDark ? '#b7f6ff' : '#4b5875',
          font: {
            size: 11,
          },
        },
      },
    },
  }), [isDark, t]);

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div>
          <h3 className={styles.chartTitle}>{t('monitor.hourly_model.title')}</h3>
          <p className={styles.chartSubtitle}>
            {hourRangeLabel}
          </p>
        </div>
        <div className={styles.chartControls}>
          <button
            className={`${styles.chartControlBtn} ${hourRange === 6 ? styles.active : ''}`}
            onClick={() => setHourRange(6)}
          >
            {t('monitor.hourly.last_6h')}
          </button>
          <button
            className={`${styles.chartControlBtn} ${hourRange === 12 ? styles.active : ''}`}
            onClick={() => setHourRange(12)}
          >
            {t('monitor.hourly.last_12h')}
          </button>
          <button
            className={`${styles.chartControlBtn} ${hourRange === 24 ? styles.active : ''}`}
            onClick={() => setHourRange(24)}
          >
            {t('monitor.hourly.last_24h')}
          </button>
        </div>
      </div>

      <div className={styles.chartContent}>
        {loading || hourlyData.hours.length === 0 ? (
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
