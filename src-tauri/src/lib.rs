mod note_db;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let show_item: MenuItem<tauri::Wry> =
                MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;

            let quit_item: MenuItem<tauri::Wry> =
                MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            let menu: Menu<tauri::Wry> = Menu::with_items(app, &[&show_item, &quit_item])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    let Some(window) = app.get_webview_window("main") else {
                        return;
                    };

                    match event.id.as_ref() {
                        "show" => {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();

                        let Some(window) = app.get_webview_window("main") else {
                            return;
                        };

                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            note_db::get_note_by_id,
            note_db::upsert_note,
            note_db::import_media,
            note_db::get_media_by_id,
            note_db::get_all_notes,
            note_db::get_media_file_path,
            note_db::get_latest_note,
            note_db::delete_note,
            note_db::import_media_bytes,
            note_db::save_note_preview,
            note_db::get_note_preview_file_path,
            note_db::get_calendar_task_by_id,
            note_db::get_all_calendar_tasks,
            note_db::get_calendar_tasks_between_dates,
            note_db::upsert_calendar_task,
            note_db::delete_calendar_task,
            note_db::get_app_setting,
            note_db::set_app_setting,
            note_db::get_storage_usage,
            
            note_db::get_all_dayplanner_todos,
            note_db::upsert_dayplanner_todo,
            note_db::delete_dayplanner_todo,
            note_db::get_all_dayplanner_dailies,
            note_db::upsert_dayplanner_daily,
            note_db::delete_dayplanner_daily,
            note_db::get_day_plan_items_for_day,
            note_db::upsert_day_plan_item,
            note_db::delete_day_plan_item,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
