// Single entry point for "an action landed" feedback — call navFeedback() for
// light nav ticks (focus moved, swipe accepted) and selectFeedback() for
// committed actions (tile opened, tab switched). Respects the independent
// sound/haptics toggles in Settings so either can be muted without the other.

import { invoke } from "@tauri-apps/api/core";
import { getFeedbackSettings } from "./settings";
import { playBack, playError, playLaunch, playNavTick, playSelect, playStartupChime, playTabSwitch, playToggle } from "./sound";

export function navFeedback() {
  const { soundEnabled, hapticsEnabled } = getFeedbackSettings();
  if (hapticsEnabled) void invoke("haptic_confirm");
  if (soundEnabled) playNavTick();
}

export function selectFeedback() {
  const { soundEnabled, hapticsEnabled } = getFeedbackSettings();
  if (hapticsEnabled) void invoke("haptic_select");
  if (soundEnabled) playSelect();
}

/**
 * Back / cancel — the counterpart to selectFeedback, which was previously
 * silent. Haptics stay light here: going back is a lesser action than
 * committing to one, and the feedback should say so.
 */
export function backFeedback() {
  const { soundEnabled, hapticsEnabled } = getFeedbackSettings();
  if (hapticsEnabled) void invoke("haptic_confirm");
  if (soundEnabled) playBack();
}

/** Tab switch. `direction` is +1 right / -1 left so the sound tracks travel. */
export function tabFeedback(direction: number) {
  const { soundEnabled, hapticsEnabled } = getFeedbackSettings();
  if (hapticsEnabled) void invoke("haptic_select");
  if (soundEnabled) playTabSwitch(direction);
}

/** Settings switch flipped. Two-state, so on and off are distinguishable. */
export function toggleFeedback(on: boolean) {
  const { soundEnabled, hapticsEnabled } = getFeedbackSettings();
  if (hapticsEnabled) void invoke("haptic_confirm");
  if (soundEnabled) playToggle(on);
}

/**
 * Something wasn't available (OpenRGB missing, a bridge failed). Deliberately
 * sound-only and soft — no haptic, because buzzing the pad for a thing the
 * user couldn't have known about reads as a scolding.
 */
export function errorFeedback() {
  if (getFeedbackSettings().soundEnabled) playError();
}

/** Committed to opening something — the swell under the exit animation. */
export function launchFeedback() {
  const { soundEnabled, hapticsEnabled } = getFeedbackSettings();
  if (hapticsEnabled) void invoke("haptic_select");
  if (soundEnabled) playLaunch();
}

/** Entering Home — the console "power-on" moment. A two-stage haptic (a firm
 * select followed by a softer confirm) plus the boot chime. Respects the same
 * independent sound/haptics toggles as the other feedback. */
export function startupFeedback() {
  const { soundEnabled, hapticsEnabled } = getFeedbackSettings();
  if (hapticsEnabled) {
    void invoke("haptic_select");
    setTimeout(() => void invoke("haptic_confirm"), 150);
  }
  if (soundEnabled) playStartupChime();
}
