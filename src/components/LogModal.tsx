import { useEffect, useState } from "react";
import { log } from "../lib/logger";
import { X, Copy, Trash2, Check } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function LogModal({ open, onClose }: Props) {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) setText(log.export());
  }, [open]);

  if (!open) return null;

  function handleCopy() {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClear() {
    log.clear();
    setText("");
  }

  const lines = text.split("\n").filter(Boolean);
  const errorCount = lines.filter((l) => l.includes("ERROR")).length;
  const warnCount = lines.filter((l) => l.includes("WARN")).length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[640px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-slate-800">运行日志</h3>
            <div className="flex gap-2 text-xs">
              {errorCount > 0 && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
                  {errorCount} 错误
                </span>
              )}
              {warnCount > 0 && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
                  {warnCount} 警告
                </span>
              )}
              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                {lines.length} 条
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" /> 已复制
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> 复制全部
                </>
              )}
            </button>
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              清空
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed">
          {text ? (
            <pre className="whitespace-pre-wrap break-all">
              {lines.map((line, i) => {
                const isError = line.includes("ERROR");
                const isWarn = line.includes("WARN");
                return (
                  <div
                    key={i}
                    className={`px-2 py-0.5 rounded ${
                      isError
                        ? "bg-red-50 text-red-700"
                        : isWarn
                          ? "bg-amber-50 text-amber-700"
                          : "text-slate-600"
                    }`}
                  >
                    {line}
                  </div>
                );
              })}
            </pre>
          ) : (
            <div className="text-center text-slate-400 py-12">暂无日志</div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-6 py-3 border-t border-slate-100 text-xs text-slate-400">
          日志仅保存在本次运行内存中，关闭程序后自动清除。出现问题时复制全部日志发送给技术人员。
        </div>
      </div>
    </div>
  );
}
