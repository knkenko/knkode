# Efficiency Review -- PR #15 (`feature/cwd-tracker`)

## Summary

The polling loop spawns an `lsof` subprocess **per pane every 3 seconds** to detect CWD changes, plus `git` and `gh` subprocesses on the same cadence. For N panes this is N+2 process spawns per tick, all executed **sequentially** on a single thread, meaning latency scales linearly with pane count. The mutex on `panes` is also acquired and released many times per pane per tick when a single acquisition would suffice.

## Must Fix

- **`tracker.rs:103` / `pty.rs:307-314` -- `lsof` spawned every 3 s per pane with no change-detection guard.** `detect_cwd` shells out to `lsof -p PID -Fn` on every tick regardless of whether the CWD actually changed. `lsof` is heavyweight -- it enumerates all file descriptors for the process. On macOS, `proc_pidinfo` / `proc_pidfdinfo` (via the `libproc` crate) can read just the CWD fd in-process without spawning a child. At minimum, add a `cwd_last_checked` throttle similar to `pr_last_checked` so CWD is only polled every ~1-2 s while git/PR checks happen less often, rather than everything running at the same 3 s interval.

- **`tracker.rs:90-265` -- sequential per-pane processing blocks the entire tick.** Each pane's CWD detection (`lsof`), git branch check, and PR check run sequentially. With 4 panes open, a single tick can take >1 s of wall time just from subprocess latency. The panes should be polled concurrently (e.g., `rayon::par_iter`, or spawn short-lived tasks per pane and join).

- **`tracker.rs:88` -- `gh_logged_errors: HashSet<String>` grows without bound.** Every distinct `gh pr view` stderr message is inserted and never removed. If the user's `gh` is misconfigured and produces unique error strings (e.g., containing timestamps or request IDs), this set grows indefinitely for the lifetime of the app. Cap its size or periodically clear it.

## Suggestions

- **`tracker.rs:104-132` / `140-193` / `200-224` -- excessive mutex churn on `panes`.** Within one pane's processing, the `panes` mutex is locked/unlocked 5-8 separate times (read last state, write cwd, read branch, write branch, read pr_last_checked, write pr_last_checked, read pr, write pr). Each lock/unlock is cheap in the uncontended case but adds up across N panes. Restructure to lock once at the start of each pane, clone/snapshot the state needed, unlock, do all subprocess I/O, then lock once more to apply updates and determine which events to emit.

- **`pty.rs:18-32` -- `lsof` output parsed by collecting all lines into a Vec.** `lsof` output for a process with many open file descriptors can be large. The code collects every line into a `Vec<&str>` just to find the `fcwd` entry. An iterator-based approach (`lines().skip_while(...)`) would avoid the allocation and stop reading early once the CWD line is found.

- **`tracker.rs:136` / `195` -- `git` and `gh` subprocesses inherit full environment.** `Command::new("git")` and `Command::new("gh")` only override `PATH` but inherit the full environment via the default behavior. Using `.env_clear()` followed by setting only `PATH` (and `HOME` for `gh` auth) would reduce the environment copy overhead and harden against environment injection.

- **`tracker.rs:267` -- `thread::sleep(POLL_INTERVAL)` is unconditional.** The sleep always waits 3 s after finishing all panes, regardless of how long the processing took. If processing 8 panes took 2 s of subprocess I/O, the effective cycle is 5 s, not 3 s. Use `Instant::now()` at tick start and sleep only the remaining delta, or switch to a `crossbeam::channel::recv_timeout` / `condvar::wait_timeout` pattern so the thread can wake immediately when a pane is added/removed.

- **`commands.rs:79` -- `tracker.track_pane` called before `pty_mgr.create` may succeed.** If `create` fails (e.g., shell not found), the pane is already registered in the tracker and will be polled every 3 s with a stale CWD and no valid PID, spawning useless `lsof`/`git` subprocesses until the user explicitly kills the pane. Move `track_pane` after the `create` call, or add cleanup on error.

## Nitpicks

- **`tracker.rs:362-363` -- title truncation slices on byte offset, not char boundary.** `&title[..MAX_PR_TITLE_LEN - 3]` will panic on multi-byte UTF-8 titles if the cut falls mid-character. Use `title.char_indices().take_while(|(i, _)| *i < MAX_PR_TITLE_LEN - 3)` or `title.chars().take(n).collect()`.

- **`tracker.rs:410-420` -- `build_augmented_path` double-collects.** The `missing` iterator collects into `Vec<&&str>`, then maps and collects again into `Vec<&str>` to join. A single `.filter().copied().collect::<Vec<&str>>().join(":")` avoids the intermediate allocation.
