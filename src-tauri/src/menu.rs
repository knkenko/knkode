use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::AppHandle;

pub const MENU_CHECK_UPDATES: &str = "check_updates";

/// Build the native application menu (macOS only — called inside `#[cfg(target_os = "macos")]`).
///
/// macOS: App name (with "Check for Updates…") + Edit + View + Window
pub fn build_menu(handle: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let edit_menu = Submenu::with_items(
        handle,
        "Edit",
        true,
        // Cut & Copy omitted — they intercept Cmd+C / Cmd+X at the OS menu level
        // before the keydown event reaches the WebView, breaking canvas-based
        // terminal copy. The webview handles copy/cut via keydown handlers instead.
        &[
            &PredefinedMenuItem::undo(handle, None)?,
            &PredefinedMenuItem::redo(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::paste(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::select_all(handle, None)?,
        ],
    )?;

    #[cfg(target_os = "macos")]
    let view_menu = Submenu::with_items(
        handle,
        "View",
        true,
        &[&PredefinedMenuItem::fullscreen(handle, None)?],
    )?;

    #[cfg(target_os = "macos")]
    let window_menu = Submenu::with_items(
        handle,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(handle, None)?,
            &PredefinedMenuItem::maximize(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::close_window(handle, None)?,
        ],
    )?;

    #[cfg(not(target_os = "macos"))]
    let window_menu = Submenu::with_items(
        handle,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(handle, None)?,
            &PredefinedMenuItem::close_window(handle, None)?,
        ],
    )?;

    #[cfg(target_os = "macos")]
    let menu = {
        let app_name = handle.config().product_name.as_deref().unwrap_or("knkode");

        let check_updates = MenuItem::with_id(
            handle,
            MENU_CHECK_UPDATES,
            "Check for Updates…",
            true,
            None::<&str>,
        )?;

        let app_menu = Submenu::with_items(
            handle,
            app_name,
            true,
            &[
                &PredefinedMenuItem::about(handle, None, None)?,
                &check_updates,
                &PredefinedMenuItem::separator(handle)?,
                &PredefinedMenuItem::services(handle, None)?,
                &PredefinedMenuItem::separator(handle)?,
                &PredefinedMenuItem::hide(handle, None)?,
                &PredefinedMenuItem::hide_others(handle, None)?,
                &PredefinedMenuItem::show_all(handle, None)?,
                &PredefinedMenuItem::separator(handle)?,
                &PredefinedMenuItem::quit(handle, None)?,
            ],
        )?;

        Menu::with_items(handle, &[&app_menu, &edit_menu, &view_menu, &window_menu])?
    };

    #[cfg(not(target_os = "macos"))]
    let menu = Menu::with_items(handle, &[&edit_menu, &window_menu])?;

    Ok(menu)
}
