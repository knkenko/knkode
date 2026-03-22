use crate::config::ConfigStore;
use serde_json::json;
use std::sync::mpsc;
use std::time::Duration;
use tauri::Manager;
use tauri::{WebviewUrl, WebviewWindowBuilder};

const DEBOUNCE_MS: u64 = 500;
const MIN_WINDOW_WIDTH: f64 = 600.0;
const MIN_WINDOW_HEIGHT: f64 = 400.0;

/// Create the main window programmatically with platform-conditional settings,
/// apply effects, restore bounds, and show.
pub fn setup_window(app: &tauri::App) {
    let window = match create_window(app) {
        Ok(w) => w,
        Err(e) => {
            eprintln!("[window] Failed to create main window: {e}");
            return;
        }
    };

    apply_effects(&window);
    restore_bounds(app, &window);
    start_bounds_watcher(app, &window);

    if let Err(e) = window.show() {
        eprintln!("[window] Failed to show window: {e}");
    }
}

/// Build the main window with platform-specific configuration.
/// On macOS: transparent + overlay title bar + traffic light positioning.
/// On Windows: opaque + standard decorations (no extended frame gap).
fn create_window(app: &tauri::App) -> tauri::Result<tauri::WebviewWindow> {
    let mut builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
        .title("knkode")
        .inner_size(1200.0, 800.0)
        .min_inner_size(MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT)
        .decorations(true)
        .visible(false)
        .shadow(true);

    #[cfg(target_os = "macos")]
    {
        builder = builder
            .transparent(true)
            .title_bar_style(tauri::TitleBarStyle::Overlay)
            .hidden_title(true)
            .traffic_light_position(tauri::LogicalPosition::new(17.0, 24.0));
    }

    builder.build()
}

/// Apply platform-specific window effects.
fn apply_effects(window: &tauri::WebviewWindow) {
    #[cfg(target_os = "macos")]
    {
        use tauri::window::{Effect, EffectsBuilder};

        let effects = EffectsBuilder::new()
            .effect(Effect::UnderWindowBackground)
            .build();
        if let Err(e) = window.set_effects(effects) {
            eprintln!("[window] Failed to set window effect: {e}");
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
        if let Err(e) = window.set_maximizable(true) {
            eprintln!("[window] Failed to set maximizable: {e}");
        }
        if let Err(e) = window.set_resizable(true) {
            eprintln!("[window] Failed to set resizable: {e}");
        }
    }

    // Suppress unused variable warning on other platforms
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let _ = window;
}

/// Restore window position and size from app-state.json.
fn restore_bounds(app: &tauri::App, window: &tauri::WebviewWindow) {
    let config = app.state::<ConfigStore>();
    let state = match config.get_app_state() {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[window] Failed to read app state for bounds restore: {e}");
            return;
        }
    };

    let Some(bounds) = state.get("windowBounds") else {
        return;
    };

    let width = bounds.get("width").and_then(|v| v.as_f64());
    let height = bounds.get("height").and_then(|v| v.as_f64());
    let x = bounds.get("x").and_then(|v| v.as_f64());
    let y = bounds.get("y").and_then(|v| v.as_f64());

    // Clamp to reasonable range: min from tauri.conf.json, max covers 8K displays
    const MAX_DIMENSION: f64 = 16384.0;
    if let (Some(w), Some(h)) = (width, height) {
        let w = w.clamp(MIN_WINDOW_WIDTH, MAX_DIMENSION);
        let h = h.clamp(MIN_WINDOW_HEIGHT, MAX_DIMENSION);
        let _ = window.set_size(tauri::LogicalSize::new(w, h));
    }

    if let (Some(x), Some(y)) = (x, y) {
        if is_position_visible(window, x, y) {
            let _ = window.set_position(tauri::LogicalPosition::new(x, y));
        }
    }
}

/// Check if position falls within any connected monitor's bounds.
fn is_position_visible(window: &tauri::WebviewWindow, x: f64, y: f64) -> bool {
    let monitors = match window.available_monitors() {
        Ok(m) => m,
        Err(_) => return true, // can't check — allow the restore
    };
    if monitors.is_empty() {
        return true;
    }
    for monitor in &monitors {
        let pos = monitor.position();
        let size = monitor.size();
        let scale = monitor.scale_factor();
        // Convert monitor bounds to logical coordinates
        let mx = pos.x as f64 / scale;
        let my = pos.y as f64 / scale;
        let mw = size.width as f64 / scale;
        let mh = size.height as f64 / scale;
        // Window origin must land within the monitor (with some margin)
        if x >= mx - 100.0 && x < mx + mw && y >= my - 100.0 && y < my + mh {
            return true;
        }
    }
    false
}

/// Watch for resize/move events and save bounds with debounced writes.
fn start_bounds_watcher(app: &tauri::App, window: &tauri::WebviewWindow) {
    let (tx, rx) = mpsc::channel::<()>();
    let window_clone = window.clone();
    let app_handle = app.handle().clone();

    // Event handler: notify the debounce thread on resize/move
    window.on_window_event(move |event| {
        if matches!(
            event,
            tauri::WindowEvent::Resized(_) | tauri::WindowEvent::Moved(_)
        ) {
            let _ = tx.send(());
        }
    });

    // Background thread: debounce then save
    if let Err(e) = std::thread::Builder::new()
        .name("bounds-watcher".into())
        .spawn(move || {
            let config = app_handle.state::<ConfigStore>();
            loop {
                // Block until first event
                if rx.recv().is_err() {
                    break; // channel closed
                }
                // Drain events until quiet
                loop {
                    match rx.recv_timeout(Duration::from_millis(DEBOUNCE_MS)) {
                        Ok(()) => continue,                            // more events — keep waiting
                        Err(mpsc::RecvTimeoutError::Timeout) => break, // quiet — save
                        Err(mpsc::RecvTimeoutError::Disconnected) => return,
                    }
                }
                save_bounds(&window_clone, &config);
            }
        })
    {
        eprintln!("[window] Failed to spawn bounds-watcher thread: {e}");
    }
}

/// Persist current window bounds (logical units) to app-state.json.
fn save_bounds(window: &tauri::WebviewWindow, config: &ConfigStore) {
    let Ok(size) = window.outer_size() else {
        eprintln!("[window] Failed to get window size");
        return;
    };
    let Ok(position) = window.outer_position() else {
        eprintln!("[window] Failed to get window position");
        return;
    };
    let Ok(scale) = window.scale_factor() else {
        eprintln!("[window] Failed to get scale factor");
        return;
    };
    if scale <= 0.0 {
        eprintln!("[window] Invalid scale factor: {scale}");
        return;
    }

    // Save as logical (DPI-independent) values for cross-monitor consistency
    let bounds = json!({
        "width": (size.width as f64 / scale).round(),
        "height": (size.height as f64 / scale).round(),
        "x": (position.x as f64 / scale).round(),
        "y": (position.y as f64 / scale).round(),
    });

    if let Err(e) = config.update_app_state_field("windowBounds", bounds) {
        eprintln!("[window] Failed to save window bounds: {e}");
    }
}
