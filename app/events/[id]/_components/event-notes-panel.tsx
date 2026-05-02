"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type SaveState = "idle" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 1000;
const SAVED_DISPLAY_MS = 1500;

type EventNotesPanelProps = {
  value: string;
  onChange: (value: string) => void;
  onAutoSave?: () => Promise<void> | void;
  placeholder?: string;
  label?: string;
  minHeightClassName?: string;
  bare?: boolean;
};

export function EventNotesPanel({
  value,
  onChange,
  onAutoSave,
  placeholder = "Write notes here...",
  minHeightClassName = "min-h-[220px]",
  bare = false,
}: EventNotesPanelProps) {
  const [saveState, setSaveState] = React.useState<SaveState>("idle");

  const debounceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always holds the latest onAutoSave — prevents stale closures inside the timer
  const onAutoSaveRef = React.useRef(onAutoSave);
  React.useEffect(() => {
    onAutoSaveRef.current = onAutoSave;
  }, [onAutoSave]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  const handleChange = React.useCallback(
    (newValue: string) => {
      onChange(newValue);

      // Reset visible status while user is still typing
      setSaveState("idle");

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }

      if (!onAutoSaveRef.current) return;

      debounceTimer.current = setTimeout(async () => {
        setSaveState("saving");
        try {
          await onAutoSaveRef.current?.();
          setSaveState("saved");

          if (savedTimer.current) clearTimeout(savedTimer.current);
          savedTimer.current = setTimeout(
            () => setSaveState("idle"),
            SAVED_DISPLAY_MS,
          );
        } catch {
          setSaveState("error");
        }
      }, DEBOUNCE_MS);
    },
    [onChange],
  );

  const Wrapper: React.ElementType = bare ? "div" : Card;
  const wrapperClassName = bare
    ? "px-4 pb-3 pt-3"
    : "rounded-[24px] border border-[var(--border)] bg-[var(--surface-2)] p-3 shadow-none";
  const innerClassName = bare
    ? `${minHeightClassName} px-1 pb-1 pt-1`
    : `${minHeightClassName} rounded-[22px] bg-[var(--surface-3)] px-4 pb-4 pt-3`;

  return (
    <Wrapper className={wrapperClassName}>
      <div className={innerClassName}>
        <Input
          value={value}
          onChange={(event) => handleChange(event.target.value)}
          placeholder={placeholder}
          className="h-9 w-full rounded-none border-none bg-transparent px-1 py-0 text-[15px] leading-5.5 text-(--text-default) shadow-none placeholder:text-(--text-muted) focus-visible:ring-0"
        />
        {saveState !== "idle" && (
          <p
            className={`mt-1 text-[11px] leading-none ${
              saveState === "saving"
                ? "text-(--text-muted)"
                : saveState === "saved"
                  ? "text-green-500"
                  : "text-red-500"
            }`}
          >
            {saveState === "saving"
              ? "Saving…"
              : saveState === "saved"
                ? "Saved"
                : "Failed to save"}
          </p>
        )}
      </div>
    </Wrapper>
  );
}
