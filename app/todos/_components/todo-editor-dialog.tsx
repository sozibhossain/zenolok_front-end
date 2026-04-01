"use client";

import * as React from "react";
import { format } from "date-fns";
import { Bell, CalendarDays, ChevronLeft, Clock3, Repeat2, Trash2 } from "lucide-react";

import { EventDateRangePopup, EventTimeRangePopup } from "@/components/shared/event-date-time-popups";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export type TodoEditorMode = "create" | "edit";
export type RepeatValue = "daily" | "weekly" | "monthly" | "yearly";

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

function formatTimeDisplay(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(`1970-01-01T${value}:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return format(date, "hh:mm a");
}

function formatDateTimeDisplay(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return format(date, "MM/dd/yyyy hh:mm a");
}

function getDateFromDateTimeInput(value: string) {
  if (!value) {
    return "";
  }

  const rawDate = value.slice(0, 10);
  if (rawDate.length === 10) {
    return rawDate;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return format(parsed, "yyyy-MM-dd");
}

function getTimeFromDateTimeInput(value: string) {
  if (!value) {
    return "";
  }

  const rawTime = value.slice(11, 16);
  if (rawTime.length === 5) {
    return rawTime;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return format(parsed, "HH:mm");
}

function mergeDateAndTime(dateValue: string, timeValue: string) {
  if (!dateValue && !timeValue) {
    return "";
  }

  const safeDate = dateValue || format(new Date(), "yyyy-MM-dd");
  const safeTime = timeValue || "00:00";
  return `${safeDate}T${safeTime}`;
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
  alarmEnabled: boolean;
  onAlarmEnabledChange: (checked: boolean) => void;
  alarmDateTimeInput: string;
  onAlarmDateTimeChange: (value: string) => void;
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
  alarmEnabled,
  onAlarmEnabledChange,
  alarmDateTimeInput,
  onAlarmDateTimeChange,
  repeatEnabled,
  onRepeatEnabledChange,
  repeatValue,
  onRepeatValueChange,
}: TodoEditorDialogProps) {
  const [datePopupOpen, setDatePopupOpen] = React.useState(false);
  const [timePopupOpen, setTimePopupOpen] = React.useState(false);
  const [alarmDatePopupOpen, setAlarmDatePopupOpen] = React.useState(false);
  const [alarmTimePopupOpen, setAlarmTimePopupOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[820px] rounded-[30px] border border-[#DDE3EC] bg-[#F7F8FB] p-4 sm:p-5">
        {mode === "create" ? (
          <div className="rounded-[30px] border border-[#E1E5ED] bg-[#F3F5F9] p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2 text-[#4A505A]">
              <button
                type="button"
                aria-label="Back to category"
                onClick={() => onOpenChange(false)}
                className="inline-flex items-center justify-center text-[#8E95A4]"
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
                className="h-11 border border-[#D5DBE6] bg-white text-[24px] leading-[120%] text-[#4A505A]"
              />
            </div>

            <div className="mt-4 flex items-center justify-end">
              <Button type="button" onClick={onSubmit} disabled={!canSubmit || isCreating}>
                {isCreating ? "Adding..." : "Add"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-[30px] border border-[#E1E5ED] bg-[#F3F5F9] p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2 text-[#4A505A]">
              <button
                type="button"
                aria-label="Back to category"
                onClick={() => onOpenChange(false)}
                className="inline-flex items-center justify-center text-[#8E95A4]"
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
                className="h-10 border-none bg-transparent px-0 text-[36px] leading-[120%] text-[#4A505A] shadow-none"
              />
            </div>

            <div className="space-y-3 text-[#C0C6D1]">
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
                  className="flex h-12 w-full items-center justify-between rounded-xl border border-[#D5DBE6] bg-white px-4"
                >
                  <span
                    className={`text-[24px] leading-[120%] ${
                      scheduledDateInput ? "text-[#4D5463]" : "text-[#B7BFCC]"
                    }`}
                  >
                    {scheduledDateInput ? formatDateDisplay(scheduledDateInput) : "MM/DD/YYYY"}
                  </span>
                  <CalendarDays className="size-6 text-[#101621]" />
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
                  className="flex h-12 w-full items-center justify-between rounded-xl border border-[#D5DBE6] bg-white px-4"
                >
                  <span
                    className={`text-[24px] leading-[120%] ${
                      scheduledTimeInput ? "text-[#4D5463]" : "text-[#B7BFCC]"
                    }`}
                  >
                    {scheduledTimeInput ? formatTimeDisplay(scheduledTimeInput) : "Set time"}
                  </span>
                  <Clock3 className="size-6 text-[#101621]" />
                </button>
              ) : null}

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-[30px] leading-[120%]">
                  <Bell className="size-5" />
                  <span>Alarm</span>
                </div>
                <Switch checked={alarmEnabled} onCheckedChange={onAlarmEnabledChange} />
              </div>
              {alarmEnabled ? (
                <>
                  <button
                    type="button"
                    onClick={() => setAlarmDatePopupOpen(true)}
                    className="flex h-12 w-full items-center justify-between rounded-xl border border-[#D5DBE6] bg-white px-4"
                  >
                    <span
                      className={`text-[24px] leading-[120%] ${
                        alarmDateTimeInput ? "text-[#4D5463]" : "text-[#B7BFCC]"
                      }`}
                    >
                      {alarmDateTimeInput ? formatDateTimeDisplay(alarmDateTimeInput) : "MM/DD/YYYY hh:mm A"}
                    </span>
                    <CalendarDays className="size-6 text-[#101621]" />
                  </button>
                </>
              ) : null}

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
                  className="h-12 w-full rounded-xl border border-[#D5DBE6] bg-white px-3 text-[16px] text-[#5A6070]"
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
                className="text-[#B4BAC7] hover:text-[#8D94A3]"
                onClick={onDelete}
                disabled={isDeleting}
              >
                <Trash2 className="size-4" />
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-[#B4BAC7] hover:text-[#8D94A3]"
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
            <EventDateRangePopup
              open={alarmDatePopupOpen}
              onOpenChange={setAlarmDatePopupOpen}
              startDate={getDateFromDateTimeInput(alarmDateTimeInput)}
              endDate={getDateFromDateTimeInput(alarmDateTimeInput)}
              onApply={({ startDate }) => {
                const currentTime = getTimeFromDateTimeInput(alarmDateTimeInput);
                onAlarmDateTimeChange(mergeDateAndTime(startDate, currentTime));
                setAlarmDatePopupOpen(false);
                setAlarmTimePopupOpen(true);
              }}
            />
            <EventTimeRangePopup
              open={alarmTimePopupOpen}
              onOpenChange={setAlarmTimePopupOpen}
              startTime={getTimeFromDateTimeInput(alarmDateTimeInput)}
              endTime={getTimeFromDateTimeInput(alarmDateTimeInput)}
              selectionMode="single"
              onApply={({ startTime }) => {
                const currentDate = getDateFromDateTimeInput(alarmDateTimeInput);
                onAlarmDateTimeChange(mergeDateAndTime(currentDate, startTime));
                setAlarmTimePopupOpen(false);
              }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
