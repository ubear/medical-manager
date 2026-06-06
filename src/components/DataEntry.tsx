import { useEffect, useState, useRef } from "react";
import {
  getMetrics,
  saveRecords,
  getDepartments,
  importFromXlsx,
} from "../lib/db";
import type { MetricDefinition, Department } from "../lib/types";
import { Save, Check, Upload, Calendar } from "lucide-react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import * as XLSX from "xlsx";

export default function DataEntry() {
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [date, setDate] = useState<Date>(new Date());
  const [department, setDepartment] = useState("");
  const [values, setValues] = useState<Record<number, string>>({});
  const [saved, setSaved] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const m = await getMetrics();
      const d = await getDepartments();
      setMetrics(m);
      setDepartments(d);
    })();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setShowCalendar(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleValueChange(metricId: number, val: string) {
    setValues((prev) => ({ ...prev, [metricId]: val }));
    setSaved(false);
  }

  async function handleSubmit() {
    if (!date || !department) return;
    const records = metrics.map((m) => ({
      date: date.toISOString().slice(0, 10),
      department,
      metric_id: m.id,
      value:
        values[m.id] !== undefined && values[m.id] !== ""
          ? parseFloat(values[m.id])
          : null,
    }));
    await saveRecords(records);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleXlsxImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet);

    if (rows.length === 0) {
      setImportMsg("文件无数据");
      return;
    }

    const result = await importFromXlsx(rows);
    setImportMsg(
      `导入 ${result.imported} 条记录` +
        (result.newDepts.length > 0
          ? `，新增科室：${result.newDepts.join("、")}`
          : ""),
    );
    const d = await getDepartments();
    setDepartments(d);
    setTimeout(() => setImportMsg(null), 4000);
    e.target.value = "";
  }

  const ds = date.toISOString().slice(0, 10);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">数据录入</h2>
          <p className="text-sm text-slate-500 mt-1">
            选择日期和科室，填入指标数值
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 cursor-pointer hover:bg-slate-50 transition-colors shadow-sm">
            <Upload className="w-4 h-4" />
            导入 XLSX
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleXlsxImport}
              className="hidden"
            />
          </label>
          <button
            onClick={handleSubmit}
            disabled={!date || !department}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-medium transition-all shadow-sm ${
              saved
                ? "bg-emerald-600 text-white shadow-emerald-600/20"
                : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" /> 已保存
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> 提交保存
              </>
            )}
          </button>
        </div>
      </div>

      {importMsg && (
        <div className="mb-4 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 shadow-sm">
          {importMsg}
        </div>
      )}

      <div className="flex gap-5 mb-6">
        {/* Date picker */}
        <div className="relative" ref={calendarRef}>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            日期
          </label>
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 hover:border-blue-300 transition-all shadow-sm min-w-[160px]"
          >
            <Calendar className="w-4 h-4 text-slate-400" />
            {ds}
          </button>
          {showCalendar && (
            <div className="absolute top-full mt-2 z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-2 animate-in fade-in zoom-in-95">
              <DayPicker
                mode="single"
                selected={date}
                onSelect={(d) => {
                  if (d) {
                    setDate(d);
                    setSaved(false);
                  }
                  setShowCalendar(false);
                }}
                footer={
                  <button
                    onClick={() => {
                      setDate(new Date());
                      setShowCalendar(false);
                    }}
                    className="mt-2 text-xs text-blue-600 hover:text-blue-700"
                  >
                    回到今天
                  </button>
                }
              />
            </div>
          )}
        </div>

        {/* Department select */}
        <div className="flex-1 max-w-xs">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            科室
          </label>
          <select
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              setSaved(false);
            }}
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 transition-all shadow-sm appearance-none cursor-pointer"
          >
            <option value="">选择科室...</option>
            {departments.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Metrics table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
              <th className="text-left px-5 py-3.5 text-xs font-medium text-slate-500 uppercase w-12">
                #
              </th>
              <th className="text-left px-5 py-3.5 text-xs font-medium text-slate-500 uppercase">
                指标名称
              </th>
              <th className="text-left px-5 py-3.5 text-xs font-medium text-slate-500 uppercase">
                数值
              </th>
              <th className="text-left px-5 py-3.5 text-xs font-medium text-slate-500 uppercase">
                单位
              </th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m, i) => (
              <tr
                key={m.id}
                className="border-b border-slate-50 hover:bg-blue-50/30 transition-colors"
              >
                <td className="px-5 py-3 text-xs text-slate-400">{i + 1}</td>
                <td className="px-5 py-3 text-sm text-slate-700 font-medium">
                  {m.name}
                </td>
                <td className="px-5 py-3">
                  <input
                    type="number"
                    step="any"
                    value={values[m.id] ?? ""}
                    onChange={(e) => handleValueChange(m.id, e.target.value)}
                    placeholder="—"
                    className="w-36 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 transition-all"
                  />
                </td>
                <td className="px-5 py-3 text-sm text-slate-400">{m.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
