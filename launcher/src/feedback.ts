// Single entry point for "an action landed" feedback — call navFeedback() for
// light nav ticks (focus moved, swipe accepted) and selectFeedback() for
// committed actions (tile opened, tab switched). Respects the independent
// sound/haptics toggles in Settings so either can be muted without the other.

import { invoke } from "@tauri-apps/api/core";
import { getFeedbackSettings } from "./settings";
import { playNavTick, playSelect } from "./sound";

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
