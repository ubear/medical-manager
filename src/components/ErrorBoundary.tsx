import { Component, type ReactNode } from "react";
import { log } from "../lib/logger";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: "" };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, error: err.message };
  }

  componentDidCatch(err: Error, info: React.ErrorInfo) {
    log.error("React", err.message + "\n" + (info.componentStack ?? ""));
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-slate-50">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">
              页面出现错误
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              请尝试刷新页面。如问题持续，请查看错误日志并提供给技术支持。
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: "" });
                window.location.reload();
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              <RotateCcw className="w-4 h-4" />
              刷新页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
