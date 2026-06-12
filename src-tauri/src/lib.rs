use rusqlite::Connection;
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

fn get_db_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_local_data_dir().map_err(|e| format!("获取数据目录失败: {}", e))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("创建数据目录失败: {}", e))?;
    Ok(dir.join("medical.db"))
}

fn exec_migration_v6(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
         );",
    )?;
    Ok(())
}

fn with_db<T>(app: &tauri::AppHandle, f: impl FnOnce(&Connection) -> Result<T, String>) -> Result<T, String> {
    let path = get_db_path(app)?;
    let conn = Connection::open(&path).map_err(|e| format!("打开数据库失败: {}", e))?;
    exec_migration_v6(&conn).map_err(|e| e.to_string())?;
    f(&conn)
}

#[tauri::command]
fn check_users_exists(app: tauri::AppHandle) -> Result<bool, String> {
    with_db(&app, |conn| {
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        Ok(count > 0)
    })
}

#[tauri::command]
fn register(app: tauri::AppHandle, username: String, password: String) -> Result<(), String> {
    if username.trim().is_empty() || password.len() < 4 {
        return Err("用户名不能为空且密码至少4位".to_string());
    }
    with_db(&app, |conn| {
        let existing: i64 = conn
            .query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        if existing > 0 {
            return Err("管理员账户已存在".to_string());
        }
        let hash = bcrypt::hash(&password, bcrypt::DEFAULT_COST).map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?1, ?2)",
            rusqlite::params![username.trim(), hash],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
}

#[tauri::command]
fn login(app: tauri::AppHandle, username: String, password: String) -> Result<bool, String> {
    with_db(&app, |conn| {
        let row = conn.query_row(
            "SELECT password_hash FROM users WHERE username = ?1",
            rusqlite::params![username],
            |row| row.get::<_, String>(0),
        );
        match row {
            Ok(hash) => {
                let ok = bcrypt::verify(&password, &hash).map_err(|e| e.to_string())?;
                Ok(ok)
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(false),
            Err(e) => Err(e.to_string()),
        }
    })
}

#[tauri::command]
fn change_password(
    app: tauri::AppHandle,
    username: String,
    old_password: String,
    new_password: String,
) -> Result<(), String> {
    if new_password.len() < 4 {
        return Err("新密码至少4位".to_string());
    }
    with_db(&app, |conn| {
        let row = conn.query_row(
            "SELECT password_hash FROM users WHERE username = ?1",
            rusqlite::params![username],
            |row| row.get::<_, String>(0),
        );
        match row {
            Ok(hash) => {
                if !bcrypt::verify(&old_password, &hash).map_err(|e| e.to_string())? {
                    return Err("原密码错误".to_string());
                }
                let new_hash = bcrypt::hash(&new_password, bcrypt::DEFAULT_COST)
                    .map_err(|e| e.to_string())?;
                conn.execute(
                    "UPDATE users SET password_hash = ?1 WHERE username = ?2",
                    rusqlite::params![new_hash, username],
                )
                .map_err(|e| e.to_string())?;
                Ok(())
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => Err("用户不存在".to_string()),
            Err(e) => Err(e.to_string()),
        }
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
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
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:medical.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            check_users_exists,
            register,
            login,
            change_password,
        ])
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
