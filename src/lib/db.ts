import Database from "@tauri-apps/plugin-sql";
import type { MetricDefinition, RecordRow, Department } from "./types";

const DB_PATH = "sqlite:medical.db";

let db: Database | null = null;
let dbPromise: Promise<Database> | null = null;
let writeLock: Promise<void> | null = null;

async function getDb(): Promise<Database> {
  if (db) return db;
  if (dbPromise) return dbPromise;
  dbPromise = Database.load(DB_PATH).then((d) => {
    db = d;
    return d;
  });
  return dbPromise;
}

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = writeLock ?? Promise.resolve();
  let release: () => void;
  writeLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  return prev.then(fn).finally(() => release!());
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
  await withLock(async () => {
    const d = await getDb();
    await d.execute(
      "INSERT INTO metric_definitions (name, unit, is_builtin) VALUES ($1, $2, 0)",
      [name, unit],
    );
  });
}

export async function deleteCustomMetric(id: number): Promise<void> {
  await withLock(async () => {
    const d = await getDb();
    await d.execute("DELETE FROM metric_definitions WHERE id = $1 AND is_builtin = 0", [
      id,
    ]);
    await d.execute("DELETE FROM records WHERE metric_id = $1", [id]);
  });
}

export async function saveRecords(
  records: { date: string; department: string; metric_id: number; value: number | null }[],
): Promise<void> {
  await withLock(async () => {
    const d = await getDb();
    for (const r of records) {
      if (r.value === null || r.value === undefined) continue;
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
  });
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

export async function importFromCsv(
  rows: { date: string; department: string; metric_name: string; value: number }[],
): Promise<void> {
  await withLock(async () => {
    const d = await getDb();
    for (const row of rows) {
      const metrics = await d.select<{ id: number }[]>(
        "SELECT id FROM metric_definitions WHERE name = $1",
        [row.metric_name],
      );
      if (metrics.length === 0) continue;
      const existing = await d.select<{ id: number }[]>(
        "SELECT id FROM records WHERE date = $1 AND department = $2 AND metric_id = $3",
        [row.date, row.department, metrics[0].id],
      );
      if (existing.length > 0) {
        await d.execute(
          "UPDATE records SET value = $1 WHERE id = $2",
          [row.value, existing[0].id],
        );
      } else {
        await d.execute(
          "INSERT INTO records (date, department, metric_id, value) VALUES ($1, $2, $3, $4)",
          [row.date, row.department, metrics[0].id, row.value],
        );
      }
    }
  });
}

export async function seedMockData(): Promise<void> {
  await seedBuiltinMetrics();
  const d = await getDb();
  const count = await d.select<{ count: number }[]>(
    "SELECT COUNT(*) as count FROM records",
  );
  if (count[0].count > 0) return;

  const departments = ["心内科", "骨科", "普外科"];
  const days = 30;
  const now = new Date();

  // Batch all inserts in a single write
  for (const dept of departments) {
    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const ds = date.toISOString().slice(0, 10);

      const base = dept === "心内科" ? 80 : dept === "骨科" ? 60 : 45;
      const noise = () => Math.round((Math.random() - 0.5) * 20);

      const values: Record<string, number | null> = {
        "手术量": base + noise(),
        "手术占比": 75 + Math.round((Math.random() - 0.5) * 15),
        "四级手术占比": 25 + Math.round(Math.random() * 20),
        "微创手术占比": 40 + Math.round(Math.random() * 25),
        "并发症发生率": +(Math.random() * 3 + 1).toFixed(1),
        "平均住院日": +(Math.random() * 3 + 5).toFixed(1),
        "病床周转次数": +(Math.random() * 2 + 2.5).toFixed(1),
        "病历返修率": +(Math.random() * 8 + 3).toFixed(1),
      };

      for (const [name, val] of Object.entries(values)) {
        if (val === null) continue;
        const metrics = await d.select<{ id: number }[]>(
          "SELECT id FROM metric_definitions WHERE name = $1",
          [name],
        );
        if (metrics.length === 0) continue;
        await d.execute(
          "INSERT INTO records (date, department, metric_id, value) VALUES ($1, $2, $3, $4)",
          [ds, dept, metrics[0].id, val],
        );
      }
    }
  }
}

// ── Department CRUD ──

export async function seedMockDepartments(): Promise<void> {
  const d = await getDb();
  const count = await d.select<{ count: number }[]>(
    "SELECT COUNT(*) as count FROM departments",
  );
  if (count[0].count > 0) return;
  const depts = ["心内科", "骨科", "普外科"];
  for (const name of depts) {
    await d.execute("INSERT INTO departments (name) VALUES ($1)", [name]);
  }
}

export async function getDepartments(): Promise<Department[]> {
  const d = await getDb();
  return await d.select<Department[]>(
    "SELECT * FROM departments ORDER BY id ASC",
  );
}

export async function addDepartment(name: string): Promise<Department | null> {
  const d = await getDb();
  const existing = await d.select<Department[]>(
    "SELECT * FROM departments WHERE name = $1",
    [name],
  );
  if (existing.length > 0) return existing[0];
  await d.execute("INSERT INTO departments (name) VALUES ($1)", [name]);
  const rows = await d.select<Department[]>(
    "SELECT * FROM departments WHERE name = $1",
    [name],
  );
  return rows[0] ?? null;
}

export async function updateDepartment(
  id: number,
  name: string,
): Promise<void> {
  const d = await getDb();
  await d.execute("UPDATE departments SET name = $1 WHERE id = $2", [name, id]);
  await d.execute("UPDATE records SET department = $1 WHERE department = (SELECT name FROM departments WHERE id = $2)", [name, id]);
}

export async function deleteDepartment(id: number): Promise<void> {
  const d = await getDb();
  const rows = await d.select<{ name: string }[]>(
    "SELECT name FROM departments WHERE id = $1",
    [id],
  );
  if (rows.length === 0) return;
  await d.execute("DELETE FROM records WHERE department = $1", [rows[0].name]);
  await d.execute("DELETE FROM departments WHERE id = $1", [id]);
}

export async function ensureDepartment(name: string): Promise<void> {
  const d = await getDb();
  await d.execute("INSERT OR IGNORE INTO departments (name) VALUES ($1)", [
    name,
  ]);
}

// ── XLSX import ──

export async function importFromXlsx(
  rows: Record<string, string | number>[],
): Promise<{ imported: number; newDepts: string[] }> {
  const newDepts: string[] = [];
  const d = await getDb();

  // Get metric map
  const metrics = await d.select<{ id: number; name: string }[]>(
    "SELECT id, name FROM metric_definitions",
  );
  const metricMap = new Map(metrics.map((m) => [m.name, m.id]));

  let imported = 0;
  await withLock(async () => {
    for (const row of rows) {
      const dept = String(row.department || "").trim();
      if (!dept || !row.date) continue;

      // Auto-add unknown department
      const existingDept = await d.select<{ name: string }[]>(
        "SELECT name FROM departments WHERE name = $1",
        [dept],
      );
      if (existingDept.length === 0) {
        await d.execute("INSERT INTO departments (name) VALUES ($1)", [dept]);
        newDepts.push(dept);
      }

      for (const [colName, val] of Object.entries(row)) {
        if (colName === "date" || colName === "department") continue;
        const metricId = metricMap.get(colName);
        if (!metricId) continue;
        const numVal = Number(val);
        if (isNaN(numVal)) continue;

        const existing = await d.select<{ id: number }[]>(
          "SELECT id FROM records WHERE date = $1 AND department = $2 AND metric_id = $3",
          [String(row.date), dept, metricId],
        );
        if (existing.length > 0) {
          await d.execute("UPDATE records SET value = $1 WHERE id = $2", [
            numVal,
            existing[0].id,
          ]);
        } else {
          await d.execute(
            "INSERT INTO records (date, department, metric_id, value) VALUES ($1, $2, $3, $4)",
            [String(row.date), dept, metricId, numVal],
          );
        }
        imported++;
      }
    }
  });

  return { imported, newDepts };
}
