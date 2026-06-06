import { useEffect, useState } from "react";
import ReactEChartsCore from "echarts-for-react";
import * as echarts from "echarts/core";
import { LineChart, BarChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import {
  queryRecords,
  getMetrics,
  getDepartments,
} from "../lib/db";
import type { MetricDefinition, Department } from "../lib/types";
import { TrendingUp, BarChart3 } from "lucide-react";
import DatePicker from "./DatePicker";

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

echarts.use([
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  CanvasRenderer,
]);

type ChartType = "line" | "bar";

export default function TrendChart() {
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<number[]>([]);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<Date>(() => daysAgo(7));
  const [dateTo, setDateTo] = useState<Date>(() => new Date());
  const [chartType, setChartType] = useState<ChartType>("line");
  const [chartOption, setChartOption] = useState<echarts.EChartsCoreOption | null>(null);

  useEffect(() => {
    (async () => {
      const m = await getMetrics();
      const d = await getDepartments();
      setMetrics(m);
      setDepartments(d);
    })();
  }, []);

  async function handleQuery() {
    if (selectedMetrics.length === 0 || selectedDepts.length === 0) return;
    const rows = await queryRecords({
      dateFrom: dateFrom?.toISOString().slice(0, 10),
      dateTo: dateTo?.toISOString().slice(0, 10),
      departments: selectedDepts,
      metricIds: selectedMetrics,
    });

    // Get all unique dates sorted
    const dateSet = new Set(rows.map((r) => r.date));
    const dates = Array.from(dateSet).sort();

    const metricMap = new Map(metrics.map((m) => [m.id, m]));

    // Series: one per (metric, department) combo that has data
    const seriesMap = new Map<string, (number | null)[]>();
    for (const r of rows) {
      const m = metricMap.get(r.metric_id);
      if (!m) continue;
      const key = `${m.name} - ${r.department}`;
      if (!seriesMap.has(key)) {
        seriesMap.set(key, Array(dates.length).fill(null));
      }
      const idx = dates.indexOf(r.date);
      if (idx >= 0) {
        seriesMap.get(key)![idx] = r.value;
      }
    }

    const option: echarts.EChartsCoreOption = {
      tooltip: {
        trigger: "axis",
        formatter: (params: unknown) => {
          const p = params as { seriesName: string; value: number }[];
          let html = `<div class="font-medium mb-1">${p[0].value}</div>`;
          for (const item of p) {
            html += `<div class="text-xs text-slate-500">${item.seriesName}: ${item.value}</div>`;
          }
          return html;
        },
      },
      legend: {
        type: "scroll",
        bottom: 0,
        textStyle: { fontSize: 12 },
      },
      grid: { top: 20, right: 20, bottom: 40, left: 50 },
      xAxis: {
        type: "category",
        data: dates,
        axisLabel: { fontSize: 11 },
      },
      yAxis: {
        type: "value",
        axisLabel: { fontSize: 11 },
      },
      series: Array.from(seriesMap.entries()).map(([name, data]) => ({
        name,
        type: chartType,
        data,
        smooth: chartType === "line",
        symbol: "circle",
        symbolSize: 4,
      })),
    };

    setChartOption(option);
  }

  function toggleMetric(id: number) {
    setSelectedMetrics((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleDept(dept: string) {
    setSelectedDepts((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept],
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">趋势图</h2>
          <p className="text-sm text-slate-500 mt-1">选择指标和科室生成趋势图</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setChartType("line")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              chartType === "line"
                ? "bg-blue-100 text-blue-700"
                : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <TrendingUp className="w-4 h-4" /> 折线图
          </button>
          <button
            onClick={() => setChartType("bar")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              chartType === "bar"
                ? "bg-blue-100 text-blue-700"
                : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <BarChart3 className="w-4 h-4" /> 柱状图
          </button>
        </div>
      </div>

      {/* Selectors */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-600 mb-2">
            指标（可多选）
          </label>
          <div className="flex flex-wrap gap-2">
            {metrics.map((m) => (
              <button
                key={m.id}
                onClick={() => toggleMetric(m.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedMetrics.includes(m.id)
                    ? "bg-blue-100 text-blue-700 border border-blue-200"
                    : "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200"
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-600 mb-2">
            科室（可多选）
          </label>
          <div className="flex flex-wrap gap-2">
            {departments.map((d) => (
              <button
                key={d.id}
                onClick={() => toggleDept(d.name)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  selectedDepts.includes(d.name)
                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm"
                    : "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200"
                }`}
              >
                {d.name}
              </button>
            ))}
            {departments.length === 0 && (
              <span className="text-xs text-slate-400">暂无科室数据</span>
            )}
          </div>
        </div>
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              起始日期
            </label>
            <DatePicker value={dateFrom} onChange={setDateFrom} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              结束日期
            </label>
            <DatePicker
              value={dateTo}
              onChange={setDateTo}
              placeholder="不限"
            />
          </div>
          <button
            onClick={handleQuery}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            生成图表
          </button>
        </div>
      </div>

      {/* Chart */}
      {chartOption ? (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <ReactEChartsCore
            echarts={echarts}
            option={chartOption}
            style={{ height: 420 }}
            notMerge
          />
        </div>
      ) : (
        <div className="text-center text-slate-400 py-20 bg-white border border-slate-200 rounded-xl">
          请选择指标和科室后点击"生成图表"
        </div>
      )}
    </div>
  );
}
