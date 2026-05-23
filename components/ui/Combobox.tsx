"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type ComboboxOption = { value: string; label: string; sublabel?: string };

export type ComboboxProps = {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Texto accesible para el campo de búsqueda */
  inputAriaLabel?: string;
  /** Si se define, se renderiza un input hidden para envío tradicional de formularios */
  hiddenInputName?: string;
  allowFreeText?: boolean;
};

const controlClass =
  "h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_90%,var(--color-surface-2))] px-3 text-sm text-[var(--color-text-primary)] outline-none shadow-[var(--shadow-soft)] focus-visible:border-[var(--color-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]";

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Buscar…",
  disabled,
  className,
  inputAriaLabel = "Buscar y seleccionar",
  hiddenInputName,
  allowFreeText = false,
}: ComboboxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [highlight, setHighlight] = useState(0);
  // Track if user is actively typing (to filter) vs just browsing
  const [isTyping, setIsTyping] = useState(false);

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);

  const filtered = useMemo(() => {
    // Only filter when user is actively typing, otherwise show all
    if (!isTyping) return options;
    const q = inputValue.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const label = (o.label ?? "").toLowerCase();
      const sub = (o.sublabel ?? "").toLowerCase();
      return label.includes(q) || sub.includes(q);
    });
  }, [options, inputValue, isTyping]);

  const clampedHighlight = filtered.length === 0 ? 0 : Math.min(highlight, filtered.length - 1);

  const commitValue = useCallback(
    (next: string) => {
      const opt = options.find((o) => o.value === next);
      onChange(next);
      setInputValue(opt?.label ?? next);
      setIsTyping(false);
      setOpen(false);
      setHighlight(0);
    },
    [onChange, options],
  );

  const closeAndRevertInput = useCallback(() => {
    setOpen(false);
    setIsTyping(false);
    if (allowFreeText) {
      onChange(inputValue);
    } else {
      const sel = options.find((o) => o.value === value);
      setInputValue(sel?.label ?? "");
    }
  }, [options, value, allowFreeText, inputValue, onChange]);

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
      setIsTyping(false);
      if (allowFreeText) {
        onChange(inputValue);
      } else {
        const sel = options.find((o) => o.value === value);
        setInputValue(sel?.label ?? "");
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open, options, value, allowFreeText, inputValue, onChange]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeAndRevertInput();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(0, filtered.length - 1)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      if (open && filtered.length > 0) {
        e.preventDefault();
        const pick = filtered[clampedHighlight];
        if (pick) commitValue(pick.value);
      }
      return;
    }
  };

  const selectedLabel = selected?.label ?? (allowFreeText ? value : "");

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {hiddenInputName ? <input type="hidden" name={hiddenInputName} value={value} /> : null}
      <input
        type="text"
        role="combobox"
        disabled={disabled}
        autoComplete="off"
        aria-label={inputAriaLabel}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={
          open && filtered[clampedHighlight] ? `${listId}-opt-${filtered[clampedHighlight].value}` : undefined
        }
        placeholder={placeholder}
        className={controlClass}
        value={open && isTyping ? inputValue : selectedLabel}
        onChange={(e) => {
          // User is actively typing — filter results
          setInputValue(e.target.value);
          setIsTyping(true);
          setHighlight(0);
          setOpen(true);
          if (allowFreeText) {
            onChange(e.target.value);
          } else if (value) {
            onChange("");
          }
        }}
        onFocus={() => {
          // Just open the dropdown, don't clear or change the display value
          setIsTyping(false);
          setOpen(true);
        }}
        onClick={() => {
          // Click always opens dropdown without clearing
          setIsTyping(false);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />

      {open && filtered.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg"
        >
          {filtered.map((opt, idx) => (
            <li
              key={opt.value}
              id={`${listId}-opt-${opt.value}`}
              role="option"
              aria-selected={idx === clampedHighlight}
              className={cn(
                "cursor-pointer px-3 py-2 text-sm",
                idx === clampedHighlight
                  ? "bg-[var(--color-primary-soft)] text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-primary)] hover:bg-[var(--color-primary-soft)]/60",
              )}
              onMouseEnter={() => setHighlight(idx)}
              onMouseDown={(e) => {
                e.preventDefault();
                commitValue(opt.value);
              }}
            >
              <div className="font-medium">{opt.label}</div>
              {opt.sublabel ? (
                <div className="text-xs text-[var(--color-text-secondary)]">{opt.sublabel}</div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {open && filtered.length === 0 ? (
        <div className="absolute z-50 mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-secondary)] shadow-lg">
          Sin resultados
        </div>
      ) : null}
    </div>
  );
}
