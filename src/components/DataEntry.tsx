import { useEffect, useState } from "react";
import { getMetrics, saveRecords } from "../lib/db";
import type { MetricDefinition } from "../lib/types";
import { Save, Check, Upload } from "lucide-react";
import { importFromCsv } from "../lib/db";

export default function DataEntry() {
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [date, setDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [department, setDepartment] = useState("");
  const [values, setValues] = useState<Record<number, string>>({});
  const [saved, setSaved] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const m = await getMetrics();
      setMetrics(m);
    })();
  }, []);

  function handleValueChange(metricId: number, val: string) {
    setValues((prev) => ({ ...prev, [metricId]: val }));
    setSaved(false);
  }

  async function handleSubmit() {
    if (!date || !department.trim()) return;
    const records = metrics.map((m) => ({
      date,
      department: department.trim(),
      metric_id: m.id,
      value: values[m.id] !== undefined && values[m.id] !== ""
        ? parseFloat(values[m.id])
        : null,
    }));
    await saveRecords(records);
    if (!departments.includes(department.trim())) {
      setDepartments((prev) => [...prev, department.trim()]);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.trim().split("\n");
    if (lines.length < 2) return;
    const headers = lines[0].split(",").map((h) => h.trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim());
      if (cols.length < headers.length) continue;
      const row: Record<string, string> = {};
      headers.forEach((h, j) => {
        row[h] = cols[j];
      });
      for (let j = 2; j < headers.length; j++) {
        const val = parseFloat(cols[j]);
        if (!isNaN(val)) {
          rows.push({
            date: cols[0],
            department: cols[1],
            metric_name: headers[j],
            value: val,
          });
        }
      }
    }
    if (rows.length > 0) {
      await importFromCsv(rows);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    e.target.value = "";
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">数据录入</h2>
          <p className="text-sm text-slate-500 mt-1">
            选择日期和科室，填入指标数值
          </p>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!date || !department.trim()}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            saved
              ? "bg-emerald-600 text-white"
              : "bg-blue-600 text-white hover:bg-blue-700"
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

      <div className="flex gap-4 mb-6">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            日期
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setSaved(false);
            }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex-1 max-w-xs">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            科室
          </label>
          <input
            type="text"
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              setSaved(false);
            }}
            placeholder="输入科室名称"
            list="dept-list"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <datalist id="dept-list">
            {departments.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase w-12">
                #
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase">
                指标名称
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase">
                数值
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase">
                单位
              </th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m, i) => (
              <tr
                key={m.id}
                className="border-b border-slate-50 hover:bg-slate-50/50"
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
                    className="w-32 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>
                <td className="px-5 py-3 text-sm text-slate-400">{m.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 p-4 bg-white border border-slate-200 rounded-xl">
        <div className="flex items-center gap-3">
          <Upload className="w-4 h-4 text-slate-400" />
          <div>
            <p className="text-sm font-medium text-slate-700">CSV 批量导入</p>
            <p className="text-xs text-slate-400 mt-0.5">
              格式：日期, 科室, 指标名1, 指标名2... (第一行为表头)
            </p>
          </div>
          <label className="ml-auto px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-sm cursor-pointer hover:bg-slate-200 transition-colors">
            选择文件
            <input
              type="file"
              accept=".csv"
              onChange={handleCsvImport}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
