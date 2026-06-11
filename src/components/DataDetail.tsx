import { useEffect, useState, useMemo } from "react";
import { queryRecords, getMetrics, getDepartments } from "../lib/db";
import type { MetricDefinition, RecordRow, Department } from "../lib/types";
import { Download, Search, RotateCcw, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import MonthPicker, { formatMonth } from "./MonthPicker";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import * as XLSX from "xlsx";

function monthsAgo(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}

type SortField = "date" | "department" | string;
type SortDir = "asc" | "desc";

export default function DataDetail() {
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [dateFrom, setDateFrom] = useState<Date>(() => monthsAgo(12));
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
      dateFrom: formatMonth(dateFrom),
      dateTo: formatMonth(dateTo),
      departments: selectedDepts.length > 0 ? selectedDepts : undefined,
    });
    setRecords(rows);
    setLoading(false);
  }

  async function handleReset() {
    setDateFrom(monthsAgo(12));
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

  const pivoted = useMemo(() => {
    const map = new Map<string, Record<string, number | null>>();
    for (const r of records) {
      const key = `${r.date}|${r.department}`;
      if (!map.has(key)) map.set(key, {});
      const row = map.get(key)!;
      row[r.metric_name] = r.value;
    }
    return Array.from(map.entries()).map(([key, vals]) => {
      const [date, dept] = key.split("|");
      return { date, department: dept, ...vals };
    });
  }, [records]);

  const sorted = useMemo(() => {
    const arr = [...pivoted];
    arr.sort((a, b) => {
      let va: unknown, vb: unknown;
      if (sortField === "date") { va = a.date; vb = b.date; }
      else if (sortField === "department") { va = a.department; vb = b.department; }
      else { va = (a as Record<string, unknown>)[sortField] ?? -Infinity; vb = (b as Record<string, unknown>)[sortField] ?? -Infinity; }
      if (va === vb) return 0;
      const cmp = (va ?? -Infinity) < (vb ?? -Infinity) ? -1 : 1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [pivoted, sortField, sortDir]);

  function toggleDept(name: string) {
    setSelectedDepts((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  }

  async function handleExport() {
    if (sorted.length === 0) return;
    try {
      const prefix = selectedDepts.length > 0
        ? selectedDepts.join("_")
        : "数据明细";
      const path = await save({
        defaultPath: `${prefix}_${formatMonth(new Date())}.xlsx`,
      });
      if (!path) return;
      const ws = XLSX.utils.json_to_sheet(sorted);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "数据明细");
      const data = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
      await writeFile(path, bytes);
      alert(`导出成功: ${sorted.length} 行数据已保存`);
    } catch (e: any) {
      alert(`导出失败: ${e?.message ?? e}`);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">数据明细</h2>
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
          <button onClick={handleReset} className="flex items-center gap-1.5 px-4 py-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
            <RotateCcw className="w-4 h-4" /> 重置
          </button>
        </div>
        {departments.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setSelectedDepts(departments.map((d) => d.name))} className="text-xs text-blue-600 hover:text-blue-700 font-medium mr-1">全选</button>
            <button onClick={() => setSelectedDepts([])} className="text-xs text-slate-400 hover:text-slate-600 font-medium mr-2">取消</button>
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

      {loading ? (
        <div className="text-center text-slate-500 py-12 text-sm">加载中...</div>
      ) : sorted.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-auto shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                <th onClick={() => handleSort("date")} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase sticky left-0 bg-slate-50 cursor-pointer select-none hover:text-slate-700">
                  <span className="inline-flex items-center gap-1">日期 <SortIcon field="date" /></span>
                </th>
                <th onClick={() => handleSort("department")} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700">
                  <span className="inline-flex items-center gap-1">科室 <SortIcon field="department" /></span>
                </th>
                {metrics.map((m) => (
                  <th key={m.id} onClick={() => handleSort(m.name)} className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700">
                    <span className="inline-flex items-center gap-1 justify-end">
                      {m.name} <span className="font-normal text-slate-400">({m.unit})</span> <SortIcon field={m.name} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr key={i} className={`border-b border-slate-100 transition-colors hover:bg-blue-50/20 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}>
                  <td className="px-5 py-2.5 text-sm text-slate-600 sticky left-0 bg-inherit">{row.date}</td>
                  <td className="px-4 py-2.5 text-sm text-slate-800 font-semibold">{row.department}</td>
                  {metrics.map((m) => {
                    const val = (row as Record<string, unknown>)[m.name];
                    const hasVal = val !== undefined && val !== null;
                    return (
                      <td key={m.id} className={`px-4 py-2.5 text-right text-sm ${hasVal ? "text-slate-700 font-medium" : "text-slate-300"}`}>
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
