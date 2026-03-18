use tauri::Manager;

/// Apply platform-specific window effects and show the window.
///
/// Static config (titleBarStyle, trafficLightPosition, shadow, transparent)
/// lives in `tauri.conf.json`. This function handles effects that vary by OS:
/// - macOS: under-window vibrancy
/// - Windows: acrylic backdrop, force maximizable/resizable
/// - Linux: no effects (transparent: true in config is harmless)
pub fn setup_window(app: &tauri::App) {
    let Some(window) = app.get_webview_window("main") else {
        eprintln!("[window] Main window not found during setup");
        return;
    };

    #[cfg(target_os = "macos")]
    {
        use tauri::window::{Effect, EffectsBuilder};

        let effects = EffectsBuilder::new()
            .effect(Effect::UnderWindowBackground)
            .build();
        if let Err(e) = window.set_effects(effects) {
            eprintln!("[window] Failed to set vibrancy: {e}");
        }
    }

    #[cfg(target_os = "windows")]
    {
        use tauri::window::{Effect, EffectsBuilder};

        let effects = EffectsBuilder::new().effect(Effect::Acrylic).build();
        if let Err(e) = window.set_effects(effects) {
            eprintln!("[window] Failed to set acrylic: {e}");
        }
        // Force maximizable/resizable — acrylic can gray out window controls
        let _ = window.set_maximizable(true);
        let _ = window.set_resizable(true);
    }

    // Window starts hidden (visible: false in config) to allow bounds restore
    // before showing. Show is called here; Card 3 will move it after restore.
    if let Err(e) = window.show() {
        eprintln!("[window] Failed to show window: {e}");
    }
}
