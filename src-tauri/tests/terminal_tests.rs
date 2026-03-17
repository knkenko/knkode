use alacritty_terminal::event::{Event, Notify, WindowSize};
use alacritty_terminal::event_loop::{EventLoop, Notifier};
use alacritty_terminal::grid::Dimensions;
use alacritty_terminal::index::{Column, Line};
use alacritty_terminal::sync::FairMutex;
use alacritty_terminal::term::test::TermSize;
use alacritty_terminal::term::{Config as TermConfig, Term};
use alacritty_terminal::tty;
use knkode_v2_lib::terminal::event_proxy::EventProxy;
use std::sync::mpsc;
use std::sync::Arc;
use std::thread;
use std::time::Duration;

const TEST_COLS: u16 = 80;
const TEST_ROWS: u16 = 24;
const CELL_WIDTH: u16 = 8;
const CELL_HEIGHT: u16 = 16;

fn setup_terminal() -> (
    Arc<FairMutex<Term<EventProxy>>>,
    Notifier,
    mpsc::Receiver<Event>,
) {
    let (event_tx, event_rx) = mpsc::channel();
    let event_proxy = EventProxy::new(event_tx);

    let config = TermConfig::default();
    let size = TermSize::new(TEST_COLS as usize, TEST_ROWS as usize);
    let window_size = WindowSize {
        num_lines: TEST_ROWS,
        num_cols: TEST_COLS,
        cell_width: CELL_WIDTH,
        cell_height: CELL_HEIGHT,
    };

    let pty_config = tty::Options::default();
    let pty = tty::new(&pty_config, window_size, 0).expect("Failed to create PTY");

    let term = Term::new(config, &size, event_proxy.clone());
    let term = Arc::new(FairMutex::new(term));

    let event_loop = EventLoop::new(term.clone(), event_proxy, pty, false, false)
        .expect("Failed to create event loop");
    let notifier = Notifier(event_loop.channel());

    let _handle = event_loop.spawn();

    (term, notifier, event_rx)
}

fn wait_for_wakeup(event_rx: &mpsc::Receiver<Event>) -> bool {
    for _ in 0..50 {
        match event_rx.recv_timeout(Duration::from_millis(100)) {
            Ok(Event::Wakeup) => return true,
            Ok(_) => continue,
            Err(_) => continue,
        }
    }
    false
}

#[test]
fn test_pty_spawns_and_produces_output() {
    let (_term, _notifier, event_rx) = setup_terminal();

    assert!(
        wait_for_wakeup(&event_rx),
        "Expected Wakeup event from shell startup"
    );
}

#[test]
fn test_grid_has_correct_dimensions() {
    let (term, _notifier, _event_rx) = setup_terminal();

    // Give the shell a moment to start.
    thread::sleep(Duration::from_millis(200));

    let term = term.lock();
    let grid = term.grid();
    assert_eq!(grid.columns(), TEST_COLS as usize);
    assert_eq!(grid.screen_lines(), TEST_ROWS as usize);
}

#[test]
fn test_write_to_terminal_and_read_output() {
    let (term, notifier, event_rx) = setup_terminal();

    // Wait for shell to be ready.
    thread::sleep(Duration::from_millis(500));

    // Send "echo hello\n" to the PTY.
    notifier.notify(b"echo hello\n".to_vec());

    assert!(
        wait_for_wakeup(&event_rx),
        "Expected output after writing echo command"
    );

    // Give time for the grid to update.
    thread::sleep(Duration::from_millis(200));

    // Check that "hello" appears somewhere in the grid.
    let term = term.lock();
    let grid = term.grid();
    let mut found_hello = false;

    for line_idx in 0..grid.screen_lines() {
        let mut row_text = String::new();
        for col_idx in 0..grid.columns() {
            let cell = &grid[Line(line_idx as i32)][Column(col_idx)];
            row_text.push(cell.c);
        }
        if row_text.contains("hello") {
            found_hello = true;
            break;
        }
    }
    assert!(found_hello, "Expected 'hello' in terminal grid output");
}

#[test]
fn test_terminal_resize() {
    let (term, _notifier, _event_rx) = setup_terminal();

    thread::sleep(Duration::from_millis(200));

    {
        let mut term = term.lock();
        term.resize(TermSize::new(120, 40));
    }

    let term = term.lock();
    let grid = term.grid();
    assert_eq!(grid.columns(), 120);
    assert_eq!(grid.screen_lines(), 40);
}
