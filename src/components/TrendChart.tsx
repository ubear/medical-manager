import { useEffect, useState, useCallback, useRef } from "react";
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
import { queryRecords, getMetrics, getDepartments } from "../lib/db";
import type { MetricDefinition, Department } from "../lib/types";
import { TrendingUp, BarChart3, AreaChart, Download, GitCompare } from "lucide-react";
import MonthPicker, { formatMonth } from "./MonthPicker";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

function monthsAgo(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}

function offsetMonth(dateStr: string, offset: number): string {
  const [y, m] = dateStr.split("-").map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function escapeHtml(s: string): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return s.replace(/[&<>"']/g, (c) => map[c]);
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

type ChartType = "line" | "bar" | "area";

const PALETTE = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6",
  "#ef4444", "#06b6d4", "#f97316", "#6366f1",
  "#ec4899", "#84cc16", "#14b8a6", "#a855f7",
];

export default function TrendChart() {
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<number[]>([]);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<Date>(() => monthsAgo(12));
  const [dateTo, setDateTo] = useState<Date>(() => new Date());
  const [chartType, setChartType] = useState<ChartType>("line");
  const [yoyMode, setYoyMode] = useState(false);
  const [chartOption, setChartOption] = useState<echarts.EChartsCoreOption | null>(null);
  const [hint, setHint] = useState("");
  const [summary, setSummary] = useState<
    { metric: string; unit: string; latest: number; avg: number; min: number; max: number }[]
  >([]);
  const chartRef = useRef<ReactEChartsCore>(null);

  async function handleSaveChart() {
    try {
      const instance = chartRef.current?.getEchartsInstance();
      if (!instance) return;
      const dataUrl = instance.getDataURL({
        type: "png",
        pixelRatio: 2,
        backgroundColor: "#fff",
      });
      const base64 = dataUrl.split(",")[1];
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const path = await save({
        defaultPath: `趋势图_${formatMonth(new Date())}.png`,
        filters: [{ name: "PNG", extensions: ["png"] }],
      });
      if (!path) return;
      await writeFile(path, bytes);
      alert(`图表已保存: ${path}`);
    } catch (e: any) {
      alert(`保存失败: ${e?.message ?? e}`);
    }
  }

  useEffect(() => {
    (async () => {
      const m = await getMetrics();
      const d = await getDepartments();
      setMetrics(m);
      setDepartments(d);
      if (m.length > 0 && d.length > 0) {
        const defaultMetricIds = m.slice(0, 3).map((x) => x.id);
        const defaultDeptNames = d.map((x) => x.name);
        setSelectedMetrics(defaultMetricIds);
        setSelectedDepts(defaultDeptNames);
        // will auto-query via second useEffect
      }
    })();
  }, []);

  const doQuery = useCallback(async () => {
    if (selectedMetrics.length === 0 || selectedDepts.length === 0) return;
    setHint("");

    const dateFromStr = formatMonth(dateFrom!);
    const dateToStr = formatMonth(dateTo!);

    const currentRows = await queryRecords({
      dateFrom: dateFromStr,
      dateTo: dateToStr,
      departments: selectedDepts,
      metricIds: selectedMetrics,
    });

    let yoyRows: typeof currentRows = [];
    if (yoyMode) {
      yoyRows = await queryRecords({
        dateFrom: offsetMonth(dateFromStr, -12),
        dateTo: offsetMonth(dateToStr, -12),
        departments: selectedDepts,
        metricIds: selectedMetrics,
      });
    }

    const dateSet = new Set(currentRows.map((r) => r.date));
    const dates = Array.from(dateSet).sort();
    const metricMap = new Map(metrics.map((m) => [m.id, m]));

    // Build series: current data, key = "metric - dept"
    const currentSeriesMap = new Map<string, (number | null)[]>();
    for (const r of currentRows) {
      const m = metricMap.get(r.metric_id);
      if (!m) continue;
      const key = `${m.name} - ${r.department}`;
      if (!currentSeriesMap.has(key)) currentSeriesMap.set(key, Array(dates.length).fill(null));
      const idx = dates.indexOf(r.date);
      if (idx >= 0) currentSeriesMap.get(key)![idx] = r.value;
    }

    // Build series: YoY data, key = "metric - dept [同期]"
    const yoySeriesMap = new Map<string, (number | null)[]>();
    if (yoyMode) {
      for (const r of yoyRows) {
        const m = metricMap.get(r.metric_id);
        if (!m) continue;
        const key = `${m.name} - ${r.department} [同期]`;
        if (!yoySeriesMap.has(key)) yoySeriesMap.set(key, Array(dates.length).fill(null));
        // Map YoY date to current period's X axis position
        const mappedDate = offsetMonth(r.date, 12);
        const idx = dates.indexOf(mappedDate);
        if (idx >= 0) yoySeriesMap.get(key)![idx] = r.value;
      }
    }

    // Merge series with paired colors: current[i] and yoy[i] share same palette color
    const currentEntries = Array.from(currentSeriesMap.entries());
    const yoyEntries = Array.from(yoySeriesMap.entries());
    const series: Record<string, unknown>[] = [];
    let paletteIdx = 0;
    for (const [name, data] of currentEntries) {
      series.push({
        name, type: chartType === "area" ? "line" : chartType, data,
        smooth: chartType !== "bar",
        symbol: chartType === "bar" ? "none" : "circle",
        symbolSize: 4,
        lineStyle: { width: 2, type: "solid" },
        areaStyle: chartType === "area" ? { opacity: 0.08 } : undefined,
        opacity: 1,
        color: PALETTE[paletteIdx % PALETTE.length],
      });
      // Find paired YoY series for same metric+dept
      const yoyName = `${name} [同期]`;
      const yoyEntry = yoyEntries.find(([k]) => k === yoyName);
      if (yoyEntry) {
        series.push({
          name: yoyEntry[0], type: chartType === "area" ? "line" : chartType, data: yoyEntry[1],
          smooth: chartType !== "bar",
          symbol: chartType === "bar" ? "none" : "circle",
          symbolSize: 3,
          lineStyle: { width: 2, type: "dashed" },
          areaStyle: chartType === "area" ? { opacity: 0.03 } : undefined,
          opacity: 0.5,
          color: PALETTE[paletteIdx % PALETTE.length],
        });
      }
      paletteIdx++;
    }

    // Summary from current data only
    const summaryItems: typeof summary = [];
    for (const mid of selectedMetrics) {
      const m = metricMap.get(mid);
      if (!m) continue;
      const vals: number[] = [];
      for (const r of currentRows) {
        if (r.metric_id === mid && r.value != null) vals.push(r.value);
      }
      if (vals.length > 0) {
        // Latest = average across all departments on the most recent date
        const byDate = new Map<string, number[]>();
        for (const r of currentRows) {
          if (r.metric_id === mid && r.value != null) {
            if (!byDate.has(r.date)) byDate.set(r.date, []);
            byDate.get(r.date)!.push(r.value);
          }
        }
        const latestDate = Array.from(byDate.keys()).sort().pop()!;
        const latestVals = byDate.get(latestDate)!;
        const latest = latestVals.reduce((s, v) => s + v, 0) / latestVals.length;

        summaryItems.push({
          metric: m.name,
          unit: m.unit,
          latest,
          avg: vals.reduce((s, v) => s + v, 0) / vals.length,
          min: Math.min(...vals),
          max: Math.max(...vals),
        });
      }
    }
    setSummary(summaryItems);

    const option: echarts.EChartsCoreOption = {
      color: PALETTE,
      tooltip: {
        trigger: "axis",
        backgroundColor: "#fff",
        borderColor: "#e2e8f0",
        borderWidth: 1,
        textStyle: { color: "#334155", fontSize: 12 },
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        formatter: (params: unknown) => {
          if (!Array.isArray(params)) return "";
          const date = params[0]?.axisValue ?? "";
          let html = `<div style="font-weight:600;margin-bottom:4px;color:#1e293b">${date}</div>`;
          for (const item of params) {
            html += `<div style="display:flex;align-items:center;gap:8px;font-size:12px">
              <span style="width:8px;height:8px;border-radius:50%;background:${item.color};display:inline-block;flex-shrink:0"></span>
              <span style="color:#64748b">${escapeHtml(item.seriesName)}</span>
              <span style="font-weight:500;color:#1e293b;margin-left:auto">${item.value ?? "—"}</span>
            </div>`;
          }
          return html;
        },
      },
      legend: {
        type: "scroll",
        bottom: 0,
        textStyle: { fontSize: 11, color: "#64748b" },
        pageIconColor: "#64748b",
        pageTextStyle: { color: "#64748b" },
      },
      grid: { top: 16, right: 24, bottom: 48, left: 56 },
      xAxis: {
        type: "category",
        data: dates,
        axisLine: { lineStyle: { color: "#e2e8f0" } },
        axisTick: { show: false },
        axisLabel: { fontSize: 11, color: "#94a3b8" },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "#f1f5f9", type: "dashed" } },
        axisLabel: { fontSize: 11, color: "#94a3b8" },
      },
      series,
    };

    setChartOption(option);
  }, [selectedMetrics, selectedDepts, dateFrom, dateTo, chartType, metrics, yoyMode]);

  // Auto-query when selections are ready
  useEffect(() => {
    if (selectedMetrics.length > 0 && selectedDepts.length > 0) {
      doQuery();
    }
  }, [selectedMetrics, selectedDepts, dateFrom, dateTo, chartType, doQuery]);

  function handleQuery() {
    if (selectedMetrics.length === 0 && selectedDepts.length === 0) {
      setHint("请至少选择一个指标和一个科室");
      return;
    }
    if (selectedMetrics.length === 0) { setHint("请至少选择一个指标"); return; }
    if (selectedDepts.length === 0) { setHint("请至少选择一个科室"); return; }
    doQuery();
  }

  function toggleMetric(id: number) {
    setHint("");
    setSelectedMetrics((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleDept(dept: string) {
    setHint("");
    setSelectedDepts((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept],
    );
  }

  function fmt(n: number): string {
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(1);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">趋势图</h2>
          <p className="text-sm text-slate-500 mt-1">选择指标和科室，自动生成趋势图表</p>
        </div>
        <div className="flex bg-slate-100 rounded-lg p-0.5">
          {([
            ["line", TrendingUp, "折线"],
            ["bar", BarChart3, "柱状"],
            ["area", AreaChart, "面积"],
          ] as const).map(([type, Icon, label]) => (
            <button
              key={type}
              onClick={() => setChartType(type)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                chartType === type
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI summary cards */}
      {summary.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {summary.map((s) => (
            <div
              key={s.metric}
              className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm"
            >
              <p className="text-xs text-slate-500 mb-1 truncate">
                {s.metric} ({s.unit})
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-slate-800">
                  {fmt(s.latest)}
                </span>
                <span className="text-xs text-slate-400">{s.unit}</span>
              </div>
              <div className="flex gap-3 mt-2 text-xs">
                <span className="text-blue-600 font-medium">均 {fmt(s.avg)}</span>
                <span className="text-amber-600 font-medium">低 {fmt(s.min)}</span>
                <span className="text-emerald-600 font-medium">高 {fmt(s.max)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selectors */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-sm">
        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-600 mb-2">
            指标（可多选）
          </label>
          <div className="flex flex-wrap gap-2">
            {metrics.map((m) => (
              <button
                key={m.id}
                onClick={() => toggleMetric(m.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  selectedMetrics.includes(m.id)
                    ? "bg-blue-100 text-blue-700 border border-blue-200 shadow-sm"
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
          <button
            onClick={() => setYoyMode(!yoyMode)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm ${
              yoyMode
                ? "bg-amber-100 text-amber-700 border border-amber-200"
                : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            <GitCompare className="w-4 h-4" />
            同期对比
            {yoyMode && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-amber-500" />
            )}
          </button>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              起始月份
            </label>
            <MonthPicker value={dateFrom} onChange={setDateFrom} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              结束月份
            </label>
            <MonthPicker value={dateTo} onChange={setDateTo} placeholder="不限" />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleQuery}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              生成图表
            </button>
            {hint && (
              <span className="text-xs text-amber-600 animate-in fade-in">
                {hint}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Chart */}
      {chartOption ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-500 uppercase">图表</span>
            <button
              onClick={handleSaveChart}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              保存图片
            </button>
          </div>
          <div className="p-5">
            <ReactEChartsCore
              ref={chartRef}
              echarts={echarts}
              option={chartOption}
              style={{ height: 440 }}
              notMerge
            />
          </div>
        </div>
      ) : (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-xl">
          <TrendingUp className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-sm text-slate-400">暂无数据，请检查筛选条件</p>
        </div>
      )}
    </div>
  );
}
