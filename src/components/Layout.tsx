import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  PenLine,
  Table2,
  TrendingUp,
  Settings2,
  Stethoscope,
} from "lucide-react";

const navItems = [
  { to: "/entry", label: "数据录入", icon: PenLine },
  { to: "/analysis", label: "数据分析", icon: Table2 },
  { to: "/chart", label: "趋势图", icon: TrendingUp },
  { to: "/metrics", label: "指标配置", icon: Settings2 },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-56 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="h-14 flex items-center gap-2 px-5 border-b border-slate-200">
          <Stethoscope className="w-5 h-5 text-blue-600" />
          <span className="font-semibold text-slate-800 text-sm">
            医疗指标管理
          </span>
        </div>
        <nav className="flex-1 py-3">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-5 py-2.5 mx-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
