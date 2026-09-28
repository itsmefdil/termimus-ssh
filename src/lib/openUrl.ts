import { openUrl } from "@tauri-apps/plugin-opener";

/**
 * Safely opens an external URL using Tauri's opener plugin,
 * falling back to window.open if running in standard browser/dev preview.
 */
export async function openExternalUrl(url: string): Promise<void> {
  try {
    await openUrl(url);
  } catch (err) {
    console.warn("Failed to open URL via @tauri-apps/plugin-opener, falling back to window.open", err);
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
