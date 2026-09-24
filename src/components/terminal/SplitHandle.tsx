import { useState, useRef, useCallback } from "react";
import { SplitDirection } from "../../lib/layoutTree";
import { useSessionStore } from "../../stores/useSessionStore";

interface SplitHandleProps {
  splitId: string;
  direction: SplitDirection;
  parentRef: React.RefObject<HTMLDivElement | null>;
}

export function SplitHandle({ splitId, direction, parentRef }: SplitHandleProps) {
  const setSplitRatio = useSessionStore((s) => s.setSplitRatio);
  const [isDragging, setIsDragging] = useState(false);
  const handleRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging || !parentRef.current) return;
      const rect = parentRef.current.getBoundingClientRect();

      let newRatio: number;
      if (direction === "row") {
        newRatio = ((e.clientX - rect.left) / rect.width) * 100;
      } else {
        newRatio = ((e.clientY - rect.top) / rect.height) * 100;
      }

      setSplitRatio(splitId, newRatio);
    },
    [isDragging, parentRef, direction, splitId, setSplitRatio]
  );

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      setIsDragging(false);
    }
  };

  const isRow = direction === "row";

  return (
    <>
      <div
        ref={handleRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`group relative z-30 shrink-0 transition-colors select-none ${
          isRow
            ? "w-1.5 h-full cursor-col-resize hover:bg-[var(--primary)]"
            : "h-1.5 w-full cursor-row-resize hover:bg-[var(--primary)]"
        } ${isDragging ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`}
      >
        {/* Subtle center line indicator */}
        <div
          className={`absolute inset-0 m-auto rounded-full bg-[var(--text-muted)] opacity-40 group-hover:opacity-100 transition-opacity ${
            isRow ? "w-[2px] h-6" : "h-[2px] w-6"
          } ${isDragging ? "bg-white opacity-100" : ""}`}
        />
      </div>

      {/* Global transparent cover during drag to prevent iframe/canvas pointer stealing */}
      {isDragging && (
        <div
          className={`fixed inset-0 z-50 ${
            isRow ? "cursor-col-resize" : "cursor-row-resize"
          }`}
          style={{ pointerEvents: "all" }}
        />
      )}
    </>
  );
}
