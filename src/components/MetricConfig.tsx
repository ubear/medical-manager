import { useEffect, useState } from "react";
import {
  getMetrics,
  getCategories,
  addCustomMetric,
  deleteCustomMetric,
  getMetricRecordSummary,
  addCategory,
  deleteCategory,
  updateMetric,
} from "../lib/db";
import type { MetricDefinition, MetricCategory } from "../lib/types";
import { Plus, Trash2, Lock, X, FolderPlus, Pencil } from "lucide-react";
import { log } from "../lib/logger";

export default function MetricConfig() {
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [categories, setCategories] = useState<MetricCategory[]>([]);
  const [activeCatId, setActiveCatId] = useState<number | null>(null);
  const [activeCatName, setActiveCatName] = useState("未分类");

  // Add metric form
  const [showMetricForm, setShowMetricForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");

  // Add category dialog
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [newCatName, setNewCatName] = useState("");

  async function load() {
    try {
      const [m, c] = await Promise.all([getMetrics(), getCategories()]);
      setMetrics(m);
      setCategories(c);
      if (c.length > 0 && activeCatId === null && activeCatName === "未分类") {
        setActiveCatId(c[0].id);
        setActiveCatName(c[0].name);
      }
    } catch (e) {
      log.error("MetricConfig", "加载失败", e);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredMetrics = activeCatId
    ? metrics.filter((m) => m.category_id === activeCatId)
    : metrics.filter((m) => m.category_id == null);

  const [addError, setAddError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<{
    metric: MetricDefinition;
    summary: { total: number; departments: { name: string; count: number }[] };
  } | null>(null);

  async function handleAddMetric() {
    if (!newName.trim()) return;
    setAddError("");
    try {
      await addCustomMetric(newName.trim(), newUnit.trim(), activeCatId);
      setNewName("");
      setNewUnit("");
      setShowMetricForm(false);
      await load();
    } catch {
      setAddError("指标名称已存在，请更换名称");
    }
  }
  async function handleDeleteClick(m: MetricDefinition) {
    try {
      const summary = await getMetricRecordSummary(m.id);
      setDeleteTarget({ metric: m, summary });
    } catch (e) {
      log.error("MetricConfig", "查询关联数据失败", e);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteCustomMetric(deleteTarget.metric.id);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      log.error("MetricConfig", "删除指标失败", e);
    }
  }

  function handleStartEdit(m: MetricDefinition) {
    setEditingId(m.id);
    setEditName(m.name);
    setEditUnit(m.unit);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditUnit("");
  }

  async function handleSaveEdit(id: number) {
    if (!editName.trim()) return;
    await updateMetric(id, editName.trim(), editUnit.trim());
    handleCancelEdit();
    await load();
  }

  async function handleAddCategory() {
    if (!newCatName.trim()) return;
    const cat = await addCategory(newCatName.trim());
    setNewCatName("");
    setShowCatForm(false);
    await load();
    if (cat) {
      setActiveCatId(cat.id);
      setActiveCatName(cat.name);
    }
  }

  async function handleDeleteCategory(id: number) {
    if (!confirm('删除分类后，其下指标将变为"未分类"，确定删除？')) return;
    await deleteCategory(id);
    if (activeCatId === id) {
      setActiveCatId(null);
      setActiveCatName("未分类");
    }
    await load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">指标配置</h2>
          <p className="text-sm text-slate-500 mt-1">按分类管理指标，支持自定义分类和指标</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCatForm(!showCatForm)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
          >
            <FolderPlus className="w-4 h-4" />
            新增分类
          </button>
          <button
            onClick={() => setShowMetricForm(!showMetricForm)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            新增指标
          </button>
        </div>
      </div>

      {/* Add category form */}
      {showCatForm && (
        <div className="mb-4 p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex items-end gap-3">
          <div className="flex-1 max-w-sm">
            <label className="block text-xs font-medium text-slate-600 mb-1">分类名称</label>
            <input
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
              placeholder="例如：护理质量指标"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button onClick={handleAddCategory} disabled={!newCatName.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40">
            添加
          </button>
          <button onClick={() => { setShowCatForm(false); setNewCatName(""); }} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">取消</button>
        </div>
      )}

      {/* Add metric form */}
      {showMetricForm && (
        <div className="mb-4 p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">指标名称</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddMetric()}
              placeholder="输入指标名称"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="w-28">
            <label className="block text-xs font-medium text-slate-600 mb-1">单位</label>
            <input
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              placeholder="例如：%"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button onClick={handleAddMetric} disabled={!newName.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40">
            添加
          </button>
          <button onClick={() => { setShowMetricForm(false); setNewName(""); setNewUnit(""); setAddError(""); }} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">取消</button>
          {addError && <p className="text-xs text-red-500 mt-2">{addError}</p>}
        </div>
      )}

      {/* Category tabs */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        <button
          onClick={() => { setActiveCatId(null); setActiveCatName("未分类"); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeCatId === null ? "bg-slate-800 text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
        >
          未分类
          {metrics.filter((m) => m.category_id == null).length > 0 && (
            <span className="ml-1 opacity-60">({metrics.filter((m) => m.category_id == null).length})</span>
          )}
        </button>
        {categories.map((cat) => {
          const count = metrics.filter((m) => m.category_id === cat.id).length;
          return (
            <div key={cat.id} className="flex items-center">
              <button
                onClick={() => { setActiveCatId(cat.id); setActiveCatName(cat.name); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeCatId === cat.id ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
              >
                {cat.name}
                {count > 0 && <span className="ml-1 opacity-60">({count})</span>}
              </button>
              {!cat.is_builtin && (
                <button
                  onClick={() => handleDeleteCategory(cat.id)}
                  className="ml-0.5 p-1 text-slate-300 hover:text-red-500 transition-colors rounded"
                  title="删除分类"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Metrics table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
          <span className="text-sm font-semibold text-slate-800">{activeCatName}</span>
          <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs">{filteredMetrics.length} 个指标</span>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase">指标名称</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase">单位</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase">类型</th>
              <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase w-20">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredMetrics.map((m, i) => (
              <tr key={m.id} className={`border-b border-slate-50 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-slate-50/30"} hover:bg-blue-50/30`}>
                {editingId === m.id ? (
                  <>
                    <td className="px-5 py-2.5">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" ? handleSaveEdit(m.id) : e.key === "Escape" ? handleCancelEdit() : undefined}
                        className="w-full px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        autoFocus
                      />
                    </td>
                    <td className="px-5 py-2.5">
                      <input
                        value={editUnit}
                        onChange={(e) => setEditUnit(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" ? handleSaveEdit(m.id) : e.key === "Escape" ? handleCancelEdit() : undefined}
                        className="w-full px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </td>
                    <td className="px-5 py-2.5 text-sm text-slate-400">编辑中</td>
                    <td className="px-5 py-2.5 text-right">
                      <button onClick={() => handleSaveEdit(m.id)} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 mr-1">保存</button>
                      <button onClick={handleCancelEdit} className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200">取消</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-5 py-2.5 text-sm text-slate-800 font-medium">{m.name}</td>
                    <td className="px-5 py-2.5 text-sm text-slate-600">{m.unit}</td>
                    <td className="px-5 py-2.5">
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
                    <td className="px-5 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => handleStartEdit(m)} className="p-1.5 hover:bg-blue-50 rounded transition-colors text-slate-400 hover:text-blue-600" title="编辑">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteClick(m)} className="p-1.5 hover:bg-red-50 rounded transition-colors text-slate-400 hover:text-red-500" title="删除">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {filteredMetrics.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-400">
                  此分类下暂无指标，点击"新增指标"添加
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[440px] max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-800">删除指标</h3>
            </div>
            <div className="px-6 py-4 space-y-3">
              <p className="text-sm text-slate-600">
                确定删除指标 <span className="font-semibold text-slate-800">「{deleteTarget.metric.name}」</span>？
              </p>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm text-slate-500 mb-2">
                  关联数据：共 <span className="font-semibold text-slate-700">{deleteTarget.summary.total}</span> 条记录
                </p>
                {deleteTarget.summary.departments.length > 0 && (
                  <ul className="space-y-1">
                    {deleteTarget.summary.departments.map((d) => (
                      <li key={d.name} className="text-sm text-slate-600 flex justify-between">
                        <span>{d.name}</span>
                        <span className="text-slate-400">{d.count} 条</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="text-sm text-red-500 font-medium">
                该指标及其所有关联数据将被永久删除，不可恢复！
              </p>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors font-medium"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
