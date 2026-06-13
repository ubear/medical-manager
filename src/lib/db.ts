import Database from "@tauri-apps/plugin-sql";
import type { MetricDefinition, MetricCategory, RecordRow, Department } from "./types";
import { log } from "./logger";

const DB_PATH = "sqlite:medical.db";

async function safeOp<T>(op: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    log.error("DB", `${op} 失败`, e);
    return fallback;
  }
}

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

// ═══════════════════════════════════════════════
// Categories
// ═══════════════════════════════════════════════

export async function getCategories(): Promise<MetricCategory[]> {
  return safeOp("getCategories", async () => {
    const d = await getDb();
    return await d.select<MetricCategory[]>(
      "SELECT * FROM metric_categories ORDER BY sort_order ASC, id ASC",
    );
  }, []);
}

export async function addCategory(name: string): Promise<MetricCategory | null> {
  let result: MetricCategory | null = null;
  await withLock(async () => {
    const d = await getDb();
    const maxOrder = await d.select<{ m: number }[]>(
      "SELECT COALESCE(MAX(sort_order), -1) as m FROM metric_categories",
    );
    const nextOrder = maxOrder[0].m + 1;
    await d.execute(
      "INSERT INTO metric_categories (name, is_builtin, sort_order) VALUES ($1, 0, $2)",
      [name, nextOrder],
    );
    const rows = await d.select<MetricCategory[]>(
      "SELECT * FROM metric_categories WHERE name = $1",
      [name],
    );
    result = rows[0] ?? null;
  });
  return result;
}

export async function deleteCategory(id: number): Promise<void> {
  await withLock(async () => {
    const d = await getDb();
    await d.execute("UPDATE metric_definitions SET category_id = NULL WHERE category_id = $1", [id]);
    await d.execute("DELETE FROM metric_categories WHERE id = $1 AND is_builtin = 0", [id]);
  });
}

// ═══════════════════════════════════════════════
// Metrics
// ═══════════════════════════════════════════════

export async function getMetrics(): Promise<MetricDefinition[]> {
  return safeOp("getMetrics", async () => {
    const d = await getDb();
    return await d.select<MetricDefinition[]>(
      "SELECT * FROM metric_definitions ORDER BY is_builtin DESC, id ASC",
    );
  }, []);
}

export async function getMetricsByCategory(): Promise<
  { category: MetricCategory | null; metrics: MetricDefinition[] }[]
> {
  const cats = await getCategories();
  const allMetrics = await getMetrics();
  const map = new Map<number | null, MetricDefinition[]>();

  for (const m of allMetrics) {
    const key = m.category_id;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }

  const result: { category: MetricCategory | null; metrics: MetricDefinition[] }[] = [];
  for (const cat of cats) {
    result.push({ category: cat, metrics: map.get(cat.id) ?? [] });
    map.delete(cat.id);
  }
  // Uncategorized
  if (map.has(null) || map.size > 0) {
    const uncategorized = map.get(null) ?? [];
    for (const remaining of map.values()) uncategorized.push(...remaining);
    result.push({ category: null, metrics: uncategorized });
  }
  return result;
}

export async function addCustomMetric(
  name: string,
  unit: string,
  categoryId: number | null,
): Promise<void> {
  try {
    await withLock(async () => {
      const d = await getDb();
      await d.execute(
        "INSERT INTO metric_definitions (name, unit, is_builtin, category_id) VALUES ($1, $2, 0, $3)",
        [name, unit, categoryId],
      );
    });
    log.info("DB", `addCustomMetric: ${name}`);
  } catch (e) {
    log.error("DB", `addCustomMetric 失败: ${name}`, e);
    throw e;
  }
}

export async function deleteCustomMetric(id: number): Promise<void> {
  await withLock(async () => {
    const d = await getDb();
    await d.execute("DELETE FROM records WHERE metric_id = $1", [id]);
    await d.execute("DELETE FROM metric_definitions WHERE id = $1", [id]);
  });
}

export async function getMetricRecordSummary(id: number): Promise<{
  total: number;
  departments: { name: string; count: number }[];
}> {
  return safeOp("getMetricRecordSummary", async () => {
    const d = await getDb();
    const rows = await d.select<
      { department: string; cnt: number }[]
    >(
      "SELECT department, COUNT(*) as cnt FROM records WHERE metric_id = $1 GROUP BY department ORDER BY cnt DESC, department",
      [id],
    );
    return {
      total: rows.reduce((sum, r) => sum + r.cnt, 0),
      departments: rows.map((r) => ({ name: r.department, count: r.cnt })),
    };
  }, { total: 0, departments: [] });
}

