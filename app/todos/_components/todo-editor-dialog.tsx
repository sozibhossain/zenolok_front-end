"use client";

import * as React from "react";
import { format } from "date-fns";
import { CheckCircle2, ChevronDown, Bell, CalendarDays, ChevronLeft, Clock3, Repeat2, Trash2 } from "lucide-react";

import { useAppState } from "@/components/providers/app-state-provider";
import { EventDateRangePopup, EventTimeRangePopup } from "@/components/shared/event-date-time-popups";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  formatTimeStringByPreference,
} from "@/lib/time-format";
import type { AlarmPresetKey } from "@/lib/api";

export type TodoEditorMode = "create" | "edit";
export type RepeatValue = "daily" | "weekly" | "monthly" | "yearly";
export type TodoAlarmPreset = AlarmPresetKey;

const ALARM_PRESET_OPTIONS: Array<{ id: TodoAlarmPreset; label: string }> = [
  { id: "none", label: "No alert" },
  { id: "preset_1", label: "Preset 1" },
  { id: "preset_2", label: "Preset 2" },
  { id: "preset_3", label: "Preset 3" },
];

const ALARM_PRESET_LABELS: Record<TodoAlarmPreset, string> = {
  none: "No alert",
  preset_1: "Preset 1",
  preset_2: "Preset 2",
  preset_3: "Preset 3",
};

function formatDateDisplay(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return format(date, "MM/dd/yyyy");
}

function formatTimeDisplay(value: string, use24Hour: boolean) {
  if (!value) {
    return "";
  }

  return formatTimeStringByPreference(value, use24Hour);
}

type TodoEditorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: TodoEditorMode;
  todoText: string;
  onTodoTextChange: (value: string) => void;
  onSubmit: () => void;
  canSubmit: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  onDelete: () => void;
  isDeleting: boolean;
  dateEnabled: boolean;
  onDateEnabledChange: (checked: boolean) => void;
  scheduledDateInput: string;
  onScheduledDateChange: (value: string) => void;
  timeEnabled: boolean;
  onTimeEnabledChange: (checked: boolean) => void;
  scheduledTimeInput: string;
  onScheduledTimeChange: (value: string) => void;
  alarmPreset: TodoAlarmPreset;
  onAlarmPresetChange: (value: TodoAlarmPreset) => void;
  repeatEnabled: boolean;
  onRepeatEnabledChange: (checked: boolean) => void;
  repeatValue: RepeatValue;
  onRepeatValueChange: (value: RepeatValue) => void;
};

