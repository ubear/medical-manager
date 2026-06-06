import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import DataEntry from "./components/DataEntry";
import DataAnalysis from "./components/DataAnalysis";
import TrendChart from "./components/TrendChart";
import MetricConfig from "./components/MetricConfig";
import DepartmentConfig from "./components/DepartmentConfig";
import { seedMockData, seedMockDepartments } from "./lib/db";

function App() {
  useEffect(() => {
    seedMockData();
    seedMockDepartments();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/entry" replace />} />
          <Route path="entry" element={<DataEntry />} />
          <Route path="analysis" element={<DataAnalysis />} />
          <Route path="chart" element={<TrendChart />} />
          <Route path="metrics" element={<MetricConfig />} />
          <Route path="departments" element={<DepartmentConfig />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