export async function getDepartmentRecordSummary(id: number): Promise<{
  total: number;
  metrics: { name: string; count: number }[];
}> {
  return safeOp("getDepartmentRecordSummary", async () => {
    const d = await getDb();
    const deptRows = await d.select<{ name: string }[]>(
      "SELECT name FROM departments WHERE id = $1",
      [id],
    );
    if (deptRows.length === 0) return { total: 0, metrics: [] };
    const deptName = deptRows[0].name;
    const rows = await d.select<
      { metric_name: string; cnt: number }[]
    >(
      "SELECT m.name as metric_name, COUNT(*) as cnt FROM records r JOIN metric_definitions m ON r.metric_id = m.id WHERE r.department = $1 GROUP BY m.name ORDER BY cnt DESC, m.name",
      [deptName],
    );
    return {
      total: rows.reduce((sum, r) => sum + r.cnt, 0),
      metrics: rows.map((r) => ({ name: r.metric_name, count: r.cnt })),
    };
  }, { total: 0, metrics: [] });
}

export async function updateMetric(id: number, name: string, unit: string): Promise<void> {
  await withLock(async () => {
    const d = await getDb();
    await d.execute(
      "UPDATE metric_definitions SET name = $1, unit = $2 WHERE id = $3",
      [name, unit, id],
    );
  });
  log.info("DB", `updateMetric: ${id} → ${name}(${unit})`);
}

// ═══════════════════════════════════════════════
// Records
// ═══════════════════════════════════════════════

export async function saveRecords(
  records: { date: string; department: string; metric_id: number; value: number | null }[],
): Promise<void> {
  const valid = records.filter((r) => r.value != null);
  try {
    await withLock(async () => {
      const d = await getDb();
      for (const r of valid) {
        const existing = await d.select<{ id: number }[]>(
          "SELECT id FROM records WHERE date = $1 AND department = $2 AND metric_id = $3",
          [r.date, r.department, r.metric_id],
        );
        if (existing.length > 0) {
          await d.execute("UPDATE records SET value = $1 WHERE id = $2", [r.value, existing[0].id]);
        } else {
          await d.execute(
            "INSERT INTO records (date, department, metric_id, value) VALUES ($1, $2, $3, $4)",
            [r.date, r.department, r.metric_id, r.value],
          );
        }
      }
    });
    log.info("DB", `saveRecords: 保存 ${valid.length} 条记录`);
  } catch (e) {
    log.error("DB", `saveRecords 失败 (${valid.length} 条)`, e);
    throw e;
  }
}

