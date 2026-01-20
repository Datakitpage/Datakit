use duckdb::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Manager, State};
use thiserror::Error;
use uuid::Uuid;

// ============================================================================
// Error Types
// ============================================================================

#[derive(Error, Debug)]
pub enum DataError {
    #[error("DuckDB error: {0}")]
    DuckDB(#[from] duckdb::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("View not found: {0}")]
    ViewNotFound(String),
    #[error("Invalid file type: {0}")]
    InvalidFileType(String),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("Lock error")]
    LockError,
}

impl Serialize for DataError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

// ============================================================================
// Data Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnSchema {
    pub name: String,
    pub r#type: String,
    pub nullable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViewDefinition {
    pub view_name: String,
    pub file_name: String,
    pub file_path: Option<String>,
    pub file_type: String,
    pub schema: Vec<ColumnSchema>,
    pub total_rows: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryParams {
    pub page: i64,
    pub page_size: i64,
    pub sort_column: Option<String>,
    pub sort_direction: Option<String>,
    pub search: Option<String>,
    pub search_columns: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedResult {
    pub data: Vec<HashMap<String, serde_json::Value>>,
    pub total_rows: i64,
    pub total_pages: i64,
    pub current_page: i64,
    pub page_size: i64,
    pub query_time_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangeRecord {
    pub id: String,
    pub view_name: String,
    pub row_id: i64,
    pub column: String,
    pub old_value: serde_json::Value,
    pub new_value: serde_json::Value,
    pub change_type: String,
    pub timestamp: i64,
    pub source: String,
}

// ============================================================================
// Database State - Thread-safe wrapper
// ============================================================================

pub struct DatabaseState {
    conn: Mutex<Connection>,
    views: Mutex<HashMap<String, ViewDefinition>>,
    pending_changes: Mutex<HashMap<String, Vec<ChangeRecord>>>,
}

// Implement Send + Sync manually since we're using Mutex
unsafe impl Send for DatabaseState {}
unsafe impl Sync for DatabaseState {}

impl DatabaseState {
    pub fn new() -> Result<Self, duckdb::Error> {
        let conn = Connection::open_in_memory()?;

        // Enable useful extensions
        conn.execute_batch(
            "INSTALL parquet; LOAD parquet;
             INSTALL json; LOAD json;"
        )?;

        Ok(Self {
            conn: Mutex::new(conn),
            views: Mutex::new(HashMap::new()),
            pending_changes: Mutex::new(HashMap::new()),
        })
    }
}

// ============================================================================
// Tauri Commands
// ============================================================================

#[tauri::command]
async fn init_database(state: State<'_, DatabaseState>) -> Result<bool, DataError> {
    Ok(true)
}

#[tauri::command]
async fn create_view_from_file(
    state: State<'_, DatabaseState>,
    file_path: String,
    view_name: Option<String>,
) -> Result<ViewDefinition, DataError> {
    let path = PathBuf::from(&file_path);
    let file_name = path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let extension = path.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let view_name = view_name.unwrap_or_else(|| {
        let base = path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("view");
        sanitize_identifier(base)
    });

    let conn = state.conn.lock().map_err(|_| DataError::LockError)?;

    // Drop existing view if exists
    let _ = conn.execute(&format!("DROP VIEW IF EXISTS \"{}\"", view_name), []);
    let _ = conn.execute(&format!("DROP TABLE IF EXISTS \"{}\"", view_name), []);

    // Create view based on file type
    let create_sql = match extension.as_str() {
        "csv" => format!(
            "CREATE VIEW \"{}\" AS SELECT row_number() OVER () as _rowid, * FROM read_csv_auto('{}')",
            view_name, file_path.replace('\'', "''")
        ),
        "json" | "jsonl" => format!(
            "CREATE VIEW \"{}\" AS SELECT row_number() OVER () as _rowid, * FROM read_json_auto('{}')",
            view_name, file_path.replace('\'', "''")
        ),
        "parquet" => format!(
            "CREATE VIEW \"{}\" AS SELECT row_number() OVER () as _rowid, * FROM read_parquet('{}')",
            view_name, file_path.replace('\'', "''")
        ),
        _ => return Err(DataError::InvalidFileType(extension)),
    };

    conn.execute(&create_sql, [])?;

    // Get schema
    let schema = get_view_schema(&conn, &view_name)?;

    // Get row count
    let total_rows: i64 = conn
        .query_row(&format!("SELECT COUNT(*) FROM \"{}\"", view_name), [], |row| row.get(0))
        .unwrap_or(0);

    let view_def = ViewDefinition {
        view_name: view_name.clone(),
        file_name,
        file_path: Some(file_path),
        file_type: extension,
        schema,
        total_rows,
        created_at: chrono_timestamp(),
    };

    // Store view definition
    state.views.lock().map_err(|_| DataError::LockError)?.insert(view_name.clone(), view_def.clone());

    // Create delta table for change tracking
    let delta_table = format!("{}_delta", view_name);
    let _ = conn.execute(&format!("DROP TABLE IF EXISTS \"{}\"", delta_table), []);
    conn.execute(&format!(
        "CREATE TABLE \"{}\" (
            id VARCHAR PRIMARY KEY,
            row_id BIGINT,
            column_name VARCHAR,
            old_value VARCHAR,
            new_value VARCHAR,
            change_type VARCHAR,
            timestamp BIGINT,
            source VARCHAR
        )", delta_table
    ), [])?;

    Ok(view_def)
}

#[tauri::command]
async fn query_view(
    state: State<'_, DatabaseState>,
    view_name: String,
    params: QueryParams,
) -> Result<PaginatedResult, DataError> {
    let start = std::time::Instant::now();
    let conn = state.conn.lock().map_err(|_| DataError::LockError)?;

    // Check view exists
    let views = state.views.lock().map_err(|_| DataError::LockError)?;
    if !views.contains_key(&view_name) {
        return Err(DataError::ViewNotFound(view_name));
    }
    let view_def = views.get(&view_name).cloned();
    drop(views);

    // Build WHERE clause for search
    let mut conditions = Vec::new();
    if let Some(ref search) = params.search {
        if !search.is_empty() {
            let search_cols = params.search_columns.clone().unwrap_or_else(|| {
                view_def.as_ref()
                    .map(|v| v.schema.iter().map(|c| c.name.clone()).filter(|n| n != "_rowid").collect())
                    .unwrap_or_default()
            });

            if !search_cols.is_empty() {
                let search_escaped = search.replace('\'', "''");
                let search_conditions: Vec<String> = search_cols.iter()
                    .map(|col| format!("CAST(\"{}\" AS VARCHAR) ILIKE '%{}%'", col, search_escaped))
                    .collect();
                conditions.push(format!("({})", search_conditions.join(" OR ")));
            }
        }
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", conditions.join(" AND "))
    };

    let order_clause = params.sort_column.as_ref()
        .map(|col| format!(" ORDER BY \"{}\" {}", col, params.sort_direction.as_deref().unwrap_or("ASC")))
        .unwrap_or_else(|| " ORDER BY _rowid ASC".to_string());

    let offset = params.page * params.page_size;
    let limit_clause = format!(" LIMIT {} OFFSET {}", params.page_size, offset);

    let query = format!(
        "SELECT * FROM \"{}\"{}{}{}",
        view_name, where_clause, order_clause, limit_clause
    );

    let mut stmt = conn.prepare(&query)?;
    let column_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();

    let rows = stmt.query_map([], |row| {
        let mut map = HashMap::new();
        for (i, name) in column_names.iter().enumerate() {
            let value: duckdb::types::Value = row.get(i)?;
            map.insert(name.clone(), duckdb_value_to_json(value));
        }
        Ok(map)
    })?;

    let data: Vec<HashMap<String, serde_json::Value>> = rows
        .filter_map(|r| r.ok())
        .collect();

    // Get total count
    let count_query = format!("SELECT COUNT(*) FROM \"{}\"{}", view_name, where_clause);
    let total_rows: i64 = conn.query_row(&count_query, [], |row| row.get(0)).unwrap_or(0);

    let query_time_ms = start.elapsed().as_secs_f64() * 1000.0;

    Ok(PaginatedResult {
        data,
        total_rows,
        total_pages: (total_rows as f64 / params.page_size as f64).ceil() as i64,
        current_page: params.page,
        page_size: params.page_size,
        query_time_ms,
    })
}

#[tauri::command]
async fn execute_sql(
    state: State<'_, DatabaseState>,
    sql: String,
) -> Result<Vec<HashMap<String, serde_json::Value>>, DataError> {
    let conn = state.conn.lock().map_err(|_| DataError::LockError)?;
    let mut stmt = conn.prepare(&sql)?;
    let column_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();

    let rows = stmt.query_map([], |row| {
        let mut map = HashMap::new();
        for (i, name) in column_names.iter().enumerate() {
            let value: duckdb::types::Value = row.get(i)?;
            map.insert(name.clone(), duckdb_value_to_json(value));
        }
        Ok(map)
    })?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
async fn record_change(
    state: State<'_, DatabaseState>,
    view_name: String,
    row_id: i64,
    column: String,
    old_value: serde_json::Value,
    new_value: serde_json::Value,
    change_type: String,
    source: String,
) -> Result<ChangeRecord, DataError> {
    let change = ChangeRecord {
        id: Uuid::new_v4().to_string(),
        view_name: view_name.clone(),
        row_id,
        column: column.clone(),
        old_value: old_value.clone(),
        new_value: new_value.clone(),
        change_type: change_type.clone(),
        timestamp: chrono_timestamp(),
        source: source.clone(),
    };

    state.pending_changes
        .lock()
        .map_err(|_| DataError::LockError)?
        .entry(view_name.clone())
        .or_default()
        .push(change.clone());

    let conn = state.conn.lock().map_err(|_| DataError::LockError)?;
    let delta_table = format!("{}_delta", view_name);
    conn.execute(
        &format!(
            "INSERT INTO \"{}\" VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            delta_table
        ),
        params![
            change.id,
            row_id,
            column,
            serde_json::to_string(&old_value)?,
            serde_json::to_string(&new_value)?,
            change_type,
            change.timestamp,
            source
        ],
    )?;

    Ok(change)
}

#[tauri::command]
async fn get_pending_changes(
    state: State<'_, DatabaseState>,
    view_name: String,
) -> Result<Vec<ChangeRecord>, DataError> {
    let changes = state.pending_changes
        .lock()
        .map_err(|_| DataError::LockError)?
        .get(&view_name)
        .cloned()
        .unwrap_or_default();
    Ok(changes)
}

#[tauri::command]
async fn undo_last_change(
    state: State<'_, DatabaseState>,
    view_name: String,
) -> Result<Option<ChangeRecord>, DataError> {
    let mut changes = state.pending_changes.lock().map_err(|_| DataError::LockError)?;
    let view_changes = changes.get_mut(&view_name);

    if let Some(view_changes) = view_changes {
        if let Some(last_change) = view_changes.pop() {
            let conn = state.conn.lock().map_err(|_| DataError::LockError)?;
            let delta_table = format!("{}_delta", view_name);
            conn.execute(
                &format!("DELETE FROM \"{}\" WHERE id = ?", delta_table),
                params![last_change.id],
            )?;
            return Ok(Some(last_change));
        }
    }

    Ok(None)
}

#[tauri::command]
async fn discard_changes(
    state: State<'_, DatabaseState>,
    view_name: String,
) -> Result<bool, DataError> {
    state.pending_changes.lock().map_err(|_| DataError::LockError)?.remove(&view_name);

    let conn = state.conn.lock().map_err(|_| DataError::LockError)?;
    let delta_table = format!("{}_delta", view_name);
    conn.execute(&format!("DELETE FROM \"{}\"", delta_table), [])?;

    Ok(true)
}

#[tauri::command]
async fn commit_changes(
    state: State<'_, DatabaseState>,
    view_name: String,
) -> Result<bool, DataError> {
    let changes = state.pending_changes.lock().map_err(|_| DataError::LockError)?.remove(&view_name).unwrap_or_default();
    let conn = state.conn.lock().map_err(|_| DataError::LockError)?;

    for change in changes {
        match change.change_type.as_str() {
            "update" => {
                let new_val = json_to_sql_value(&change.new_value);
                conn.execute(
                    &format!(
                        "UPDATE \"{}\" SET \"{}\" = {} WHERE _rowid = ?",
                        view_name, change.column, new_val
                    ),
                    params![change.row_id],
                )?;
            }
            "delete" => {
                conn.execute(
                    &format!("DELETE FROM \"{}\" WHERE _rowid = ?", view_name),
                    params![change.row_id],
                )?;
            }
            _ => {}
        }
    }

    let delta_table = format!("{}_delta", view_name);
    conn.execute(&format!("DELETE FROM \"{}\"", delta_table), [])?;

    Ok(true)
}

#[tauri::command]
async fn export_view(
    state: State<'_, DatabaseState>,
    view_name: String,
    output_path: String,
    format: String,
) -> Result<bool, DataError> {
    let conn = state.conn.lock().map_err(|_| DataError::LockError)?;

    let export_sql = match format.as_str() {
        "csv" => format!(
            "COPY (SELECT * FROM \"{}\") TO '{}' (HEADER, DELIMITER ',')",
            view_name, output_path.replace('\'', "''")
        ),
        "parquet" => format!(
            "COPY (SELECT * FROM \"{}\") TO '{}' (FORMAT PARQUET)",
            view_name, output_path.replace('\'', "''")
        ),
        "json" => format!(
            "COPY (SELECT * FROM \"{}\") TO '{}' (FORMAT JSON, ARRAY true)",
            view_name, output_path.replace('\'', "''")
        ),
        _ => return Err(DataError::InvalidFileType(format)),
    };

    conn.execute(&export_sql, [])?;
    Ok(true)
}

#[tauri::command]
async fn get_schema(
    state: State<'_, DatabaseState>,
    view_name: String,
) -> Result<Vec<ColumnSchema>, DataError> {
    let conn = state.conn.lock().map_err(|_| DataError::LockError)?;
    get_view_schema(&conn, &view_name)
}

#[tauri::command]
async fn drop_view(
    state: State<'_, DatabaseState>,
    view_name: String,
) -> Result<bool, DataError> {
    let conn = state.conn.lock().map_err(|_| DataError::LockError)?;

    conn.execute(&format!("DROP VIEW IF EXISTS \"{}\"", view_name), [])?;
    conn.execute(&format!("DROP TABLE IF EXISTS \"{}\"", view_name), [])?;
    conn.execute(&format!("DROP TABLE IF EXISTS \"{}_delta\"", view_name), [])?;

    drop(conn);

    state.views.lock().map_err(|_| DataError::LockError)?.remove(&view_name);
    state.pending_changes.lock().map_err(|_| DataError::LockError)?.remove(&view_name);

    Ok(true)
}

#[tauri::command]
async fn list_views(
    state: State<'_, DatabaseState>,
) -> Result<Vec<ViewDefinition>, DataError> {
    let views = state.views.lock().map_err(|_| DataError::LockError)?;
    Ok(views.values().cloned().collect())
}

// ============================================================================
// Helper Functions
// ============================================================================

fn get_view_schema(conn: &Connection, view_name: &str) -> Result<Vec<ColumnSchema>, DataError> {
    let mut stmt = conn.prepare(&format!("DESCRIBE \"{}\"", view_name))?;
    let rows = stmt.query_map([], |row| {
        Ok(ColumnSchema {
            name: row.get(0)?,
            r#type: row.get(1)?,
            nullable: row.get::<_, String>(2).map(|s| s == "YES").unwrap_or(true),
        })
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

fn sanitize_identifier(name: &str) -> String {
    let sanitized: String = name
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .collect();

    if sanitized.chars().next().map(|c| c.is_numeric()).unwrap_or(false) {
        format!("_{}", sanitized)
    } else {
        sanitized
    }.to_lowercase()
}

fn chrono_timestamp() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64
}

fn duckdb_value_to_json(value: duckdb::types::Value) -> serde_json::Value {
    use duckdb::types::Value;
    match value {
        Value::Null => serde_json::Value::Null,
        Value::Boolean(b) => serde_json::Value::Bool(b),
        Value::TinyInt(i) => serde_json::json!(i),
        Value::SmallInt(i) => serde_json::json!(i),
        Value::Int(i) => serde_json::json!(i),
        Value::BigInt(i) => serde_json::json!(i),
        Value::HugeInt(i) => serde_json::json!(i.to_string()),
        Value::UTinyInt(i) => serde_json::json!(i),
        Value::USmallInt(i) => serde_json::json!(i),
        Value::UInt(i) => serde_json::json!(i),
        Value::UBigInt(i) => serde_json::json!(i),
        Value::Float(f) => serde_json::json!(f),
        Value::Double(f) => serde_json::json!(f),
        Value::Text(s) => serde_json::Value::String(s),
        Value::Blob(b) => serde_json::json!(format!("<blob: {} bytes>", b.len())),
        Value::Timestamp(_, i) => serde_json::json!(i),
        Value::Date32(d) => serde_json::json!(d),
        Value::Time64(_, t) => serde_json::json!(t),
        _ => serde_json::Value::String(format!("{:?}", value)),
    }
}

fn json_to_sql_value(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Null => "NULL".to_string(),
        serde_json::Value::Bool(b) => if *b { "TRUE" } else { "FALSE" }.to_string(),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::String(s) => format!("'{}'", s.replace('\'', "''")),
        _ => format!("'{}'", value.to_string().replace('\'', "''")),
    }
}

// ============================================================================
// App Entry Point
// ============================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let db_state = DatabaseState::new()
                .expect("Failed to initialize DuckDB");
            app.manage(db_state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            init_database,
            create_view_from_file,
            query_view,
            execute_sql,
            record_change,
            get_pending_changes,
            undo_last_change,
            discard_changes,
            commit_changes,
            export_view,
            get_schema,
            drop_view,
            list_views,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
