import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];

interface Props {
  label?: string;
  value: Date | undefined;
  onChange: (date: Date) => void;
  placeholder?: string;
}

export function formatMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function firstOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export default function MonthPicker({ label, value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() =>
    value ? value.getFullYear() : new Date().getFullYear(),
  );
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (value) setViewYear(value.getFullYear());
  }, [value]);

  const display = value ? formatMonth(value) : placeholder ?? "选择月份";

  function handleMonthClick(month: number) {
    onChange(new Date(viewYear, month, 1));
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      {label && (
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 hover:border-blue-300 transition-all shadow-sm min-w-[140px]"
      >
        <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
        <span className={value ? "text-slate-700" : "text-slate-400"}>
          {display}
        </span>
      </button>
      {open && (
        <div className="absolute top-full mt-2 z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-3 w-[260px]">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setViewYear((y) => y - 1)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-500 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-slate-800">{viewYear}年</span>
            <button
              type="button"
              onClick={() => setViewYear((y) => y + 1)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-500 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {MONTHS.map((label, i) => {
              const selected =
                value &&
                value.getFullYear() === viewYear &&
                value.getMonth() === i;
              const isNow =
                new Date().getFullYear() === viewYear &&
                new Date().getMonth() === i;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleMonthClick(i)}
                  className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                    selected
                      ? "bg-blue-600 text-white shadow-sm"
                      : isNow
                        ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                        : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              onChange(firstOfMonth(new Date()));
              setOpen(false);
            }}
            className="mt-2 w-full text-xs text-blue-600 hover:text-blue-700 font-medium text-center py-1"
          >
            回到本月
          </button>
        </div>
      )}
    </div>
  );
}
