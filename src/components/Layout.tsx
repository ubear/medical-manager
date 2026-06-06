import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  PenLine,
  Table2,
  TrendingUp,
  Settings2,
  Stethoscope,
  Building2,
} from "lucide-react";

const navItems = [
  { to: "/entry", label: "数据录入", icon: PenLine },
  { to: "/analysis", label: "数据分析", icon: Table2 },
  { to: "/chart", label: "趋势图", icon: TrendingUp },
  { to: "/departments", label: "科室管理", icon: Building2 },
  { to: "/metrics", label: "指标配置", icon: Settings2 },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <aside className="w-60 bg-white/80 backdrop-blur border-r border-slate-200/60 flex flex-col shrink-0 shadow-sm">
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-200/60">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-md shadow-blue-500/20">
            <Stethoscope className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-slate-800 text-[15px] tracking-tight">
            医疗指标管理
          </span>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  active
                    ? "bg-blue-50 text-blue-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/70"
                }`}
              >
                <item.icon className={`w-4 h-4 ${active ? "text-blue-600" : ""}`} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="px-4 py-3 border-t border-slate-200/60 text-xs text-slate-400">
          数据存储于本地 SQLite
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
