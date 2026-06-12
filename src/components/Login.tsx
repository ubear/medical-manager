import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Shield, KeyRound, UserPlus, LogIn, AlertCircle } from "lucide-react";

interface Props {
  onLogin: () => void;
}

export default function Login({ onLogin }: Props) {
  const [mode, setMode] = useState<"loading" | "register" | "login">("loading");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const hasUsers = await invoke<boolean>("check_users_exists");
        setMode(hasUsers ? "login" : "register");
      } catch {
        setMode("login");
      }
    })();
  }, []);

  async function handleRegister() {
    setError("");
    if (!username.trim() || !password) {
      setError("请填写用户名和密码");
      return;
    }
    if (password.length < 4) {
      setError("密码至少4位");
      return;
    }
    if (password !== confirmPwd) {
      setError("两次密码输入不一致");
      return;
    }
    try {
      await invoke("register", { username: username.trim(), password });
      localStorage.setItem("auth_username", username.trim());
      onLogin();
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleLogin() {
    setError("");
    if (!username.trim() || !password) {
      setError("请填写用户名和密码");
      return;
    }
    try {
      const ok = await invoke<boolean>("login", { username: username.trim(), password });
      if (ok) {
        localStorage.setItem("auth_username", username.trim());
        onLogin();
      } else {
        setError("用户名或密码错误");
      }
    } catch (e) {
      setError(String(e));
    }
  }

  if (mode === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">
        <div className="animate-pulse text-slate-400 text-sm">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">医疗指标管理系统</h1>
          <p className="text-sm text-slate-500 mt-1">
            {mode === "register" ? "首次使用，请创建管理员账号" : "请输入账号密码登录"}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">用户名</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (mode === "register" ? handleRegister() : handleLogin())}
                placeholder="输入用户名"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (mode === "register" ? handleRegister() : handleLogin())}
                placeholder="输入密码"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition-all"
              />
            </div>
            {mode === "register" && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">确认密码</label>
                <input
                  type="password"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                  placeholder="再次输入密码"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition-all"
                />
              </div>
            )}
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            onClick={mode === "register" ? handleRegister : handleLogin}
            className="mt-5 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            {mode === "register" ? (
              <>
                <UserPlus className="w-4 h-4" /> 创建账号
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" /> 登录
              </>
            )}
          </button>

          {mode === "login" && (
            <p className="mt-4 text-center text-xs text-slate-400">
              <KeyRound className="w-3 h-3 inline mr-1" />
              本地存储，数据不会上传
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
