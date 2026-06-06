import { useEffect, useState } from "react";
import {
  getMetrics,
  addCustomMetric,
  deleteCustomMetric,
  seedBuiltinMetrics,
} from "../lib/db";
import type { MetricDefinition } from "../lib/types";
import { Plus, Trash2, Lock } from "lucide-react";

export default function MetricConfig() {
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function load() {
    await seedBuiltinMetrics();
    const m = await getMetrics();
    setMetrics(m);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd() {
    if (!newName.trim()) return;
    await addCustomMetric(newName.trim(), newUnit.trim());
    setNewName("");
    setNewUnit("");
    setShowForm(false);
    await load();
  }

  async function handleDelete(id: number) {
    await deleteCustomMetric(id);
    await load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">指标配置</h2>
          <p className="text-sm text-slate-500 mt-1">管理内置和自定义指标</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新增指标
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-4 bg-white border border-slate-200 rounded-xl flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              指标名称
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="例如：住院患者满意度"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="w-28">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              单位
            </label>
            <input
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              placeholder="例如：%"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            添加
          </button>
          <button
            onClick={() => setShowForm(false)}
            className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
          >
            取消
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase">
                指标名称
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase">
                单位
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase">
                类型
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr
                key={m.id}
                className="border-b border-slate-50 hover:bg-slate-50/50"
              >
                <td className="px-5 py-3 text-sm text-slate-700">{m.name}</td>
                <td className="px-5 py-3 text-sm text-slate-500">{m.unit}</td>
                <td className="px-5 py-3">
                  {m.is_builtin ? (
                    <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                      <Lock className="w-3 h-3" /> 内置
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      自定义
                    </span>
                  )}
                </td>
                <td className="px-5 py-3">
                  {!m.is_builtin && (
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
