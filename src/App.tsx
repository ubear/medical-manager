import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import DataEntry from "./components/DataEntry";
import DataDetail from "./components/DataDetail";
import DataSummary from "./components/DataSummary";
import YoYAnalysis from "./components/YoYAnalysis";
import TrendChart from "./components/TrendChart";
import MetricConfig from "./components/MetricConfig";
import DepartmentConfig from "./components/DepartmentConfig";
import ErrorBoundary from "./components/ErrorBoundary";
import Login from "./components/Login";
import { seedMockData, seedMockDepartments } from "./lib/db";
import { log } from "./lib/logger";

function App() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (!authed) return;
    seedMockData().catch((e) => log.error("App", "seedMockData 失败", e));
    seedMockDepartments().catch((e) =>
      log.error("App", "seedMockDepartments 失败", e),
    );
  }, [authed]);

  if (!authed) {
    return <Login onLogin={() => setAuthed(true)} />;
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout onLogout={() => setAuthed(false)} />}>
            <Route index element={<Navigate to="/entry" replace />} />
            <Route path="entry" element={<DataEntry />} />
            <Route path="analysis" element={<Navigate to="/analysis/detail" replace />} />
            <Route path="analysis/detail" element={<DataDetail />} />
            <Route path="analysis/summary" element={<DataSummary />} />
            <Route path="analysis/yoy" element={<YoYAnalysis />} />
            <Route path="chart" element={<TrendChart />} />
            <Route path="metrics" element={<MetricConfig />} />
            <Route path="departments" element={<DepartmentConfig />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
