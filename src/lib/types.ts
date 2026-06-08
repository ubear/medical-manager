export interface MetricCategory {
  id: number;
  name: string;
  is_builtin: number;
  sort_order: number;
  created_at: string;
}

export interface MetricDefinition {
  id: number;
  name: string;
  unit: string;
  is_builtin: number;
  category_id: number | null;
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

export interface Department {
  id: number;
  name: string;
  created_at: string;
}
