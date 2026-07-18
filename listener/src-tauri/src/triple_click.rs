// PS-button triple-click detector. Fires when 3 rising edges land within WINDOW.

use std::collections::VecDeque;
use std::time::{Duration, Instant};

/// Max span for all three presses. 600ms is a comfortable "quick triple" — tune in
/// Unit A verification (too tight = missed triggers, too loose = accidental).
const WINDOW: Duration = Duration::from_millis(600);
const NEEDED: usize = 3;

pub struct ClickTracker {
    presses: VecDeque<Instant>,
}

impl ClickTracker {
    pub fn new() -> Self {
        Self { presses: VecDeque::with_capacity(NEEDED) }
    }

    /// Feed one poll tick. Pass `true` only on the rising edge of the PS button.
    /// Returns `true` exactly once when a triple-click completes (and resets).
    pub fn feed(&mut self, rising_edge: bool) -> bool {
        let now = Instant::now();

        // Drop presses older than the window.
        while let Some(&front) = self.presses.front() {
            if now.duration_since(front) > WINDOW {
                self.presses.pop_front();
            } else {
                break;
            }
        }

        if rising_edge {
            self.presses.push_back(now);
            if self.presses.len() >= NEEDED {
                self.presses.clear();
                return true;
            }
        }
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread::sleep;

    #[test]
    fn three_fast_presses_fire() {
        let mut t = ClickTracker::new();
        assert!(!t.feed(true));
        assert!(!t.feed(true));
        assert!(t.feed(true)); // third within window
    }

    #[test]
    fn slow_presses_do_not_fire() {
        let mut t = ClickTracker::new();
        assert!(!t.feed(true));
        sleep(Duration::from_millis(700));
        assert!(!t.feed(true));
        sleep(Duration::from_millis(700));
        assert!(!t.feed(true)); // each aged out — never 3 in window
    }
}
