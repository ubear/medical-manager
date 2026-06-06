export interface MetricDefinition {
  id: number;
  name: string;
  unit: string;
  is_builtin: number;
  created_at: string;
}

export interface Record {
  id: number;
  date: string;
  department: string;
  metric_id: number;
  value: number | null;
  created_at: string;
}

export interface RecordRow {
  id: number;
  date: string;
  department: string;
  metric_id: number;
  metric_name: string;
  metric_unit: string;
  value: number | null;
}

export type ChartDataPoint = {
  date: string;
  [metricKey: string]: string | number | null;
};
