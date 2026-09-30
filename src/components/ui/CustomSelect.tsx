import { useState, useRef, useEffect, useCallback } from "react";
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

  const selectedOption = options.find((opt) => opt.value === value);

  const handleClose = useCallback(() => setIsOpen(false), []);

  // Close on click outside & Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
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
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-container)] px-3 py-2 text-left text-xs transition-colors cursor-pointer focus:border-[var(--primary)] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed hover:border-[var(--border)]/80 ${
          isOpen ? "border-[var(--primary)] ring-1 ring-[var(--primary)]/30" : ""
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedOption?.icon && (
            <span className="shrink-0">{selectedOption.icon}</span>
          )}
          <span
            className={`truncate font-medium ${
              selectedOption ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"
            }`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.description && (
            <span className="truncate text-[11px] font-mono text-[var(--text-muted)]">
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

      {/* Popover Menu */}
      {isOpen && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-full min-w-[200px] max-h-60 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface-low)]/98 p-1.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-75 text-xs select-none"
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
        </div>
      )}
    </div>
  );
}