export async function queryRecords(params: {
  dateFrom?: string;
  dateTo?: string;
  departments?: string[];
  metricIds?: number[];
}): Promise<RecordRow[]> {
  return safeOp("queryRecords", async () => {
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

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT r.*, m.name as metric_name, m.unit as metric_unit
      FROM records r
      JOIN metric_definitions m ON r.metric_id = m.id
      ${where}
      ORDER BY r.date DESC, r.department, m.id
    `;
    return await d.select<RecordRow[]>(sql, bindings);
  }, []);
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
        await d.execute("UPDATE records SET value = $1 WHERE id = $2", [
          row.value,
          existing[0].id,
        ]);
      } else {
        await d.execute(
          "INSERT INTO records (date, department, metric_id, value) VALUES ($1, $2, $3, $4)",
          [row.date, row.department, metrics[0].id, row.value],
        );
      }
    }
  });
}

// ═══════════════════════════════════════════════
// Seed data
// ═══════════════════════════════════════════════

const BUILTIN_CATEGORIES: { name: string; metrics: { name: string; unit: string }[] }[] = [
  {
    name: "医院管理质控中心数据指标",
    metrics: [
      { name: "手术量", unit: "台" },
      { name: "手术占比", unit: "%" },
      { name: "四级手术占比", unit: "%" },
      { name: "微创手术占比", unit: "%" },
      { name: "并发症发生率", unit: "%" },
      { name: "平均住院日", unit: "天" },
      { name: "病床周转次数", unit: "次" },
      { name: "病历返修率", unit: "%" },
      { name: "门诊量", unit: "人次" },
      { name: "急诊量", unit: "人次" },
      { name: "住院量", unit: "人次" },
      { name: "床位使用率", unit: "%" },
      { name: "平均住院费用", unit: "元" },
      { name: "药占比", unit: "%" },
      { name: "检查阳性率", unit: "%" },
      { name: "三日确诊率", unit: "%" },
      { name: "危重患者抢救成功率", unit: "%" },
      { name: "入院诊断与出院诊断符合率", unit: "%" },
    ],
  },
  {
    name: "国家公立医院绩效监测指标",
    metrics: [
      { name: "医疗服务收入占比", unit: "%" },
      { name: "人员经费占比", unit: "%" },
      { name: "万元收入能耗支出", unit: "元" },
      { name: "资产负债率", unit: "%" },
      { name: "门诊次均费用", unit: "元" },
      { name: "住院次均费用", unit: "元" },
      { name: "门诊次均药品费用", unit: "元" },
      { name: "住院次均药品费用", unit: "元" },
      { name: "医务人员满意度", unit: "%" },
      { name: "门诊患者满意度", unit: "%" },
      { name: "住院患者满意度", unit: "%" },
      { name: "医护比", unit: "" },
      { name: "床护比", unit: "" },
      { name: "卫生技术人员占比", unit: "%" },
      { name: "医师日均担负诊疗人次", unit: "人次" },
      { name: "医师日均担负住院床日", unit: "日" },
      { name: "电子病历应用功能水平", unit: "级" },
      { name: "门诊预约诊疗率", unit: "%" },
    ],
  },
  {
    name: "医疗安全相关指标（住院获得性指标）",
    metrics: [
      { name: "院内感染发生率", unit: "%" },
      { name: "手术部位感染率", unit: "%" },
      { name: "呼吸机相关肺炎发生率", unit: "‰" },
      { name: "中心静脉导管相关血流感染率", unit: "‰" },
      { name: "导尿管相关泌尿系统感染率", unit: "‰" },
      { name: "压疮发生率", unit: "%" },
      { name: "跌倒/坠床发生率", unit: "‰" },
      { name: "非计划再手术率", unit: "%" },
      { name: "非计划再入院率", unit: "%" },
      { name: "围手术期死亡率", unit: "%" },
      { name: "术后肺栓塞发生率", unit: "%" },
      { name: "术后深静脉血栓发生率", unit: "%" },
      { name: "输血反应发生率", unit: "%" },
      { name: "药物不良反应发生率", unit: "%" },
      { name: "多重耐药菌感染发生率", unit: "%" },
      { name: "不良事件报告率", unit: "%" },
    ],
  },
];

export async function seedBuiltinData(): Promise<void> {
  const d = await getDb();

  // Check if already seeded
  const catCount = await d.select<{ count: number }[]>(
    "SELECT COUNT(*) as count FROM metric_categories WHERE is_builtin = 1",
  );
  if (catCount[0].count > 0) return;

  for (let i = 0; i < BUILTIN_CATEGORIES.length; i++) {
    const cat = BUILTIN_CATEGORIES[i];
    await d.execute(
      "INSERT INTO metric_categories (name, is_builtin, sort_order) VALUES ($1, 1, $2)",
      [cat.name, i],
    );
    const rows = await d.select<{ id: number }[]>(
      "SELECT id FROM metric_categories WHERE name = $1",
      [cat.name],
    );
    if (rows.length === 0) continue;
    const catId = rows[0].id;

    for (const m of cat.metrics) {
      await d.execute(
        "INSERT OR IGNORE INTO metric_definitions (name, unit, is_builtin, category_id) VALUES ($1, $2, 1, $3)",
        [m.name, m.unit, catId],
      );
      // Backfill category_id for rows that existed before v5 migration
      await d.execute(
        "UPDATE metric_definitions SET category_id = $1 WHERE name = $2 AND is_builtin = 1 AND category_id IS NULL",
        [catId, m.name],
      );
    }
  }
}

export async function seedMockData(): Promise<void> {
  await seedBuiltinData();
  const d = await getDb();
  const count = await d.select<{ count: number }[]>(
    "SELECT COUNT(*) as count FROM records",
  );
  if (count[0].count > 0) return;

  const departments = ["心内科", "骨科", "普外科"];
  const months = 12;
  const now = new Date();

  const allMetrics = await d.select<{ id: number; name: string }[]>(
    "SELECT id, name FROM metric_definitions",
  );
  const metricMap = new Map(allMetrics.map((m) => [m.name, m.id]));

  for (const dept of departments) {
    for (let i = months; i >= 0; i--) {
      const d2 = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ds = `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, "0")}`;

      const base = dept === "心内科" ? 80 : dept === "骨科" ? 60 : 45;
      const noise = () => Math.round((Math.random() - 0.5) * 20);

      // Generate values for ALL metrics
      for (const [name, id] of metricMap) {
        let val: number | null = null;
        if (name === "手术量") val = base + noise();
        else if (name === "手术占比") val = 75 + Math.round((Math.random() - 0.5) * 15);
        else if (name === "四级手术占比") val = 25 + Math.round(Math.random() * 20);
        else if (name === "微创手术占比") val = 40 + Math.round(Math.random() * 25);
        else if (name === "并发症发生率" || name === "院内感染发生率" || name === "手术部位感染率" || name === "压疮发生率")
          val = +(Math.random() * 3 + 1).toFixed(1);
        else if (name.includes("率") || name.includes("占比") || name.includes("满意度"))
          val = 70 + Math.round(Math.random() * 25);
        else if (name === "平均住院日") val = +(Math.random() * 3 + 5).toFixed(1);
        else if (name === "病床周转次数") val = +(Math.random() * 2 + 2.5).toFixed(1);
        else if (name === "平均住院费用" || name === "住院次均费用")
          val = 8000 + Math.round(Math.random() * 4000);
        else if (name === "门诊次均费用") val = 300 + Math.round(Math.random() * 200);
        else if (name.includes("药品费用")) val = 500 + Math.round(Math.random() * 300);
        else if (name.includes("感染率") && name.includes("‰"))
          val = +(Math.random() * 3 + 0.5).toFixed(1);
        else if (name.includes("发生") || name.includes("死亡率") || name.includes("血栓") || name.includes("栓塞"))
          val = +(Math.random() * 2 + 0.1).toFixed(1);
        else if (name.includes("比") && !name.includes("占比"))
          val = +(Math.random() * 1 + 1).toFixed(1);
        else
          val = 50 + Math.round(Math.random() * 40);

        if (val !== null) {
          await d.execute(
            "INSERT INTO records (date, department, metric_id, value) VALUES ($1, $2, $3, $4)",
            [ds, dept, id, val],
          );
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════
// Department CRUD
// ═══════════════════════════════════════════════

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
  return await d.select<Department[]>("SELECT * FROM departments ORDER BY id ASC");
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

export async function updateDepartment(id: number, name: string): Promise<void> {
  const d = await getDb();
  const old = await d.select<{ name: string }[]>("SELECT name FROM departments WHERE id = $1", [id]);
  await d.execute("UPDATE departments SET name = $1 WHERE id = $2", [name, id]);
  if (old.length > 0) {
    await d.execute("UPDATE records SET department = $1 WHERE department = $2", [name, old[0].name]);
  }
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
  await d.execute("INSERT OR IGNORE INTO departments (name) VALUES ($1)", [name]);
}

// ═══════════════════════════════════════════════
// XLSX import
// ═══════════════════════════════════════════════

export async function importFromXlsx(
  rows: Record<string, string | number>[],
): Promise<{ imported: number; newDepts: string[] }> {
  const newDepts: string[] = [];
  const d = await getDb();

  const metrics = await d.select<{ id: number; name: string }[]>(
    "SELECT id, name FROM metric_definitions",
  );
  const metricMap = new Map(metrics.map((m) => [m.name, m.id]));

  let imported = 0;
  await withLock(async () => {
    for (const row of rows) {
      const dept = String(row.department ?? row["科室"] ?? "").trim();
      let dateVal: string | null = String(row.date ?? row["日期"] ?? row["月份"] ?? "").trim();
      if (!dept || !dateVal) continue;
      // Normalize to YYYY-MM
      if (dateVal.length >= 10 && dateVal[4] === "-" && dateVal[7] === "-") {
        dateVal = dateVal.slice(0, 7);
      }

      const existingDept = await d.select<{ name: string }[]>(
        "SELECT name FROM departments WHERE name = $1",
        [dept],
      );
      if (existingDept.length === 0) {
        await d.execute("INSERT INTO departments (name) VALUES ($1)", [dept]);
        newDepts.push(dept);
      }

      for (const [colName, val] of Object.entries(row)) {
        if (colName === "date" || colName === "department" || colName === "月份" || colName === "日期" || colName === "科室") continue;
        const metricId = metricMap.get(colName);
        if (!metricId) continue;
        const numVal = Number(val);
        if (isNaN(numVal)) continue;

        const existing = await d.select<{ id: number }[]>(
          "SELECT id FROM records WHERE date = $1 AND department = $2 AND metric_id = $3",
          [String(dateVal), dept, metricId],
        );
        if (existing.length > 0) {
          await d.execute("UPDATE records SET value = $1 WHERE id = $2", [
            numVal,
            existing[0].id,
          ]);
        } else {
          await d.execute(
            "INSERT INTO records (date, department, metric_id, value) VALUES ($1, $2, $3, $4)",
            [String(dateVal), dept, metricId, numVal],
          );
        }
        imported++;
      }
    }
  });

  log.info("DB", `importFromXlsx: 导入 ${imported} 条，新科室 ${newDepts.length} 个`);
  return { imported, newDepts };
}
