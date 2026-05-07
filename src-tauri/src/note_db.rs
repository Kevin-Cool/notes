use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;
use uuid::Uuid;

// Settings
#[derive(Debug, Serialize, Deserialize)]
pub struct AppSettingRecord {
    pub key: String,
    pub value: String,
    pub updated_at: String,
}

// Note
#[derive(Debug, Serialize, Deserialize)]
pub struct NoteRecord {
    pub id: String,
    pub name: String,
    pub content: String,
    pub thumbnail: Option<String>,
    pub created_at: String,
    pub last_updated_at: String,
}

// Media
#[derive(Debug, Serialize, Deserialize)]
pub struct MediaRecord {
    pub id: String,
    pub file_name: String,
    pub original_name: String,
    pub mime_type: Option<String>,
    pub size_bytes: i64,
    pub relative_path: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportMediaBytesPayload {
    pub file_name: String,
    pub mime_type: Option<String>,
    pub bytes: Vec<u8>,
}
// Tasks
#[derive(Debug, Serialize, Deserialize)]
pub struct CalendarTaskRecord {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub start: String,
    pub end: String,
    pub color: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpsertCalendarTaskPayload {
    pub id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub start: String,
    pub end: String,
    pub color: i32,
}

// Local storage
#[derive(Debug, Serialize, Deserialize)]
pub struct StorageUsageRecord {
    pub app_data_path: String,
    pub media_path: String,
    pub thumbnails_path: String,
    pub media_bytes: i64,
    pub thumbnails_bytes: i64,
    pub total_bytes: i64,
}

fn parse_and_validate_iso_datetime(value: &str, field_name: &str) -> Result<String, String> {
    let parsed: chrono::DateTime<chrono::FixedOffset> = chrono::DateTime::parse_from_rfc3339(value)
        .map_err(|error| format!("invalid {field_name} ISO datetime: {error}"))?;

    Ok(parsed.to_rfc3339())
}

fn get_database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir: PathBuf = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("failed to resolve app data dir: {error}"))?;

    fs::create_dir_all(&app_data_dir)
        .map_err(|error| format!("failed to create app data dir: {error}"))?;

    Ok(app_data_dir.join("notes.db"))
}

fn get_app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir: PathBuf = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("failed to resolve app data dir: {error}"))?;

    fs::create_dir_all(&app_data_dir)
        .map_err(|error| format!("failed to create app data dir: {error}"))?;

    Ok(app_data_dir)
}

fn get_media_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let media_dir: PathBuf = get_app_data_dir(app)?.join("media");

    fs::create_dir_all(&media_dir)
        .map_err(|error| format!("failed to create media dir: {error}"))?;

    Ok(media_dir)
}

fn get_thumbnails_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let thumbnails_dir: PathBuf = get_app_data_dir(app)?.join("thumbnails");

    fs::create_dir_all(&thumbnails_dir)
        .map_err(|error| format!("failed to create thumbnails dir: {error}"))?;

    Ok(thumbnails_dir)
}

