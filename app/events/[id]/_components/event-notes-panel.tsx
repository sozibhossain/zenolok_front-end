"use client";

import { Card } from "@/components/ui/card";

type EventNotesPanelProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  isSaving?: boolean;
};

export function EventNotesPanel({
  value,
  onChange,
  onBlur,
  isSaving = false,
}: EventNotesPanelProps) {
  return (
    <Card className="mt-3 rounded-[22px] border border-[var(--border)] bg-[var(--surface-2)] p-3.5 shadow-none">
      <div className="rounded-[22px] bg-[var(--surface-3)] p-3">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder="Write notes here..."
          className="min-h-[220px] w-full resize-none border-none bg-transparent px-1 py-1 text-[15px] leading-[22px] text-[var(--text-default)] placeholder:text-[var(--text-muted)] focus:outline-none"
        />
        <div className="mt-2 flex justify-end">
          <span className="text-[11px] text-[var(--text-muted)]">
            {isSaving ? "Saving..." : "Notes"}
          </span>
        </div>
      </div>
    </Card>
  );
}
