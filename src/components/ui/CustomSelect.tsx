import { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select an option...",
  disabled = false,
  className = "",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const handleClose = useCallback(() => setIsOpen(false), []);

  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropdownEstimatedHeight = 240;

    // Prefer opening downwards unless space below is tight and there is more room above
    const openUpwards = spaceBelow < dropdownEstimatedHeight && spaceAbove > spaceBelow;
    const maxHeight = openUpwards
      ? Math.min(240, Math.max(120, spaceAbove - 16))
      : Math.min(240, Math.max(120, spaceBelow - 16));

    const popoverWidth = Math.max(rect.width, 200);
    const left = Math.max(8, Math.min(rect.left, viewportWidth - popoverWidth - 8));

    if (openUpwards) {
      setCoords({
        bottom: viewportHeight - rect.top + 4,
        left,
        width: popoverWidth,
        maxHeight,
      });
    } else {
      setCoords({
        top: rect.bottom + 4,
        left,
        width: popoverWidth,
        maxHeight,
      });
    }
  }, []);

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  // Re-position when scrolling or resizing (capture phase to catch scrolling inside any modal/div)
  useLayoutEffect(() => {
    if (!isOpen) {
      setCoords(null);
      return;
    }

    updatePosition();

    function handleScrollOrResize() {
      updatePosition();
    }

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  // Close on click outside & Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        handleClose();
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // Stop immediate propagation so that parent modal's Escape handler
        // does not also fire and close the entire modal when dismissing this dropdown.
        e.stopImmediatePropagation();
        handleClose();
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleClose]);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        title={
          selectedOption
            ? `${selectedOption.label}${selectedOption.description ? ` ${selectedOption.description}` : ""}`
            : placeholder
        }
        className={`flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-container)] px-3 py-2 text-left text-xs transition-colors cursor-pointer focus:border-[var(--primary)] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed hover:border-[var(--border)]/80 ${
          isOpen ? "border-[var(--primary)] ring-1 ring-[var(--primary)]/30" : ""
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedOption?.icon && (
            <span className="shrink-0">{selectedOption.icon}</span>
          )}
          <span
            className={`truncate font-medium shrink-0 max-w-[65%] ${
              selectedOption ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"
            }`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.description && (
            <span className="truncate text-[11px] font-mono text-[var(--text-muted)] flex-1">
              {selectedOption.description}
            </span>
          )}
        </div>

        <ChevronDown
          size={14}
          className={`shrink-0 text-[var(--text-muted)] transition-transform duration-150 ${
            isOpen ? "rotate-180 text-[var(--primary)]" : ""
          }`}
        />
      </button>

      {/* Popover Menu rendered via Portal to prevent container clipping / overflow issues */}
      {isOpen &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              top: coords.top !== undefined ? `${coords.top}px` : undefined,
              bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              maxHeight: `${coords.maxHeight}px`,
              zIndex: 9999,
            }}
            className="overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface-low)]/98 p-1.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-75 text-xs select-none"
          >
            {options.length === 0 ? (
              <div className="px-3 py-2 text-center text-xs text-[var(--text-muted)]">
                No options available
              </div>
            ) : (
              options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    title={`${opt.label}${opt.description ? ` ${opt.description}` : ""}`}
                    className={`flex w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-[var(--primary)]/15 text-[var(--primary)] font-semibold"
                        : "text-[var(--text-primary)] hover:bg-[var(--surface-high)]"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                      <span className="truncate">{opt.label}</span>
                      {opt.description && (
                        <span className="truncate text-[10px] font-mono text-[var(--text-muted)]">
                          {opt.description}
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <Check size={13} className="shrink-0 text-[var(--primary)]" />
                    )}
                  </button>
                );
              })
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
