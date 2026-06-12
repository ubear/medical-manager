import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import {
  PenLine, Table2, TrendingUp, Settings2, Stethoscope, Building2,
  ChevronDown, ListFilter, BarChart3, GitCompare, ScrollText,
  KeyRound, LogOut, AlertCircle, CheckCircle2, X,
} from "lucide-react";
import LogModal from "./LogModal";

interface Props {
  onLogout?: () => void;
}

const analysisChildren = [
  { to: "/analysis/detail", label: "数据明细", icon: Table2 },
  { to: "/analysis/summary", label: "汇总统计", icon: BarChart3 },
  { to: "/analysis/yoy", label: "同比分析", icon: GitCompare },
];

const navItems = [
  {
    to: "/entry",
    label: "数据录入",
    icon: PenLine,
    color: "blue",
    bg: "bg-blue-50",
    text: "text-blue-700",
    iconColor: "text-blue-600",
    dot: "bg-blue-600",
  },
  {
    to: "/analysis",
    label: "数据分析",
    icon: ListFilter,
    color: "emerald",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    iconColor: "text-emerald-600",
    dot: "bg-emerald-600",
    expandable: true,
    children: analysisChildren,
  },
  {
    to: "/chart",
    label: "趋势图",
    icon: TrendingUp,
    color: "violet",
    bg: "bg-violet-50",
    text: "text-violet-700",
    iconColor: "text-violet-600",
    dot: "bg-violet-600",
  },
  {
    to: "/departments",
    label: "科室管理",
    icon: Building2,
    color: "amber",
    bg: "bg-amber-50",
    text: "text-amber-700",
    iconColor: "text-amber-600",
    dot: "bg-amber-600",
  },
  {
    to: "/metrics",
    label: "指标配置",
    icon: Settings2,
    color: "teal",
    bg: "bg-teal-50",
    text: "text-teal-700",
    iconColor: "text-teal-600",
    dot: "bg-teal-600",
  },
];

export default function Layout({ onLogout }: Props) {
  const location = useLocation();
  const [logOpen, setLogOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdOk, setPwdOk] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "/analysis": true,
  });

  function toggleExpand(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function resetPwdForm() {
    setOldPwd("");
    setNewPwd("");
    setConfirmPwd("");
    setPwdError("");
    setPwdOk(false);
  }

  async function handleChangePwd() {
    setPwdError("");
    setPwdOk(false);
    if (!oldPwd || !newPwd) {
      setPwdError("请填写完整");
      return;
    }
    if (newPwd.length < 4) {
      setPwdError("新密码至少4位");
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError("两次密码输入不一致");
      return;
    }
    const username = localStorage.getItem("auth_username") || "";
    try {
      await invoke("change_password", { username, oldPassword: oldPwd, newPassword: newPwd });
      setPwdOk(true);
      setOldPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (e) {
      setPwdError(String(e));
    }
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">
      <aside className="w-64 bg-white/90 backdrop-blur border-r border-slate-200/60 flex flex-col shrink-0 shadow-sm">
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-200/60">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-md shadow-blue-500/20">
            <Stethoscope className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-slate-800 text-xl tracking-tight">
            医疗管理系统
          </span>
        </div>
        <nav className="flex-1 py-5 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const hasChildren = item.expandable && item.children;
            const childActive = hasChildren
              ? item.children!.some((c) => location.pathname === c.to)
              : false;
            const active = !hasChildren && location.pathname === item.to;
            const isExpanded = expanded[item.to];

            return (
              <div key={item.to}>
                {hasChildren ? (
                  <button
                    onClick={() => toggleExpand(item.to)}
                    className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-[15px] font-medium transition-all duration-200 ${
                      childActive
                        ? `${item.bg} ${item.text} shadow-sm`
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/70"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                        childActive
                          ? `${item.bg} ${item.iconColor}`
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      <item.icon className="w-4.5 h-4.5" />
                    </div>
                    {item.label}
                    <ChevronDown
                      className={`ml-auto w-4 h-4 transition-transform duration-200 ${
                        isExpanded ? "rotate-0" : "-rotate-90"
                      }`}
                    />
                    {childActive && (
                      <div className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
                    )}
                  </button>
                ) : (
                  <NavLink
                    to={item.to}
                    className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-[15px] font-medium transition-all duration-200 ${
                      active
                        ? `${item.bg} ${item.text} shadow-sm`
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/70"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                        active
                          ? `${item.bg} ${item.iconColor}`
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      <item.icon className="w-4.5 h-4.5" />
                    </div>
                    {item.label}
                    {active && (
                      <div className={`ml-auto w-1.5 h-1.5 rounded-full ${item.dot}`} />
                    )}
                  </NavLink>
                )}
                {hasChildren && isExpanded && (
                  <div className="ml-11 mt-0.5 space-y-0.5">
                    {item.children!.map((child) => {
                      const subActive = location.pathname === child.to;
                      return (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 ${
                            subActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <child.icon className="w-3.5 h-3.5 opacity-60" />
                          {child.label}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="mx-4 mb-4 space-y-1">
          <button
            onClick={() => { resetPwdForm(); setPwdOpen(true); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5" />
            修改密码
          </button>
          <button
            onClick={() => onLogout?.()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            锁定
          </button>
          <button
            onClick={() => setLogOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <ScrollText className="w-3.5 h-3.5" />
            运行日志
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Password dialog */}
      {pwdOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setPwdOpen(false); resetPwdForm(); }}>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-800">修改密码</h3>
              <button onClick={() => { setPwdOpen(false); resetPwdForm(); }} className="p-1 hover:bg-slate-100 rounded transition-colors text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <input type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} placeholder="原密码" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="新密码" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} placeholder="确认新密码" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {pwdError && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-2 py-1.5 rounded">
                <AlertCircle className="w-3.5 h-3.5" /> {pwdError}
              </div>
            )}
            {pwdOk && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2 py-1.5 rounded">
                <CheckCircle2 className="w-3.5 h-3.5" /> 密码修改成功
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button onClick={() => { setPwdOpen(false); resetPwdForm(); }} className="flex-1 px-3 py-2 text-sm text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">取消</button>
              <button onClick={handleChangePwd} className="flex-1 px-3 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">确认修改</button>
            </div>
          </div>
        </div>
      )}

      <LogModal open={logOpen} onClose={() => setLogOpen(false)} />
    </div>
  );
}
