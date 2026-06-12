import { useEffect, useState } from "react";
import {
  getMetrics,
  getMetricsByCategory,
  saveRecords,
  getDepartments,
  importFromXlsx,
} from "../lib/db";
import type { MetricDefinition, MetricCategory, Department } from "../lib/types";
import { log } from "../lib/logger";
import { Save, Check, Upload, FileSpreadsheet, RotateCcw } from "lucide-react";
import MonthPicker, { formatMonth } from "./MonthPicker";
import * as XLSX from "xlsx";


export default function DataEntry() {
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [grouped, setGrouped] = useState<{ category: MetricCategory | null; metrics: MetricDefinition[] }[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [date, setDate] = useState<Date>(new Date());
  const [department, setDepartment] = useState("");
  const [values, setValues] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [saved, setSaved] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const m = await getMetrics();
      const g = await getMetricsByCategory();
      const d = await getDepartments();
      setMetrics(m);
      setGrouped(g.filter((g) => g.metrics.length > 0));
      setDepartments(d);
    })();
  }, []);

  function validate(_metricId: number, val: string): string {
    if (val === "" || val === undefined) return "";
    const num = Number(val);
    if (isNaN(num)) return "请输入数字";
    return "";
  }
  function handleValueChange(metricId: number, val: string) {
    setValues((prev) => ({ ...prev, [metricId]: val }));
    setErrors((prev) => ({ ...prev, [metricId]: validate(metricId, val) }));
    setSaved(false);
  }

  async function handleSubmit() {
    if (!date || !department) return;
    const hasErrors = Object.values(errors).some((e) => e !== "");
    if (hasErrors) return;

    const records = metrics.map((m) => ({
      date: formatMonth(date),
      department,
      metric_id: m.id,
      value:
        values[m.id] !== undefined && values[m.id] !== ""
          ? parseFloat(values[m.id])
          : null,
    }));
    try {
      await saveRecords(records);
      log.info("DataEntry", `提交: ${department} ${formatMonth(date)}, ${records.filter(r=>r.value!=null).length} 项`);
      setValues({});
      setErrors({});
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      log.error("DataEntry", "保存失败", e);
      alert("保存失败，请重试");
    }
  }

  function handleClear() {
    setValues({});
    setErrors({});
    setSaved(false);
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

    log.info("DataEntry", `开始 XLSX 导入: ${rows.length} 行`);
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

  const hasAnyError = Object.values(errors).some((e) => e !== "");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">数据录入</h2>
          <p className="text-sm text-slate-500 mt-1">
            选择日期和科室，填入指标数值（可留空）
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
            disabled={!date || !department || hasAnyError}
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
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            清空
          </button>
        </div>
      </div>

      {importMsg && (
        <div className="mb-4 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 shadow-sm">
          {importMsg}
        </div>
      )}

      <div className="mb-4 px-4 py-2.5 bg-blue-50 border border-blue-100 rounded-lg text-xs text-slate-600 flex items-start gap-2">
        <FileSpreadsheet className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
        <span>
          XLSX 第一行为表头，需包含 <b className="text-slate-800">月份</b> 和{" "}
          <b className="text-slate-800">科室</b> 列。其余列名与指标名称一致。未知科室将自动添加。
        </span>
      </div>

      <div className="flex gap-5 mb-6">
        <MonthPicker
          label="月份"
          value={date}
          onChange={(d) => { setDate(d); setSaved(false); }}
        />

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

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-white">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase w-12">#</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">指标名称</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">数值</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">单位</th>
            </tr>
          </thead>
          {grouped.length > 0 ? (
            grouped.map((group) => (
              <tbody key={group.category?.id ?? "uncategorized"}>
                <tr className="bg-slate-100/60">
                  <td colSpan={4} className="px-5 py-2 text-xs font-semibold text-slate-500 uppercase">
                    {group.category?.name ?? "未分类"}
                    <span className="ml-2 font-normal text-slate-400">({group.metrics.length})</span>
                  </td>
                </tr>
                {group.metrics.map((m) => {
                  const err = errors[m.id];
                  const globalIdx = metrics.findIndex((x) => x.id === m.id) + 1;
                  return (
                    <tr key={m.id} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
                      <td className="px-5 py-3 text-xs text-slate-400">{globalIdx}</td>
                      <td className="px-5 py-3 text-sm text-slate-800 font-medium">{m.name}</td>
                      <td className="px-5 py-3">
                        <div className="relative">
                          <input
                            type="number"
                            step="0.0001"
                            value={values[m.id] ?? ""}
                            onChange={(e) => handleValueChange(m.id, e.target.value)}
                            placeholder="留空则跳过"
                            className={`w-36 px-3 py-2 border rounded-lg text-sm transition-all focus:outline-none focus:ring-2 placeholder:text-slate-300 ${
                              err
                                ? "border-red-300 focus:ring-red-500/30 focus:border-red-400 bg-red-50/30"
                                : "border-slate-200 focus:ring-blue-500/50 focus:border-blue-400"
                            }`}
                          />
                          {err && (
                            <p className="text-xs text-red-500 mt-0.5 absolute -bottom-4 left-0 whitespace-nowrap">
                              {err}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-800">{m.unit}</td>
                    </tr>
                  );
                })}
              </tbody>
            ))
          ) : (
            <tbody>
              {metrics.map((m, i) => {
                const err = errors[m.id];
                return (
                  <tr key={m.id} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
                    <td className="px-5 py-3 text-xs text-slate-400">{i + 1}</td>
                    <td className="px-5 py-3 text-sm text-slate-800 font-medium">{m.name}</td>
                    <td className="px-5 py-3">
                      <div className="relative">
                        <input
                          step="0.0001"
                          value={values[m.id] ?? ""}
                          onChange={(e) => handleValueChange(m.id, e.target.value)}
                          placeholder="留空则跳过"
                          className={`w-36 px-3 py-2 border rounded-lg text-sm transition-all focus:outline-none focus:ring-2 placeholder:text-slate-300 ${
                            err
                              ? "border-red-300 focus:ring-red-500/30 focus:border-red-400 bg-red-50/30"
                              : "border-slate-200 focus:ring-blue-500/50 focus:border-blue-400"
                          }`}
                        />
                        {err && (
                          <p className="text-xs text-red-500 mt-0.5 absolute -bottom-4 left-0 whitespace-nowrap">{err}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-800">{m.unit}</td>
                  </tr>
                );
              })}
            </tbody>
          )}
        </table>
        <div className="px-5 py-2.5 border-t border-slate-100 text-xs text-slate-400">
          未填写的指标将跳过，不保存。有错误提示的指标修正后再提交。
        </div>
      </div>
    </div>
  );
}
