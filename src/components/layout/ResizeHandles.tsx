import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

// Since the window is frameless (decorations: false), the OS provides no
// native resize border/cursor at the window edges. These invisible handles
// restore that behavior via Tauri's startResizeDragging API.
const EDGE = 6; // px, hit-target size for straight edges
const CORNER = 10; // px, hit-target size for corner handles

const edgeHandles: {
  direction:
    | "North"
    | "South"
    | "East"
    | "West"
    | "NorthEast"
    | "NorthWest"
    | "SouthEast"
    | "SouthWest";
  className: string;
  cursor: string;
}[] = [
  { direction: "North", cursor: "n-resize", className: "top-0 left-0 right-0" },
  { direction: "South", cursor: "s-resize", className: "bottom-0 left-0 right-0" },
  { direction: "West", cursor: "w-resize", className: "top-0 bottom-0 left-0" },
  { direction: "East", cursor: "e-resize", className: "top-0 bottom-0 right-0" },
];

const cornerHandles: {
  direction: "NorthWest" | "NorthEast" | "SouthWest" | "SouthEast";
  cursor: string;
  className: string;
}[] = [
  { direction: "NorthWest", cursor: "nwse-resize", className: "top-0 left-0" },
  { direction: "NorthEast", cursor: "nesw-resize", className: "top-0 right-0" },
  { direction: "SouthWest", cursor: "nesw-resize", className: "bottom-0 left-0" },
  { direction: "SouthEast", cursor: "nwse-resize", className: "bottom-0 right-0" },
];

export function ResizeHandles() {
  async function startResize(direction: (typeof edgeHandles)[number]["direction"]) {
    try {
      await appWindow.startResizeDragging(direction);
    } catch {
      // ignore, e.g. window is maximized/fullscreen
    }
  }

  return (
    <>
      {edgeHandles.map(({ direction, cursor, className }) => (
        <div
          key={direction}
          onMouseDown={() => startResize(direction)}
          className={`fixed z-50 ${className}`}
          style={{
            [direction === "North" || direction === "South" ? "height" : "width"]: EDGE,
            cursor,
          }}
        />
      ))}
      {cornerHandles.map(({ direction, cursor, className }) => (
        <div
          key={direction}
          onMouseDown={() => startResize(direction)}
          className={`fixed z-50 ${className}`}
          style={{ width: CORNER, height: CORNER, cursor }}
        />
      ))}
    </>
  );
}
