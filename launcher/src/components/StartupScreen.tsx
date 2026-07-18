import { IdleScreen } from "./IdleScreen";

/** Uses the exact idle-screen visual language for the console entry gate. */
export function StartupScreen({ ready, leaving }: { ready: boolean; leaving: boolean }) {
  return <IdleScreen startup leaving={leaving} message={ready ? "Press the PS button to start" : "Preparing console..."} />;
}
