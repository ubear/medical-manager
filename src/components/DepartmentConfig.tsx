import { useEffect, useState } from "react";
import {
  getDepartments,
  addDepartment,
  updateDepartment,
  deleteDepartment,
} from "../lib/db";
import type { Department } from "../lib/types";
import { Plus, Trash2, Check, X, Pencil } from "lucide-react";

export default function DepartmentConfig() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

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

  async function handleDelete(id: number, name: string) {
    if (!confirm(`确定删除科室「${name}」？该科室的所有数据将被删除。`)) return;
    await deleteDepartment(id);
    await load();
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
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 transition-shadow"
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
                        onClick={() => handleDelete(d.id, d.name)}
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
    </div>
  );
}
