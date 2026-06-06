import { useState, useRef, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import { zhCN } from "date-fns/locale/zh-CN";
import { Calendar } from "lucide-react";
import "react-day-picker/style.css";

interface Props {
  label?: string;
  value: Date | undefined;
  onChange: (date: Date) => void;
  placeholder?: string;
}

export default function DatePicker({ label, value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
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

  const display = value
    ? value.toISOString().slice(0, 10)
    : placeholder ?? "选择日期";

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
        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 hover:border-blue-300 transition-all shadow-sm min-w-[150px]"
      >
        <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
        <span className={value ? "text-slate-700" : "text-slate-400"}>
          {display}
        </span>
      </button>
      {open && (
        <div className="absolute top-full mt-2 z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-2">
          <DayPicker
            mode="single"
            selected={value}
            onSelect={(d) => {
              if (d) onChange(d);
              setOpen(false);
            }}
            locale={zhCN}
            footer={
              <button
                type="button"
                onClick={() => {
                  onChange(new Date());
                  setOpen(false);
                }}
                className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                回到今天
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}
