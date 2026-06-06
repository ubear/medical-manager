import Database from "@tauri-apps/plugin-sql";
import type { MetricDefinition, RecordRow } from "./types";

const DB_PATH = "sqlite:medical.db";

let db: Database | null = null;

async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load(DB_PATH);
  }
  return db;
}

const BUILTIN_METRICS: { name: string; unit: string }[] = [
  { name: "手术量", unit: "台" },
  { name: "手术占比", unit: "%" },
  { name: "四级手术占比", unit: "%" },
  { name: "微创手术占比", unit: "%" },
  { name: "并发症发生率", unit: "%" },
  { name: "平均住院日", unit: "天" },
  { name: "病床周转次数", unit: "次" },
  { name: "病历返修率", unit: "%" },
];

export async function seedBuiltinMetrics(): Promise<void> {
  const d = await getDb();
  for (const m of BUILTIN_METRICS) {
    await d.execute(
      "INSERT OR IGNORE INTO metric_definitions (name, unit, is_builtin) VALUES ($1, $2, 1)",
      [m.name, m.unit],
    );
  }
}

export async function getMetrics(): Promise<MetricDefinition[]> {
  const d = await getDb();
  return await d.select<MetricDefinition[]>(
    "SELECT * FROM metric_definitions ORDER BY is_builtin DESC, id ASC",
  );
}

export async function addCustomMetric(
  name: string,
  unit: string,
): Promise<void> {
  const d = await getDb();
  await d.execute(
    "INSERT INTO metric_definitions (name, unit, is_builtin) VALUES ($1, $2, 0)",
    [name, unit],
  );
}

export async function deleteCustomMetric(id: number): Promise<void> {
  const d = await getDb();
  await d.execute("DELETE FROM metric_definitions WHERE id = $1 AND is_builtin = 0", [
    id,
  ]);
  await d.execute("DELETE FROM records WHERE metric_id = $1", [id]);
}

export async function saveRecords(
  records: { date: string; department: string; metric_id: number; value: number | null }[],
): Promise<void> {
  const d = await getDb();
  for (const r of records) {
    if (r.value === null || r.value === undefined) continue;
    // Upsert: update existing or insert new
    const existing = await d.select<{ id: number }[]>(
      "SELECT id FROM records WHERE date = $1 AND department = $2 AND metric_id = $3",
      [r.date, r.department, r.metric_id],
    );
    if (existing.length > 0) {
      await d.execute(
        "UPDATE records SET value = $1 WHERE id = $2",
        [r.value, existing[0].id],
      );
    } else {
      await d.execute(
        "INSERT INTO records (date, department, metric_id, value) VALUES ($1, $2, $3, $4)",
        [r.date, r.department, r.metric_id, r.value],
      );
    }
  }
}

export async function queryRecords(params: {
  dateFrom?: string;
  dateTo?: string;
  departments?: string[];
  metricIds?: number[];
}): Promise<RecordRow[]> {
  const d = await getDb();
  const conditions: string[] = [];
  const bindings: (string | number)[] = [];

  if (params.dateFrom) {
    conditions.push("r.date >= $1");
    bindings.push(params.dateFrom);
  }
  if (params.dateTo) {
    conditions.push(`r.date <= $${bindings.length + 1}`);
    bindings.push(params.dateTo);
  }
  if (params.departments && params.departments.length > 0) {
    const placeholders = params.departments
      .map((_, i) => `$${bindings.length + i + 1}`)
      .join(", ");
    conditions.push(`r.department IN (${placeholders})`);
    bindings.push(...params.departments);
  }
  if (params.metricIds && params.metricIds.length > 0) {
    const placeholders = params.metricIds
      .map((_, i) => `$${bindings.length + i + 1}`)
      .join(", ");
    conditions.push(`r.metric_id IN (${placeholders})`);
    bindings.push(...params.metricIds);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT r.*, m.name as metric_name, m.unit as metric_unit
    FROM records r
    JOIN metric_definitions m ON r.metric_id = m.id
    ${where}
    ORDER BY r.date DESC, r.department, m.id
  `;
  return await d.select<RecordRow[]>(sql, bindings);
}

export async function getDepartments(): Promise<string[]> {
  const d = await getDb();
  const rows = await d.select<{ department: string }[]>(
    "SELECT DISTINCT department FROM records ORDER BY department",
  );
  return rows.map((r) => r.department);
}

export async function importFromCsv(
  rows: { date: string; department: string; metric_name: string; value: number }[],
): Promise<void> {
  const d = await getDb();
  for (const row of rows) {
    const metrics = await d.select<{ id: number }[]>(
      "SELECT id FROM metric_definitions WHERE name = $1",
      [row.metric_name],
    );
    if (metrics.length === 0) continue;
    await saveRecords([
      {
        date: row.date,
        department: row.department,
        metric_id: metrics[0].id,
        value: row.value,
      },
    ]);
  }
}
