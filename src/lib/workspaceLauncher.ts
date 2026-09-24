import { useSessionStore } from "../stores/useSessionStore";
import { useHostStore } from "../stores/useHostStore";
import { WorkspacePreset } from "../stores/useWorkspaceStore";
import { Host } from "./api";

/**
 * Deterministically launches a WorkspacePreset by setting up the entire
 * split layout tree atomically in one go, ensuring all panes mount with
 * their exact final quadrant dimensions (preventing startup SIGWINCH resize artifacts).
 */
export async function launchWorkspacePreset(preset: WorkspacePreset): Promise<boolean> {
  const { hosts } = useHostStore.getState();
  const sessionStore = useSessionStore.getState();

  if (preset.nodes.length === 0) return false;

  // Resolve all hosts in order
  const validNodes: { paneIndex: number; host: Host }[] = [];
  for (const node of preset.nodes) {
    const host = hosts.find((h) => h.id === node.hostId);
    if (host) {
      validNodes.push({ paneIndex: node.paneIndex, host });
    }
  }

  if (validNodes.length === 0) {
    throw new Error("No valid hosts found for this workspace preset.");
  }

  // Atomically initialize the entire cluster group and its split tree in 1 render
  sessionStore.openClusterGroup(validNodes, preset.layout, preset.broadcastOnLaunch);
  return true;
}