fn open_connection(app: &AppHandle) -> Result<Connection, String> {
    let database_path: PathBuf = get_database_path(app)?;

    let connection: Connection = Connection::open(database_path)
        .map_err(|error| format!("failed to open database: {error}"))?;

    connection
        .execute_batch(
            "
        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            content TEXT NOT NULL,
            thumbnail TEXT NULL,
            created_at TEXT NOT NULL,
            last_updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS media (
            id TEXT PRIMARY KEY,
            file_name TEXT NOT NULL,
            original_name TEXT NOT NULL,
            mime_type TEXT NULL,
            size_bytes INTEGER NOT NULL,
            relative_path TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS calendar_tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NULL,
            start TEXT NOT NULL,
            end TEXT NOT NULL,
            color INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        ",
        )
        .map_err(|error| format!("failed to initialize database: {error}"))?;

    Ok(connection)
}


#[tauri::command]
pub fn get_note_by_id(app: AppHandle, note_id: String) -> Result<Option<NoteRecord>, String> {
    let connection: Connection = open_connection(&app)?;

    let mut statement = connection
        .prepare(
            "
            SELECT id, name, content, thumbnail, created_at, last_updated_at
            FROM notes
            WHERE id = ?1
            ",
        )
        .map_err(|error| format!("failed to prepare get_note_by_id: {error}"))?;

    let mut rows = statement
        .query(params![note_id])
        .map_err(|error| format!("failed to query note: {error}"))?;

    let row_option = rows
        .next()
        .map_err(|error| format!("failed to read query row: {error}"))?;

    if let Some(row) = row_option {
        let note: NoteRecord = NoteRecord {
            id: row
                .get(0)
                .map_err(|error| format!("failed to read id: {error}"))?,
            name: row
                .get(1)
                .map_err(|error| format!("failed to read name: {error}"))?,
            content: row
                .get(2)
                .map_err(|error| format!("failed to read content: {error}"))?,
            thumbnail: row
                .get(3)
                .map_err(|error| format!("failed to read thumbnail: {error}"))?,
            created_at: row
                .get(4)
                .map_err(|error| format!("failed to read created_at: {error}"))?,
            last_updated_at: row
                .get(5)
                .map_err(|error| format!("failed to read last_updated_at: {error}"))?,
        };

        return Ok(Some(note));
    }

    Ok(None)
}

#[tauri::command]
pub fn upsert_note(app: AppHandle, note: NoteRecord) -> Result<(), String> {
    let connection: Connection = open_connection(&app)?;

    let now: String = chrono::Utc::now().to_rfc3339();

    let created_at: String = if note.created_at.trim().is_empty() {
        now.clone()
    } else {
        note.created_at
    };

    connection
        .execute(
            "
            INSERT INTO notes (
                id,
                name,
                content,
                thumbnail,
                created_at,
                last_updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                content = excluded.content,
                thumbnail = excluded.thumbnail,
                last_updated_at = excluded.last_updated_at
            ",
            params![
                note.id,
                note.name,
                note.content,
                note.thumbnail,
                created_at,
                now
            ],
        )
        .map_err(|error| format!("failed to upsert note: {error}"))?;

    Ok(())
}

#[tauri::command]
pub fn delete_note(app: AppHandle, note_id: String) -> Result<(), String> {

    let connection: Connection = open_connection(&app)?;

    let deleted_rows: usize = connection
        .execute(
            "
            DELETE FROM notes
            WHERE id = ?1
            ",
            params![&note_id],
        )
        .map_err(|error| format!("failed to delete note: {error}"))?;

    println!("deleted note rows: {deleted_rows}");

    if deleted_rows == 0 {
        return Err("note not found".to_string());
    }

    let thumbnails_dir: PathBuf = get_thumbnails_dir(&app)?;
    let preview_file_path: PathBuf = thumbnails_dir.join(format!("{note_id}.png"));

    if preview_file_path.exists() {
        fs::remove_file(&preview_file_path)
            .map_err(|error| format!("failed to delete note thumbnail: {error}"))?;
    }

    Ok(())
}

#[tauri::command]
pub fn import_media(app: AppHandle, source_path: String) -> Result<MediaRecord, String> {
    let source: PathBuf = PathBuf::from(&source_path);

    if !source.exists() {
        return Err("source file does not exist".to_string());
    }

    let metadata: fs::Metadata = fs::metadata(&source)
        .map_err(|error| format!("failed to read source file metadata: {error}"))?;

    let original_name: String = source
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "failed to read source file name".to_string())?
        .to_string();

    let extension: String = source
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("bin")
        .to_string();

    let media_id: String = Uuid::new_v4().to_string();
    let stored_file_name: String = format!("{media_id}.{extension}");

    let media_dir: PathBuf = get_media_dir(&app)?;
    let destination: PathBuf = media_dir.join(&stored_file_name);

    fs::copy(&source, &destination)
        .map_err(|error| format!("failed to copy media file: {error}"))?;

    let relative_path: String = format!("media/{stored_file_name}");

    let media: MediaRecord = MediaRecord {
        id: media_id,
        file_name: stored_file_name,
        original_name,
        mime_type: None,
        size_bytes: metadata.len() as i64,
        relative_path,
        created_at: chrono::Utc::now().to_rfc3339(),
    };

    let connection: Connection = open_connection(&app)?;

    connection
        .execute(
            "
        INSERT INTO media (
            id,
            file_name,
            original_name,
            mime_type,
            size_bytes,
            relative_path,
            created_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        ",
            params![
                media.id,
                media.file_name,
                media.original_name,
                media.mime_type,
                media.size_bytes,
                media.relative_path,
                media.created_at
            ],
        )
        .map_err(|error| format!("failed to insert media: {error}"))?;

    Ok(media)
}

#[tauri::command]
pub fn get_media_by_id(app: AppHandle, media_id: String) -> Result<Option<MediaRecord>, String> {
    let connection: Connection = open_connection(&app)?;

    let mut statement = connection
        .prepare(
            "
            SELECT id, file_name, original_name, mime_type, size_bytes, relative_path, created_at
            FROM media
            WHERE id = ?1
            ",
        )
        .map_err(|error| format!("failed to prepare get_media_by_id: {error}"))?;

    let mut rows = statement
        .query(params![media_id])
        .map_err(|error| format!("failed to query media: {error}"))?;

    let row_option = rows
        .next()
        .map_err(|error| format!("failed to read media row: {error}"))?;

    if let Some(row) = row_option {
        let media: MediaRecord = MediaRecord {
            id: row
                .get(0)
                .map_err(|error| format!("failed to read media id: {error}"))?,
            file_name: row
                .get(1)
                .map_err(|error| format!("failed to read file_name: {error}"))?,
            original_name: row
                .get(2)
                .map_err(|error| format!("failed to read original_name: {error}"))?,
            mime_type: row
                .get(3)
                .map_err(|error| format!("failed to read mime_type: {error}"))?,
            size_bytes: row
                .get(4)
                .map_err(|error| format!("failed to read size_bytes: {error}"))?,
            relative_path: row
                .get(5)
                .map_err(|error| format!("failed to read relative_path: {error}"))?,
            created_at: row
                .get(6)
                .map_err(|error| format!("failed to read created_at: {error}"))?,
        };

        return Ok(Some(media));
    }

    Ok(None)
}

#[tauri::command]
pub fn get_media_file_path(app: AppHandle, media_id: String) -> Result<Option<String>, String> {
    let connection: Connection = open_connection(&app)?;

    let mut statement = connection
        .prepare(
            "
            SELECT relative_path
            FROM media
            WHERE id = ?1
            ",
        )
        .map_err(|error| format!("failed to prepare get_media_file_path: {error}"))?;

    let mut rows = statement
        .query(params![media_id])
        .map_err(|error| format!("failed to query media path: {error}"))?;

    let row_option = rows
        .next()
        .map_err(|error| format!("failed to read media path row: {error}"))?;

    if let Some(row) = row_option {
        let relative_path: String = row
            .get(0)
            .map_err(|error| format!("failed to read relative_path: {error}"))?;

        let full_path: PathBuf = get_app_data_dir(&app)?.join(relative_path);

        return Ok(Some(full_path.to_string_lossy().to_string()));
    }

    Ok(None)
}

#[tauri::command]
pub fn get_latest_note(app: AppHandle) -> Result<Option<NoteRecord>, String> {
    let connection: Connection = open_connection(&app)?;

    let mut statement = connection
        .prepare(
            "
            SELECT id, name, content, thumbnail, created_at, last_updated_at
            FROM notes
            ORDER BY datetime(last_updated_at) DESC
            LIMIT 1
            ",
        )
        .map_err(|error| format!("failed to prepare get_latest_note: {error}"))?;

    let mut rows = statement
        .query([])
        .map_err(|error| format!("failed to query latest note: {error}"))?;

    if let Some(row) = rows
        .next()
        .map_err(|error| format!("failed to read row: {error}"))?
    {
        return Ok(Some(NoteRecord {
            id: row.get(0).map_err(|e| e.to_string())?,
            name: row.get(1).map_err(|e| e.to_string())?,
            content: row.get(2).map_err(|e| e.to_string())?,
            thumbnail: row.get(3).map_err(|e| e.to_string())?,
            created_at: row.get(4).map_err(|e| e.to_string())?,
            last_updated_at: row.get(5).map_err(|e| e.to_string())?,
        }));
    }

    Ok(None)
}

#[tauri::command]
pub fn get_all_notes(app: AppHandle) -> Result<Vec<NoteRecord>, String> {
    let connection: Connection = open_connection(&app)?;

    let mut statement = connection
        .prepare(
            "
            SELECT id, name, content, thumbnail, created_at, last_updated_at
            FROM notes
            ORDER BY last_updated_at DESC
            ",
        )
        .map_err(|error| format!("failed to prepare get_all_notes: {error}"))?;

    let note_iterator = statement
        .query_map([], |row| {
            let note: NoteRecord = NoteRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                content: row.get(2)?,
                thumbnail: row.get(3)?,
                created_at: row.get(4)?,
                last_updated_at: row.get(5)?,
            };

            Ok(note)
        })
        .map_err(|error| format!("failed to query all notes: {error}"))?;

    let mut notes: Vec<NoteRecord> = Vec::new();

    for note_result in note_iterator {
        let note: NoteRecord =
            note_result.map_err(|error| format!("failed to read note row: {error}"))?;

        notes.push(note);
    }

    Ok(notes)
}

#[tauri::command]
pub fn import_media_bytes(
    app: AppHandle,
    payload: ImportMediaBytesPayload,
) -> Result<MediaRecord, String> {
    let extension: String = PathBuf::from(&payload.file_name)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("bin")
        .to_string();

    let media_id: String = Uuid::new_v4().to_string();
    let stored_file_name: String = format!("{media_id}.{extension}");

    let media_dir: PathBuf = get_media_dir(&app)?;
    let destination: PathBuf = media_dir.join(&stored_file_name);

    fs::write(&destination, &payload.bytes)
        .map_err(|error| format!("failed to write media bytes: {error}"))?;

    let relative_path: String = format!("media/{stored_file_name}");

    let media: MediaRecord = MediaRecord {
        id: media_id,
        file_name: stored_file_name,
        original_name: payload.file_name,
        mime_type: payload.mime_type,
        size_bytes: i64::try_from(payload.bytes.len())
            .map_err(|error| format!("failed to convert byte length: {error}"))?,
        relative_path,
        created_at: chrono::Utc::now().to_rfc3339(),
    };

    let connection: Connection = open_connection(&app)?;

    connection
        .execute(
            "
        INSERT INTO media (
            id,
            file_name,
            original_name,
            mime_type,
            size_bytes,
            relative_path,
            created_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        ",
            params![
                media.id,
                media.file_name,
                media.original_name,
                media.mime_type,
                media.size_bytes,
                media.relative_path,
                media.created_at
            ],
        )
        .map_err(|error| format!("failed to insert media bytes record: {error}"))?;

    Ok(media)
}

#[tauri::command]
pub fn save_note_preview(
    app: AppHandle,
    note_id: String,
    image_data_url: String,
) -> Result<String, String> {
    let base64_data: &str = image_data_url
        .split(',')
        .nth(1)
        .ok_or_else(|| "invalid image data url".to_string())?;

    let image_bytes: Vec<u8> = STANDARD
        .decode(base64_data)
        .map_err(|error| format!("failed to decode preview base64: {error}"))?;

    let thumbnails_dir: PathBuf = get_thumbnails_dir(&app)?;
    let file_name: String = format!("{note_id}.png");
    let file_path: PathBuf = thumbnails_dir.join(&file_name);

    fs::write(&file_path, image_bytes)
        .map_err(|error| format!("failed to write preview file: {error}"))?;

    let relative_path: String = format!("thumbnails/{file_name}");

    Ok(relative_path)
}

#[tauri::command]
pub fn get_note_preview_file_path(
    app: AppHandle,
    note_id: String,
) -> Result<Option<String>, String> {
    let thumbnails_dir: PathBuf = get_thumbnails_dir(&app)?;
    let file_path: PathBuf = thumbnails_dir.join(format!("{note_id}.png"));

    if !file_path.exists() {
        return Ok(None);
    }

    Ok(Some(file_path.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn get_calendar_task_by_id(
    app: AppHandle,
    task_id: String,
) -> Result<Option<CalendarTaskRecord>, String> {
    let connection: Connection = open_connection(&app)?;

    let mut statement = connection
        .prepare(
            "
            SELECT id, title, description, start, end, color
            FROM calendar_tasks
            WHERE id = ?1
            ",
        )
        .map_err(|error| format!("failed to prepare get_calendar_task_by_id: {error}"))?;

    let mut rows = statement
        .query(params![task_id])
        .map_err(|error| format!("failed to query calendar task: {error}"))?;

    let row_option = rows
        .next()
        .map_err(|error| format!("failed to read calendar task row: {error}"))?;

    if let Some(row) = row_option {
        let task: CalendarTaskRecord = CalendarTaskRecord {
            id: row
                .get(0)
                .map_err(|error| format!("failed to read id: {error}"))?,
            title: row
                .get(1)
                .map_err(|error| format!("failed to read title: {error}"))?,
            description: row
                .get(2)
                .map_err(|error| format!("failed to read description: {error}"))?,
            start: row
                .get(3)
                .map_err(|error| format!("failed to read start: {error}"))?,
            end: row
                .get(4)
                .map_err(|error| format!("failed to read end: {error}"))?,
            color: row
                .get(5)
                .map_err(|error| format!("failed to read color: {error}"))?,
        };

        return Ok(Some(task));
    }

    Ok(None)
}

#[tauri::command]
pub fn get_all_calendar_tasks(app: AppHandle) -> Result<Vec<CalendarTaskRecord>, String> {
    let connection: Connection = open_connection(&app)?;

    let mut statement = connection
        .prepare(
            "
            SELECT id, title, description, start, end, color
            FROM calendar_tasks
            ORDER BY datetime(start) ASC
            ",
        )
        .map_err(|error| format!("failed to prepare get_all_calendar_tasks: {error}"))?;

    let task_iterator = statement
        .query_map([], |row| {
            let task: CalendarTaskRecord = CalendarTaskRecord {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                start: row.get(3)?,
                end: row.get(4)?,
                color: row.get(5)?,
            };

            Ok(task)
        })
        .map_err(|error| format!("failed to query all calendar tasks: {error}"))?;

    let mut tasks: Vec<CalendarTaskRecord> = Vec::new();

    for task_result in task_iterator {
        let task: CalendarTaskRecord =
            task_result.map_err(|error| format!("failed to read calendar task row: {error}"))?;

        tasks.push(task);
    }

    Ok(tasks)
}

#[tauri::command]
pub fn get_calendar_tasks_between_dates(
    app: AppHandle,
    range_start: String,
    range_end: String,
) -> Result<Vec<CalendarTaskRecord>, String> {
    let connection: Connection = open_connection(&app)?;

    let normalized_range_start: String =
        parse_and_validate_iso_datetime(&range_start, "range_start")?;
    let normalized_range_end: String = parse_and_validate_iso_datetime(&range_end, "range_end")?;

    let parsed_range_start: chrono::DateTime<chrono::FixedOffset> =
        chrono::DateTime::parse_from_rfc3339(&normalized_range_start)
            .map_err(|error| format!("invalid range_start datetime: {error}"))?;

    let parsed_range_end: chrono::DateTime<chrono::FixedOffset> =
        chrono::DateTime::parse_from_rfc3339(&normalized_range_end)
            .map_err(|error| format!("invalid range_end datetime: {error}"))?;

    if parsed_range_end <= parsed_range_start {
        return Err("range_end must be after range_start".to_string());
    }

    let mut statement = connection
        .prepare(
            "
            SELECT id, title, description, start, end, color
            FROM calendar_tasks
            WHERE datetime(start) < datetime(?2)
              AND datetime(end) > datetime(?1)
            ORDER BY datetime(start) ASC
            ",
        )
        .map_err(|error| format!("failed to prepare get_calendar_tasks_between_dates: {error}"))?;

    let task_iterator = statement
        .query_map(
            params![normalized_range_start, normalized_range_end],
            |row| {
                let task: CalendarTaskRecord = CalendarTaskRecord {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    description: row.get(2)?,
                    start: row.get(3)?,
                    end: row.get(4)?,
                    color: row.get(5)?,
                };

                Ok(task)
            },
        )
        .map_err(|error| format!("failed to query calendar tasks between dates: {error}"))?;

    let mut tasks: Vec<CalendarTaskRecord> = Vec::new();

    for task_result in task_iterator {
        let task: CalendarTaskRecord =
            task_result.map_err(|error| format!("failed to read calendar task row: {error}"))?;

        tasks.push(task);
    }

    Ok(tasks)
}

#[tauri::command]
pub fn upsert_calendar_task(
    app: AppHandle,
    task: UpsertCalendarTaskPayload,
) -> Result<CalendarTaskRecord, String> {
    let connection: Connection = open_connection(&app)?;

    let task_id: String = match task.id {
        Some(value) if !value.trim().is_empty() => value,
        _ => Uuid::new_v4().to_string(),
    };

    let normalized_start: String = parse_and_validate_iso_datetime(&task.start, "start")?;
    let normalized_end: String = parse_and_validate_iso_datetime(&task.end, "end")?;

    let parsed_start: chrono::DateTime<chrono::FixedOffset> =
        chrono::DateTime::parse_from_rfc3339(&normalized_start)
            .map_err(|error| format!("invalid start datetime: {error}"))?;

    let parsed_end: chrono::DateTime<chrono::FixedOffset> =
        chrono::DateTime::parse_from_rfc3339(&normalized_end)
            .map_err(|error| format!("invalid end datetime: {error}"))?;

    if parsed_end <= parsed_start {
        return Err("task end must be after task start".to_string());
    }

    let calendar_task: CalendarTaskRecord = CalendarTaskRecord {
        id: task_id,
        title: task.title,
        description: task.description,
        start: normalized_start,
        end: normalized_end,
        color: task.color,
    };

    connection
        .execute(
            "
            INSERT INTO calendar_tasks (
                id,
                title,
                description,
                start,
                end,
                color
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                description = excluded.description,
                start = excluded.start,
                end = excluded.end,
                color = excluded.color
            ",
            params![
                calendar_task.id,
                calendar_task.title,
                calendar_task.description,
                calendar_task.start,
                calendar_task.end,
                calendar_task.color
            ],
        )
        .map_err(|error| format!("failed to upsert calendar task: {error}"))?;

    Ok(calendar_task)
}

#[tauri::command]
pub fn delete_calendar_task(app: AppHandle, task_id: String) -> Result<(), String> {
    let connection: Connection = open_connection(&app)?;

    let deleted_rows: usize = connection
        .execute(
            "
            DELETE FROM calendar_tasks
            WHERE id = ?1
            ",
            params![task_id],
        )
        .map_err(|error| format!("failed to delete calendar task: {error}"))?;

    if deleted_rows == 0 {
        return Err("calendar task not found".to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn get_app_setting(app: AppHandle, key: String) -> Result<Option<AppSettingRecord>, String> {
    let connection: Connection = open_connection(&app)?;

    let mut statement = connection
        .prepare(
            "
            SELECT key, value, updated_at
            FROM app_settings
            WHERE key = ?1
            ",
        )
        .map_err(|error| format!("failed to prepare get_app_setting: {error}"))?;

    let mut rows = statement
        .query(params![key])
        .map_err(|error| format!("failed to query app setting: {error}"))?;

    let row_option = rows
        .next()
        .map_err(|error| format!("failed to read app setting row: {error}"))?;

    if let Some(row) = row_option {
        let setting: AppSettingRecord = AppSettingRecord {
            key: row
                .get(0)
                .map_err(|error| format!("failed to read setting key: {error}"))?,
            value: row
                .get(1)
                .map_err(|error| format!("failed to read setting value: {error}"))?,
            updated_at: row
                .get(2)
                .map_err(|error| format!("failed to read setting updated_at: {error}"))?,
        };

        return Ok(Some(setting));
    }

    Ok(None)
}

#[tauri::command]
pub fn set_app_setting(app: AppHandle, key: String, value: String) -> Result<(), String> {
    let connection: Connection = open_connection(&app)?;
    let now: String = chrono::Utc::now().to_rfc3339();

    connection
        .execute(
            "
            INSERT INTO app_settings (
                key,
                value,
                updated_at
            )
            VALUES (?1, ?2, ?3)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = excluded.updated_at
            ",
            params![key, value, now],
        )
        .map_err(|error| format!("failed to set app setting: {error}"))?;

    Ok(())
}

fn get_directory_size_bytes(path: &PathBuf) -> Result<i64, String> {
    if !path.exists() {
        return Ok(0);
    }

    let mut total_size: i64 = 0;

    let entries: fs::ReadDir = fs::read_dir(path)
        .map_err(|error| format!("failed to read directory size: {error}"))?;

    for entry_result in entries {
        let entry: fs::DirEntry =
            entry_result.map_err(|error| format!("failed to read directory entry: {error}"))?;

        let entry_path: PathBuf = entry.path();
        let metadata: fs::Metadata = fs::metadata(&entry_path)
            .map_err(|error| format!("failed to read file metadata: {error}"))?;

        if metadata.is_dir() {
            total_size += get_directory_size_bytes(&entry_path)?;
        } else {
            let file_size: i64 = i64::try_from(metadata.len())
                .map_err(|error| format!("failed to convert file size: {error}"))?;

            total_size += file_size;
        }
    }

    Ok(total_size)
}

#[tauri::command]
pub fn get_storage_usage(app: AppHandle) -> Result<StorageUsageRecord, String> {
    let app_data_dir: PathBuf = get_app_data_dir(&app)?;
    let media_dir: PathBuf = get_media_dir(&app)?;
    let thumbnails_dir: PathBuf = get_thumbnails_dir(&app)?;

    let media_bytes: i64 = get_directory_size_bytes(&media_dir)?;
    let thumbnails_bytes: i64 = get_directory_size_bytes(&thumbnails_dir)?;
    let total_bytes: i64 = media_bytes + thumbnails_bytes;

    Ok(StorageUsageRecord {
        app_data_path: app_data_dir.to_string_lossy().to_string(),
        media_path: media_dir.to_string_lossy().to_string(),
        thumbnails_path: thumbnails_dir.to_string_lossy().to_string(),
        media_bytes,
        thumbnails_bytes,
        total_bytes,
    })
}