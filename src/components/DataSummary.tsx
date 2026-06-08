import { useEffect, useState } from "react";
import { queryRecords, getMetrics, getDepartments } from "../lib/db";
import type { MetricDefinition, Department } from "../lib/types";
import MonthPicker, { formatMonth } from "./MonthPicker";
import { Search, RotateCcw, Calculator } from "lucide-react";

function monthsAgo(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}

export default function DataSummary() {
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [dateFrom, setDateFrom] = useState<Date>(() => monthsAgo(12));
  const [dateTo, setDateTo] = useState<Date>(() => new Date());
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [stats, setStats] = useState<Record<string, { avg: number; min: number; max: number; count: number; sum: number }>>({});

  useEffect(() => {
    (async () => {
      const m = await getMetrics();
      const d = await getDepartments();
      setMetrics(m);
      setDepartments(d);
    })();
  }, []);

  async function handleSearch() {
    const rows = await queryRecords({
      dateFrom: formatMonth(dateFrom),
      dateTo: formatMonth(dateTo),
      departments: selectedDepts.length > 0 ? selectedDepts : undefined,
    });
    const result: Record<string, { avg: number; min: number; max: number; count: number; sum: number }> = {};
    for (const m of metrics) {
      const vals: number[] = [];
      for (const r of rows) {
        if (r.metric_name === m.name && r.value != null) vals.push(r.value);
      }
      if (vals.length > 0) {
        result[m.name] = {
          avg: vals.reduce((s, v) => s + v, 0) / vals.length,
          min: Math.min(...vals),
          max: Math.max(...vals),
          count: vals.length,
          sum: vals.reduce((s, v) => s + v, 0),
        };
      }
    }
    setStats(result);
  }

  function toggleDept(name: string) {
    setSelectedDepts((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }

  function fmt(n: number): string {
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(1);
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-800">汇总统计</h2>
        <p className="text-sm text-slate-500 mt-1">按指标维度查看平均值、最值、总和等汇总数据</p>
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
            <Search className="w-4 h-4" /> 查询
          </button>
          <button onClick={() => setStats({})} className="flex items-center gap-1.5 px-4 py-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
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

      {Object.keys(stats).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gradient-to-r from-blue-50 to-white border-b border-slate-200 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Calculator className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <span className="text-sm font-semibold text-slate-800">汇总统计</span>
              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{metrics.filter((m) => stats[m.name]).length} 项指标</span>
            </div>
          </div>
          <div className="overflow-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase">指标</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">平均值</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">最小值</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">最大值</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">总和</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">数据量</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m, i) => {
                  const s = stats[m.name];
                  return (
                    <tr key={m.id} className={`border-b border-slate-50 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-slate-50/30"} hover:bg-blue-50/30`}>
                      <td className="px-5 py-2.5 text-sm text-slate-800 font-medium">{m.name}</td>
                      {s ? (
                        <>
                          <td className="px-4 py-2.5 text-right text-sm font-semibold text-blue-700">{fmt(s.avg)}<span className="text-xs font-normal text-slate-400 ml-1">{m.unit}</span></td>
                          <td className="px-4 py-2.5 text-right text-sm text-amber-600">{fmt(s.min)}</td>
                          <td className="px-4 py-2.5 text-right text-sm text-emerald-600">{fmt(s.max)}</td>
                          <td className="px-4 py-2.5 text-right text-sm text-slate-700">{fmt(s.sum)}</td>
                          <td className="px-4 py-2.5 text-right text-sm text-slate-400">{s.count}</td>
                        </>
                      ) : (
                        <td colSpan={5} className="px-4 py-2.5 text-sm text-slate-300 text-center">—</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
