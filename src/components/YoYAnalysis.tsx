import { useEffect, useState, useMemo } from "react";
import { queryRecords, getMetrics, getDepartments } from "../lib/db";
import type { MetricDefinition, Department } from "../lib/types";
import MonthPicker, { formatMonth } from "./MonthPicker";
import { Search, RotateCcw, GitCompare, TrendingUp, TrendingDown, Minus } from "lucide-react";

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

export default function YoYAnalysis() {
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [dateFrom, setDateFrom] = useState<Date>(() => monthsAgo(12));
  const [dateTo, setDateTo] = useState<Date>(() => new Date());
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [comparison, setComparison] = useState<{
    currentLabel: string;
    prevLabel: string;
    rows: { metric: string; unit: string; current: number | null; prev: number | null; change: number | null }[];
  } | null>(null);

  useEffect(() => {
    (async () => {
      const m = await getMetrics();
      const d = await getDepartments();
      setMetrics(m);
      setDepartments(d);
    })();
  }, []);

  async function handleSearch() {
    const from = formatMonth(dateFrom);
    const to = formatMonth(dateTo);

    const [currentRows, prevRows] = await Promise.all([
      queryRecords({
        dateFrom: from,
        dateTo: to,
        departments: selectedDepts.length > 0 ? selectedDepts : undefined,
      }),
      queryRecords({
        dateFrom: offsetMonth(from, -12),
        dateTo: offsetMonth(to, -12),
        departments: selectedDepts.length > 0 ? selectedDepts : undefined,
      }),
    ]);

    // Aggregate by metric
    const currentMap = new Map<string, number[]>();
    const prevMap = new Map<string, number[]>();

    for (const r of currentRows) {
      if (r.value == null) continue;
      if (!currentMap.has(r.metric_name)) currentMap.set(r.metric_name, []);
      currentMap.get(r.metric_name)!.push(r.value);
    }
    for (const r of prevRows) {
      if (r.value == null) continue;
      if (!prevMap.has(r.metric_name)) prevMap.set(r.metric_name, []);
      prevMap.get(r.metric_name)!.push(r.value);
    }

    const rows = metrics
      .filter((m) => currentMap.has(m.name) || prevMap.has(m.name))
      .map((m) => {
        const curVals = currentMap.get(m.name) ?? [];
        const prevVals = prevMap.get(m.name) ?? [];
        const currentAvg = curVals.length > 0 ? curVals.reduce((a, b) => a + b, 0) / curVals.length : null;
        const prevAvg = prevVals.length > 0 ? prevVals.reduce((a, b) => a + b, 0) / prevVals.length : null;
        const change = currentAvg != null && prevAvg != null && prevAvg !== 0
          ? ((currentAvg - prevAvg) / prevAvg) * 100
          : null;
        return { metric: m.name, unit: m.unit, current: currentAvg, prev: prevAvg, change };
      });

    setComparison({
      currentLabel: `${from} ~ ${to}`,
      prevLabel: `${offsetMonth(from, -12)} ~ ${offsetMonth(to, -12)}`,
      rows,
    });
  }

  function toggleDept(name: string) {
    setSelectedDepts((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }

  function fmt(n: number): string {
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(1);
  }

  function pct(n: number): string {
    return (n > 0 ? "+" : "") + n.toFixed(1);
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-800">同比分析</h2>
        <p className="text-sm text-slate-500 mt-1">对比所选时间范围与去年同期的指标变化</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex flex-wrap items-end gap-4 mb-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">起始月份</label>
            <MonthPicker value={dateFrom} onChange={setDateFrom} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">结束月份</label>
            <MonthPicker value={dateTo} onChange={setDateTo} placeholder="不限" />
          </div>
          <button onClick={handleSearch} className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
            <Search className="w-4 h-4" /> 对比分析
          </button>
          <button onClick={() => setComparison(null)} className="flex items-center gap-1.5 px-4 py-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
            <RotateCcw className="w-4 h-4" /> 清空
          </button>
        </div>
        {departments.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setSelectedDepts(departments.map((d) => d.name))} className="text-xs text-blue-600 hover:text-blue-700 font-medium mr-1">全选</button>
            <button onClick={() => setSelectedDepts([])} className="text-xs text-slate-400 hover:text-slate-600 font-medium mr-2">取消</button>
            {departments.map((d) => (
              <button key={d.id} onClick={() => toggleDept(d.name)} className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${selectedDepts.includes(d.name) ? "bg-blue-100 text-blue-700 border border-blue-200 shadow-sm" : "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200"}`}>
                {d.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {comparison && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gradient-to-r from-emerald-50 to-white border-b border-slate-200 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <GitCompare className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <span className="text-sm font-semibold text-slate-800">同比对比</span>
              <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs">{comparison.rows.length} 项指标</span>
            </div>
          </div>
          <div className="overflow-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase">指标</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">本期 ({comparison.currentLabel})</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">去年同期 ({comparison.prevLabel})</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">变化 (%)</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">趋势</th>
                </tr>
              </thead>
              <tbody>
                {comparison.rows.map((row, i) => (
                  <tr key={row.metric} className={`border-b border-slate-50 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-slate-50/30"} hover:bg-blue-50/30`}>
                    <td className="px-5 py-2.5 text-sm text-slate-800 font-medium">{row.metric}<span className="text-xs text-slate-400 ml-1">({row.unit})</span></td>
                    <td className="px-4 py-2.5 text-right text-sm font-semibold text-slate-700">{row.current != null ? fmt(row.current) : "—"}</td>
                    <td className="px-4 py-2.5 text-right text-sm text-slate-500">{row.prev != null ? fmt(row.prev) : "—"}</td>
                    <td className={`px-4 py-2.5 text-right text-sm font-semibold ${row.change != null ? (row.change > 0 ? "text-emerald-600" : row.change < 0 ? "text-red-500" : "text-slate-400") : "text-slate-300"}`}>
                      {row.change != null ? pct(row.change) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {row.change != null ? (
                        row.change > 0 ? <TrendingUp className="w-4 h-4 text-emerald-500" /> :
                        row.change < 0 ? <TrendingDown className="w-4 h-4 text-red-400" /> :
                        <Minus className="w-4 h-4 text-slate-300" />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
