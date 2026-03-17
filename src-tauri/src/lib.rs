pub mod terminal;

use terminal::commands::{
    create_terminal, destroy_terminal, get_terminal_state, resize_terminal, write_to_terminal,
};
use terminal::manager::TerminalManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> Result<(), Box<dyn std::error::Error>> {
    tauri::Builder::default()
        .manage(TerminalManager::new())
        .invoke_handler(tauri::generate_handler![
            create_terminal,
            destroy_terminal,
            write_to_terminal,
            resize_terminal,
            get_terminal_state,
        ])
        .run(tauri::generate_context!())?;
    Ok(())
}
