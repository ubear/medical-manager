import { useEffect, useState, useMemo } from "react";
import { queryRecords, getMetrics, getDepartments } from "../lib/db";
import type { MetricDefinition, RecordRow, Department } from "../lib/types";
import { log } from "../lib/logger";
import {
  Download,
  Search,
  RotateCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calculator,
} from "lucide-react";
import DatePicker from "./DatePicker";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import * as XLSX from "xlsx";

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

type SortField = "date" | "department" | string;
type SortDir = "asc" | "desc";

export default function DataAnalysis() {
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [dateFrom, setDateFrom] = useState<Date>(() => daysAgo(7));
  const [dateTo, setDateTo] = useState<Date>(() => new Date());
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    (async () => {
      const m = await getMetrics();
      const d = await getDepartments();
      setMetrics(m);
      setDepartments(d);
    })();
  }, []);

  async function handleSearch() {
    setLoading(true);
    const rows = await queryRecords({
      dateFrom: dateFrom?.toISOString().slice(0, 10),
      dateTo: dateTo?.toISOString().slice(0, 10),
      departments: selectedDepts.length > 0 ? selectedDepts : undefined,
    });
    setRecords(rows);
    setLoading(false);
  }

  async function handleReset() {
    setDateFrom(daysAgo(7));
    setDateTo(new Date());
    setSelectedDepts([]);
    setRecords([]);
    setSortField("date");
    setSortDir("desc");
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-300" />;
    return sortDir === "asc" ? (
      <ArrowUp className="w-3 h-3 text-blue-500" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-500" />
    );
  }

  // Pivot: rows = date+department, columns = metrics
  const pivoted = useMemo(() => {
    const map = new Map<string, Record<string, number | null>>();
    for (const r of records) {
      const key = `${r.date}|${r.department}`;
      if (!map.has(key)) {
        map.set(key, {});
      }
      const row = map.get(key)!;
      row[r.metric_name] = r.value;
    }
    return Array.from(map.entries()).map(([key, vals]) => {
      const [date, dept] = key.split("|");
      return { date, department: dept, ...vals };
    });
  }, [records]);

  // Sort pivoted data
  const sorted = useMemo(() => {
    const arr = [...pivoted];
    arr.sort((a, b) => {
      let va: unknown, vb: unknown;
      if (sortField === "date") {
        va = a.date;
        vb = b.date;
      } else if (sortField === "department") {
        va = a.department;
        vb = b.department;
      } else {
        va = (a as Record<string, unknown>)[sortField] ?? -Infinity;
        vb = (b as Record<string, unknown>)[sortField] ?? -Infinity;
      }

      if (va === vb) return 0;
      const cmp = (va ?? -Infinity) < (vb ?? -Infinity) ? -1 : 1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [pivoted, sortField, sortDir]);

  // Per-metric stats
  const stats = useMemo(() => {
    const result: Record<
      string,
      { avg: number; min: number; max: number; count: number }
    > = {};
    for (const m of metrics) {
      const vals: number[] = [];
      for (const row of sorted) {
        const v = (row as Record<string, unknown>)[m.name];
        if (typeof v === "number" && !isNaN(v)) vals.push(v);
      }
      if (vals.length > 0) {
        result[m.name] = {
          avg: vals.reduce((s, v) => s + v, 0) / vals.length,
          min: Math.min(...vals),
          max: Math.max(...vals),
          count: vals.length,
        };
      }
    }
    return result;
  }, [sorted, metrics]);

  function toggleDept(name: string) {
    setSelectedDepts((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  }

  async function handleExport() {
    if (sorted.length === 0) return;
    const path = await save({
      defaultPath: `医疗指标数据_${new Date().toISOString().slice(0, 10)}.xlsx`,
      filters: [{ name: "Excel", extensions: ["xlsx"] }],
    });
    if (!path) return;
    const ws = XLSX.utils.json_to_sheet(sorted);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "数据分析");
    const data = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    await writeFile(path, new Uint8Array(data));
    log.info("DataAnalysis", `导出 Excel: ${sorted.length} 行 → ${path}`);
  }

  function fmt(n: number): string {
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(1);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">数据分析</h2>
          <p className="text-sm text-slate-500 mt-1">筛选、查看、排序和导出数据</p>
        </div>
        <button
          onClick={handleExport}
          disabled={sorted.length === 0}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-40 shadow-sm"
        >
          <Download className="w-4 h-4" />
          导出 Excel
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex flex-wrap items-end gap-4 mb-3">
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
            <DatePicker value={dateTo} onChange={setDateTo} placeholder="不限" />
          </div>
          <button
            onClick={handleSearch}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Search className="w-4 h-4" /> 查询
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> 重置
          </button>
        </div>

        {departments.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedDepts(departments.map((d) => d.name))}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium mr-1"
            >
              全选
            </button>
            <button
              onClick={() => setSelectedDepts([])}
              className="text-xs text-slate-400 hover:text-slate-600 font-medium mr-2"
            >
              取消
            </button>
            {departments.map((d) => (
              <button
                key={d.id}
                onClick={() => toggleDept(d.name)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  selectedDepts.includes(d.name)
                    ? "bg-blue-100 text-blue-700 border border-blue-200 shadow-sm"
                    : "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200"
                }`}
              >
                {d.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Summary stats */}
      {sorted.length > 0 && Object.keys(stats).length > 0 && (
        <div className="mb-6 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gradient-to-r from-blue-50 to-white border-b border-slate-200 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Calculator className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <span className="text-sm font-semibold text-slate-800">汇总统计</span>
              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                {sorted.length} 条记录
              </span>
            </div>
          </div>
          <div className="overflow-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase">
                    指标
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">
                    平均值
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">
                    最小值
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">
                    最大值
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">
                    数据量
                  </th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m, i) => {
                  const s = stats[m.name];
                  return (
                    <tr
                      key={m.id}
                      className={`border-b border-slate-50 transition-colors ${
                        i % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                      } hover:bg-blue-50/30`}
                    >
                      <td className="px-5 py-2.5 text-sm text-slate-800 font-medium">
                        {m.name}
                      </td>
                      {s ? (
                        <>
                          <td className="px-4 py-2.5 text-right text-sm font-semibold text-blue-700">
                            {fmt(s.avg)}
                            <span className="text-xs font-normal text-slate-400 ml-1">{m.unit}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-sm text-amber-600">
                            {fmt(s.min)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-sm text-emerald-600">
                            {fmt(s.max)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-sm text-slate-400">
                            {s.count}
                          </td>
                        </>
                      ) : (
                        <td colSpan={4} className="px-4 py-2.5 text-sm text-slate-300 text-center">
                          —
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Data table */}
      {loading ? (
        <div className="text-center text-slate-500 py-12 text-sm">加载中...</div>
      ) : sorted.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-auto shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                <th
                  onClick={() => handleSort("date")}
                  className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase sticky left-0 bg-slate-50 cursor-pointer select-none hover:text-slate-700"
                >
                  <span className="inline-flex items-center gap-1">
                    日期 <SortIcon field="date" />
                  </span>
                </th>
                <th
                  onClick={() => handleSort("department")}
                  className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700"
                >
                  <span className="inline-flex items-center gap-1">
                    科室 <SortIcon field="department" />
                  </span>
                </th>
                {metrics.map((m) => (
                  <th
                    key={m.id}
                    onClick={() => handleSort(m.name)}
                    className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700"
                  >
                    <span className="inline-flex items-center gap-1 justify-end">
                      {m.name}
                      <span className="font-normal text-slate-400">({m.unit})</span>
                      <SortIcon field={m.name} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr
                  key={i}
                  className={`border-b border-slate-100 transition-colors hover:bg-blue-50/20 ${
                    i % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                  }`}
                >
                  <td className="px-5 py-2.5 text-sm text-slate-600 sticky left-0 bg-inherit">
                    {row.date}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-slate-800 font-semibold">
                    {row.department}
                  </td>
                  {metrics.map((m) => {
                    const val = (row as Record<string, unknown>)[m.name];
                    const hasVal = val !== undefined && val !== null;
                    return (
                      <td
                        key={m.id}
                        className={`px-4 py-2.5 text-right text-sm ${
                          hasVal ? "text-slate-700 font-medium" : "text-slate-300"
                        }`}
                      >
                        {hasVal ? String(val) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-20">
          <Search className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-sm text-slate-400">请设置筛选条件并点击查询</p>
        </div>
      )}
    </div>
  );
}