export function TodoEditorDialog({
  open,
  onOpenChange,
  mode,
  todoText,
  onTodoTextChange,
  onSubmit,
  canSubmit,
  isCreating,
  isUpdating,
  onDelete,
  isDeleting,
  dateEnabled,
  onDateEnabledChange,
  scheduledDateInput,
  onScheduledDateChange,
  timeEnabled,
  onTimeEnabledChange,
  scheduledTimeInput,
  onScheduledTimeChange,
  alarmPreset,
  onAlarmPresetChange,
  repeatEnabled,
  onRepeatEnabledChange,
  repeatValue,
  onRepeatValueChange,
}: TodoEditorDialogProps) {
  const { preferences } = useAppState();
  const [datePopupOpen, setDatePopupOpen] = React.useState(false);
  const [timePopupOpen, setTimePopupOpen] = React.useState(false);
  const [alarmPresetOpen, setAlarmPresetOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[820px] rounded-[30px] border border-[var(--ui-dialog-border)] bg-[var(--ui-dialog-bg)] p-4 text-[var(--text-default)] sm:p-5">
        {mode === "create" ? (
          <div className="rounded-[30px] border border-[var(--border)] bg-[var(--surface-1)] p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2 text-[var(--text-default)]">
              <button
                type="button"
                aria-label="Back to category"
                onClick={() => onOpenChange(false)}
                className="inline-flex items-center justify-center text-[var(--text-muted)]"
              >
                <ChevronLeft className="size-5" />
              </button>
              <Input
                value={todoText}
                onChange={(event) => onTodoTextChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onSubmit();
                  }
                }}
                placeholder="New todo"
                className="h-11 border border-[var(--ui-input-border)] bg-[var(--ui-input-bg)] text-[24px] leading-[120%] text-[var(--ui-input-text)] placeholder:text-[var(--ui-input-placeholder)]"
              />
            </div>

            <div className="mt-4 flex items-center justify-end">
              <Button type="button" onClick={onSubmit} disabled={!canSubmit || isCreating}>
                {isCreating ? "Adding..." : "Add"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-[30px] border border-[var(--border)] bg-[var(--surface-1)] p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2 text-[var(--text-default)]">
              <button
                type="button"
                aria-label="Back to category"
                onClick={() => onOpenChange(false)}
                className="inline-flex items-center justify-center text-[var(--text-muted)]"
              >
                <ChevronLeft className="size-5" />
              </button>
              <Input
                value={todoText}
                onChange={(event) => onTodoTextChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onSubmit();
                  }
                }}
                className="h-10 border-none bg-transparent px-0 text-[36px] leading-[120%] text-[var(--text-default)] shadow-none"
              />
            </div>

            <div className="space-y-3 text-[var(--text-muted)]">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-[30px] leading-[120%]">
                  <CalendarDays className="size-5" />
                  <span>Date</span>
                </div>
                <Switch checked={dateEnabled} onCheckedChange={onDateEnabledChange} />
              </div>
              {dateEnabled ? (
                <button
                  type="button"
                  onClick={() => setDatePopupOpen(true)}
                  className="flex h-12 w-full items-center justify-between rounded-xl border border-[var(--ui-input-border)] bg-[var(--ui-input-bg)] px-4"
                >
                  <span
                    className={`text-[24px] leading-[120%] ${
                      scheduledDateInput ? "text-[var(--ui-input-text)]" : "text-[var(--ui-input-placeholder)]"
                    }`}
                  >
                    {scheduledDateInput ? formatDateDisplay(scheduledDateInput) : "MM/DD/YYYY"}
                  </span>
                  <CalendarDays className="size-6 text-[var(--text-default)]" />
                </button>
              ) : null}

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-[30px] leading-[120%]">
                  <Clock3 className="size-5" />
                  <span>Time</span>
                </div>
                <Switch checked={timeEnabled} onCheckedChange={onTimeEnabledChange} />
              </div>
              {timeEnabled ? (
                <button
                  type="button"
                  onClick={() => setTimePopupOpen(true)}
                  className="flex h-12 w-full items-center justify-between rounded-xl border border-[var(--ui-input-border)] bg-[var(--ui-input-bg)] px-4"
                >
                  <span
                    className={`text-[24px] leading-[120%] ${
                      scheduledTimeInput ? "text-[var(--ui-input-text)]" : "text-[var(--ui-input-placeholder)]"
                    }`}
                  >
                    {scheduledTimeInput ? formatTimeDisplay(scheduledTimeInput, preferences.use24Hour) : "Set time"}
                  </span>
                  <Clock3 className="size-6 text-[var(--text-default)]" />
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setAlarmPresetOpen(true)}
                className="flex w-full items-center justify-between gap-4 text-left"
              >
                <div className="flex items-center gap-2 text-[30px] leading-[120%]">
                  <Bell className="size-5" />
                  <span>Alarm</span>
                </div>
                <div className="flex items-center gap-2 text-[18px] leading-[120%] text-[var(--text-muted)]">
                  <span>{ALARM_PRESET_LABELS[alarmPreset]}</span>
                  <ChevronDown className="size-4" />
                </div>
              </button>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-[30px] leading-[120%]">
                  <Repeat2 className="size-5" />
                  <span>Repeat</span>
                </div>
                <Switch checked={repeatEnabled} onCheckedChange={onRepeatEnabledChange} />
              </div>
              {repeatEnabled ? (
                <select
                  value={repeatValue}
                  onChange={(event) => onRepeatValueChange(event.target.value as RepeatValue)}
                  className="h-12 w-full rounded-xl border border-[var(--ui-input-border)] bg-[var(--ui-input-bg)] px-3 text-[16px] text-[var(--ui-input-text)]"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              ) : null}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                className="text-[var(--text-muted)] hover:text-[var(--text-default)]"
                onClick={onDelete}
                disabled={isDeleting}
              >
                <Trash2 className="size-4" />
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-[var(--text-muted)] hover:text-[var(--text-default)]"
                onClick={onSubmit}
                disabled={!canSubmit || isUpdating}
              >
                {isUpdating ? "Updating..." : "Update todo"}
              </Button>
            </div>

            <EventDateRangePopup
              open={datePopupOpen}
              onOpenChange={setDatePopupOpen}
              startDate={scheduledDateInput}
              endDate={scheduledDateInput}
              selectionMode="single"
              onApply={({ startDate }) => onScheduledDateChange(startDate)}
            />
            <EventTimeRangePopup
              open={timePopupOpen}
              onOpenChange={setTimePopupOpen}
              startTime={scheduledTimeInput}
              endTime={scheduledTimeInput}
              selectionMode="single"
              onApply={({ startTime }) => onScheduledTimeChange(startTime)}
            />
            <Dialog open={alarmPresetOpen} onOpenChange={setAlarmPresetOpen}>
              <DialogContent className="max-w-[380px] rounded-[26px] border-[var(--ui-popover-border)] bg-[var(--ui-popover-bg)] p-4 text-[var(--text-default)]">
                <div className="space-y-3">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 text-[var(--text-default)]"
                    onClick={() => setAlarmPresetOpen(false)}
                  >
                    <ChevronLeft className="size-4" />
                    <span className="text-[30px] leading-[120%]">Select Alarm</span>
                  </button>

                  <div className="space-y-2 rounded-[22px] bg-[var(--surface-2)] p-3">
                    {ALARM_PRESET_OPTIONS.map((option) => {
                      const active = alarmPreset === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => {
                            onAlarmPresetChange(option.id);
                            setAlarmPresetOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition ${
                            active
                              ? "border-[#31C65B] bg-[color:rgba(49,198,91,0.10)]"
                              : "border-transparent bg-[var(--surface-2)] hover:border-[var(--border)]"
                          }`}
                        >
                          <span className="font-poppins text-[20px] leading-[120%] font-medium text-[var(--text-default)]">
                            {option.label}
                          </span>
                          {active ? (
                            <CheckCircle2 className="size-5 text-[#31C65B]" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
