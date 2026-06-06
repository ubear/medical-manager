import { useEffect, useState, useMemo } from "react";
import { queryRecords, getMetrics, getDepartments } from "../lib/db";
import type { MetricDefinition, RecordRow, Department } from "../lib/types";
import { Download, Search, RotateCcw } from "lucide-react";
import * as XLSX from "xlsx";

export default function DataAnalysis() {
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

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
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      departments: selectedDepts.length > 0 ? selectedDepts : undefined,
    });
    setRecords(rows);
    setLoading(false);
  }

  async function handleReset() {
    setDateFrom("");
    setDateTo("");
    setSelectedDepts([]);
    setRecords([]);
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

  function toggleDept(name: string) {
    setSelectedDepts((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  }

  function handleExport() {
    if (pivoted.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(pivoted);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "数据分析");
    XLSX.writeFile(wb, `医疗指标数据_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">数据分析</h2>
          <p className="text-sm text-slate-500 mt-1">筛选、查看和导出数据</p>
        </div>
        <button
          onClick={handleExport}
          disabled={pivoted.length === 0}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-40"
        >
          <Download className="w-4 h-4" />
          导出 Excel
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4 mb-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              起始日期
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              结束日期
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleSearch}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
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

        {/* Department chips */}
        {departments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {departments.map((d) => (
              <button
                key={d.id}
                onClick={() => toggleDept(d.name)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  selectedDepts.includes(d.name)
                    ? "bg-blue-100 text-blue-700 border border-blue-200 shadow-sm"
                    : "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200 hover:shadow-sm"
                }`}
              >
                {d.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center text-slate-400 py-12">加载中...</div>
      ) : pivoted.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase sticky left-0 bg-slate-50">
                  日期
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                  科室
                </th>
                {metrics.map((m) => (
                  <th
                    key={m.id}
                    className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase"
                  >
                    {m.name}
                    {m.unit ? ` (${m.unit})` : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pivoted.map((row, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 text-slate-600 sticky left-0 bg-white">
                    {row.date}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700 font-medium">
                    {row.department}
                  </td>
                  {metrics.map((m) => (
                    <td
                      key={m.id}
                      className="px-4 py-2.5 text-right text-slate-600"
                    >
                      {(row as Record<string, unknown>)[m.name] !== undefined
                        ? String((row as Record<string, unknown>)[m.name])
                        : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center text-slate-400 py-12">
          请设置筛选条件并点击查询
        </div>
      )}
    </div>
  );
}
