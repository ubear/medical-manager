use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "create initial tables",
        sql: "CREATE TABLE IF NOT EXISTS metric_definitions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                unit TEXT NOT NULL DEFAULT '',
                is_builtin INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
             );
             CREATE TABLE IF NOT EXISTS records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                department TEXT NOT NULL,
                metric_id INTEGER NOT NULL,
                value REAL,
                created_at TEXT DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (metric_id) REFERENCES metric_definitions(id)
             );",
        kind: MigrationKind::Up,
    },
    Migration {
        version: 2,
        description: "create departments table",
        sql: "CREATE TABLE IF NOT EXISTS departments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
             );",
        kind: MigrationKind::Up,
    },
    Migration {
        version: 3,
        description: "create metric_categories table",
        sql: "CREATE TABLE IF NOT EXISTS metric_categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                is_builtin INTEGER NOT NULL DEFAULT 0,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
             );",
        kind: MigrationKind::Up,
    },
    Migration {
        version: 4,
        description: "migrate date format from YYYY-MM-DD to YYYY-MM",
        sql: "UPDATE records SET date = substr(date, 1, 7) WHERE length(date) = 10;",
        kind: MigrationKind::Up,
    },
    Migration {
        version: 5,
        description: "add category_id to metric_definitions",
        sql: "ALTER TABLE metric_definitions ADD COLUMN category_id INTEGER REFERENCES metric_categories(id);",
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:medical.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
