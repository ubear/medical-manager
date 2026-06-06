import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  PenLine,
  Table2,
  TrendingUp,
  Settings2,
  Stethoscope,
  Building2,
  ScrollText,
} from "lucide-react";
import LogModal from "./LogModal";

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
    icon: Table2,
    color: "emerald",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    iconColor: "text-emerald-600",
    dot: "bg-emerald-600",
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

export default function Layout() {
  const location = useLocation();
  const [logOpen, setLogOpen] = useState(false);

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
        <nav className="flex-1 py-5 px-4 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
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
                      : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
                  }`}
                >
                  <item.icon className="w-4.5 h-4.5" />
                </div>
                {item.label}
                {active && (
                  <div className={`ml-auto w-1.5 h-1.5 rounded-full ${item.dot}`} />
                )}
              </NavLink>
            );
          })}
        </nav>
        <button
          onClick={() => setLogOpen(true)}
          className="mx-4 mb-4 flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-colors"
        >
          <ScrollText className="w-3.5 h-3.5" />
          运行日志
        </button>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
      <LogModal open={logOpen} onClose={() => setLogOpen(false)} />
    </div>
  );
}
