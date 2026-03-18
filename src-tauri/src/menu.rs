use tauri::menu::{Menu, PredefinedMenuItem, Submenu};
use tauri::AppHandle;

/// Build the native application menu.
///
/// - macOS: App name (standard app menu) + Edit + View + Window
/// - Windows/Linux: Edit + Window
pub fn build_menu(handle: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let edit_menu = Submenu::with_items(
        handle,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(handle, None)?,
            &PredefinedMenuItem::redo(handle, None)?,
            &PredefinedMenuItem::separator(handle)?,
            &PredefinedMenuItem::cut(handle, None)?,
            &PredefinedMenuItem::copy(handle, None)?,
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

        let app_menu = Submenu::with_items(
            handle,
            app_name,
            true,
            &[
                &PredefinedMenuItem::about(handle, None, None)?,
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
