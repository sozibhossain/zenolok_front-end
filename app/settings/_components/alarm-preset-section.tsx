"use client";

import * as React from "react";
import { CheckCircle2, Clock3, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { AlarmPresetOption } from "@/lib/api";
import {
  editorValueToOffset,
  formatAlarmOffset,
  offsetToEditorValue,
  type AlarmOffsetUnit,
  type EditableAlarmPresetKey,
} from "@/lib/alarm-presets";
import { cn } from "@/lib/utils";

import { SectionHeader } from "./section-header";
import type { AlarmPreset } from "./settings-types";

interface AlarmPresetSectionProps {
  value: AlarmPreset;
  options: AlarmPresetOption[];
  onChange: (preset: AlarmPreset) => void;
  onSaveOption: (payload: {
    key: EditableAlarmPresetKey;
    offsetsInMinutes: number[];
  }) => void;
  savingKey?: EditableAlarmPresetKey | null;
}

export function AlarmPresetSection({
  value,
  options,
  onChange,
  onSaveOption,
  savingKey = null,
}: AlarmPresetSectionProps) {
  const [editingPreset, setEditingPreset] =
    React.useState<EditableAlarmPresetKey | null>(null);
  const [amount, setAmount] = React.useState("10");
  const [unit, setUnit] = React.useState<AlarmOffsetUnit>("minutes");
  const [errorMessage, setErrorMessage] = React.useState("");

  const editingOption = React.useMemo(
    () => options.find((option) => option.key === editingPreset),
    [editingPreset, options],
  );

  const openEditor = React.useCallback(
    (key: EditableAlarmPresetKey) => {
      const option = options.find((item) => item.key === key);
      const initialValue = offsetToEditorValue(option?.offsetsInMinutes?.[0]);

      setEditingPreset(key);
      setAmount(initialValue.amount);
      setUnit(initialValue.unit);
      setErrorMessage("");
    },
    [options],
  );

  const handleSave = React.useCallback(() => {
    if (!editingPreset) {
      return;
    }

    const nextOffset = editorValueToOffset(amount, unit);
    if (nextOffset === null) {
      setErrorMessage("Enter a valid reminder time.");
      return;
    }

    onSaveOption({
      key: editingPreset,
      offsetsInMinutes: [nextOffset],
    });
    setEditingPreset(null);
  }, [amount, editingPreset, onSaveOption, unit]);

  return (
    <section className="space-y-5">
      <SectionHeader
        title="Alarm preset"
        description="Pick a default reminder style, edit the built-in presets, or create your own custom reminder."
      />

      <div className="w-full settings-action-card rounded-3xl border border-[var(--border)] bg-[var(--surface-2)] p-4 sm:p-5">
        <div className="mb-4 rounded-[22px] border border-[var(--border)] bg-[var(--surface-1)] px-4 py-3">
          <p className="font-poppins text-[16px] leading-[140%] text-[var(--text-default)]">
            Each preset controls how early your todo alarm should ring before the scheduled date and time.
          </p>
        </div>

        <div className="space-y-3">
          {options.map((item) => {
            const active = value === item.key;
            const hasOffset = item.offsetsInMinutes.length > 0;
            const isSelectable = item.key !== "custom" || hasOffset || active;

            return (
              <div
                key={item.key}
                className={cn(
                  "rounded-[24px] border transition",
                  active
                    ? "border-[#31C65B] bg-[color:rgba(49,198,91,0.14)]"
                    : "border-[var(--border)] bg-[var(--surface-1)]",
                )}
              >
                <div className="flex items-start justify-between gap-4 px-4 py-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isSelectable && item.key === "custom") {
                        openEditor("custom");
                        return;
                      }

                      onChange(item.key);
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-poppins text-[20px] leading-[120%] font-medium text-[var(--text-default)]">
                          {item.label}
                        </span>
                        {!isSelectable && item.key === "custom" ? (
                          <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                            Set up first
                          </span>
                        ) : null}
                      </div>
                      <p className="max-w-[640px] text-[14px] leading-[140%] text-[var(--text-muted)]">
                        {item.description}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {hasOffset ? (
                          item.offsetsInMinutes.map((offset) => (
                            <span
                              key={`${item.key}-${offset}`}
                              className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-3 py-1 text-[12px] font-medium text-[var(--text-default)]"
                            >
                              <Clock3 className="size-3.5 text-[var(--text-muted)]" />
                              {formatAlarmOffset(offset)}
                            </span>
                          ))
                        ) : (
                          <span className="inline-flex rounded-full bg-[var(--surface-2)] px-3 py-1 text-[12px] font-medium text-[var(--text-muted)]">
                            Not configured yet
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    {item.editable ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 text-[13px] font-medium text-[var(--text-default)] shadow-[0_1px_2px_rgba(21,32,54,0.08)] hover:border-[var(--ring)] hover:bg-[var(--surface-3)] disabled:border-[var(--border)] disabled:bg-[var(--surface-1)] disabled:text-[var(--text-muted)] disabled:opacity-80"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditor(item.key as EditableAlarmPresetKey);
                        }}
                        disabled={savingKey === item.key}
                      >
                        <Pencil className="size-3.5" />
                        {item.key === "custom" && !hasOffset ? "Create custom" : "Edit"}
                      </Button>
                    ) : null}
                    {active ? (
                      <CheckCircle2 className="size-5 shrink-0 text-[#31C65B]" />
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog
        open={Boolean(editingPreset)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingPreset(null);
            setErrorMessage("");
          }
        }}
      >
        <DialogContent className="max-w-[460px] rounded-[28px] border border-[var(--ui-dialog-border)] bg-[var(--ui-dialog-bg)] p-5 text-[var(--text-default)]">
          <div className="space-y-5">
            <div className="space-y-1">
              <h3 className="font-poppins text-[30px] leading-[120%] font-semibold text-[var(--text-default)]">
                {editingOption?.label || "Edit preset"}
              </h3>
              <p className="text-[15px] leading-[145%] text-[var(--text-muted)]">
                {editingOption?.description || "Choose when the reminder should fire before the todo starts."}
              </p>
            </div>

            <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface-1)] p-4">
              <p className="mb-3 text-[13px] font-medium tracking-[0.02em] text-[var(--text-muted)] uppercase">
                Reminder timing
              </p>
              <div className="flex items-center gap-3">
                <Input
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    if (errorMessage) {
                      setErrorMessage("");
                    }
                  }}
                  inputMode="numeric"
                  className="h-12 rounded-2xl border border-[var(--ui-input-border)] bg-[var(--ui-input-bg)] text-[18px] text-[var(--ui-input-text)]"
                />
                <select
                  value={unit}
                  onChange={(event) => setUnit(event.target.value as AlarmOffsetUnit)}
                  className="h-12 min-w-[140px] rounded-2xl border border-[var(--ui-input-border)] bg-[var(--ui-input-bg)] px-3 text-[16px] text-[var(--ui-input-text)]"
                >
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </div>

              <div className="mt-4 rounded-2xl bg-[var(--surface-2)] px-4 py-3">
                <p className="text-[12px] font-medium tracking-[0.02em] text-[var(--text-muted)] uppercase">
                  Preview
                </p>
                <p className="mt-1 text-[16px] font-medium text-[var(--text-default)]">
                  {(() => {
                    const previewOffset = editorValueToOffset(amount, unit);
                    return previewOffset === null
                      ? "Enter a valid reminder time"
                      : formatAlarmOffset(previewOffset);
                  })()}
                </p>
              </div>

              {errorMessage ? (
                <p className="mt-3 text-[13px] text-[#B14E4E]">{errorMessage}</p>
              ) : null}
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                className="rounded-full px-5"
                onClick={() => {
                  setEditingPreset(null);
                  setErrorMessage("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="rounded-full px-5"
                onClick={handleSave}
                disabled={Boolean(editingPreset && savingKey === editingPreset)}
              >
                {editingPreset && savingKey === editingPreset ? "Saving..." : "Save preset"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
