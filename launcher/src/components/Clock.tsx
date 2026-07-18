// Live clock, top-right — every console home screen (PS5, Xbox) has this;
// Apple TV omits it but ours has a TV plugged into a PC, so it's genuinely useful
// glanced at from bed, not just decoration.

import { useEffect, useState } from "react";

export function Clock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const date = now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

  return (
    <div style={{ textAlign: "right", color: "var(--muted)" }}>
      <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text)" }}>{time}</div>
      <div style={{ fontSize: "0.85rem" }}>{date}</div>
    </div>
  );
}
