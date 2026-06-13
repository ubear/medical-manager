import { useEffect, useState } from "react";
import {
  getDepartments,
  addDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentRecordSummary,
} from "../lib/db";
import type { Department } from "../lib/types";
import { Plus, Trash2, Check, X, Pencil } from "lucide-react";
import { log } from "../lib/logger";

export default function DepartmentConfig() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<{
    dept: Department;
    summary: { total: number; metrics: { name: string; count: number }[] };
  } | null>(null);

  async function load() {
    const d = await getDepartments();
    setDepartments(d);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd() {
    if (!newName.trim()) return;
    await addDepartment(newName.trim());
    setNewName("");
    await load();
  }

  function startEdit(d: Department) {
    setEditingId(d.id);
    setEditName(d.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  async function handleUpdate(id: number) {
    if (!editName.trim()) return;
    await updateDepartment(id, editName.trim());
    setEditingId(null);
    await load();
  }

  async function handleDeleteClick(d: Department) {
    try {
      const summary = await getDepartmentRecordSummary(d.id);
      setDeleteTarget({ dept: d, summary });
    } catch (e) {
      log.error("DepartmentConfig", "查询关联数据失败", e);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteDepartment(deleteTarget.dept.id);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      log.error("DepartmentConfig", "删除科室失败", e);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">科室管理</h2>
          <p className="text-sm text-slate-500 mt-1">管理系统中的临床科室</p>
        </div>
      </div>

      {/* Add form */}
      <div className="mb-6 p-4 bg-white border border-slate-200 rounded-xl flex items-end gap-3 shadow-sm">
        <div className="flex-1 max-w-sm">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            新增科室
          </label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="输入科室名称"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 transition-shadow"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={!newName.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm shadow-blue-600/10"
        >
          <Plus className="w-4 h-4" />
          添加
        </button>
      </div>

      {/* List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase">
                科室名称
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase">
                创建时间
              </th>
              <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase w-24">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {departments.map((d) => (
              <tr
                key={d.id}
                className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
              >
                <td className="px-5 py-3 text-sm text-slate-700">
                  {editingId === d.id ? (
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleUpdate(d.id);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="w-44 px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      autoFocus
                    />
                  ) : (
                    <span className="font-medium">{d.name}</span>
                  )}
                </td>
                <td className="px-5 py-3 text-sm text-slate-400">
                  {d.created_at.slice(0, 10)}
                </td>
                <td className="px-5 py-3 text-right">
                  {editingId === d.id ? (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleUpdate(d.id)}
                        className="p-1.5 hover:bg-emerald-50 rounded-lg transition-colors text-emerald-600"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => startEdit(d)}
                        className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(d)}
                        className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {departments.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-5 py-10 text-center text-sm text-slate-400"
                >
                  暂无科室，请添加
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
              <h3 className="text-lg font-semibold text-slate-800">删除科室</h3>
            </div>
            <div className="px-6 py-4 space-y-3">
              <p className="text-sm text-slate-600">
                确定删除科室 <span className="font-semibold text-slate-800">「{deleteTarget.dept.name}」</span>？
              </p>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm text-slate-500 mb-2">
                  关联数据：共 <span className="font-semibold text-slate-700">{deleteTarget.summary.total}</span> 条记录
                </p>
                {deleteTarget.summary.metrics.length > 0 && (
                  <ul className="space-y-1">
                    {deleteTarget.summary.metrics.map((m) => (
                      <li key={m.name} className="text-sm text-slate-600 flex justify-between">
                        <span>{m.name}</span>
                        <span className="text-slate-400">{m.count} 条</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="text-sm text-red-500 font-medium">
                该科室及其所有关联数据将被永久删除，不可恢复！
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
