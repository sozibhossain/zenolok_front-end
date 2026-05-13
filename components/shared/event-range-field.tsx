"use client";

import { format, isValid, parseISO } from "date-fns";
import { ArrowUpDown, CalendarDays, Clock3 } from "lucide-react";

import { formatTimeStringByPreference } from "@/lib/time-format";
import { cn } from "@/lib/utils";

type EventRangeFieldProps = {
  kind: "date" | "time";
  startValue?: string | null;
  endValue?: string | null;
  use24Hour?: boolean;
  collapseSingleValue?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  interactive?: boolean;
  className?: string;
};

type EventSingleFieldProps = {
  kind: "date" | "time";
  label: string;
  className?: string;
};

export type EventDateTimeRangeFieldProps = {
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  use24Hour?: boolean;
  isAllDay?: boolean;
  collapseSingleTimeValue?: boolean;
  onDateClick?: () => void;
  onTimeClick?: () => void;
  dateDisabled?: boolean;
  timeDisabled?: boolean;
  allDayToggle?: React.ReactNode;
  className?: string;
};

type RangeDisplayValue = {
  label: string;
  placeholder: boolean;
  meta?: string;
};

function parseDateLabel(
  value?: string | null,
  fallbackLabel = "Select",
): RangeDisplayValue {
  if (!value) {
    return { meta: "", label: fallbackLabel, placeholder: true };
  }

  const parsed = parseISO(value);
  if (!isValid(parsed)) {
    return { meta: "", label: value, placeholder: false };
  }

  return {
    meta: format(parsed, "EEEE"),
    label: format(parsed, "dd MMM yyyy").toUpperCase(),
    placeholder: false,
  };
}

function parseTimeLabel(
  value: string | null | undefined,
  use24Hour: boolean,
  fallbackLabel: string,
): RangeDisplayValue {
  if (!value) {
    return { label: fallbackLabel, placeholder: true };
  }

  const formatted = formatTimeStringByPreference(value, use24Hour);
  return {
    label: (formatted || value).toUpperCase(),
    placeholder: false,
  };
}

function RangeColumn({
  meta,
  label,
  placeholder,
  showMetaIcon,
}: {
  meta?: string;
  label: string;
  placeholder?: boolean;
  showMetaIcon?: boolean;
}) {
  if (showMetaIcon) {
    return (
      <span className="flex min-w-0 max-w-[132px] flex-col items-center justify-center gap-0.5 sm:max-w-[146px]">
        <ArrowUpDown className="size-3 shrink-0 text-[var(--text-muted)]" />
        <span
          className={cn(
            "block truncate font-poppins font-semibold tabular-nums tracking-[0.1em] text-[var(--text-strong)] text-[16px] sm:text-[17px]",
            placeholder ? "text-[var(--text-muted)]" : "",
          )}
        >
          {label}
        </span>
      </span>
    );
  }

  return (
    <span className="min-w-0 max-w-[132px] sm:max-w-[146px]">
      <span className="mb-0.5 flex h-[14px] items-center gap-1 text-[11px] font-medium text-[var(--text-muted)]">
        {meta ? <span className="truncate">{meta}</span> : null}
      </span>
      <span
        className={cn(
          "block truncate font-poppins text-[15px] font-semibold tracking-[0.02em] text-[var(--text-strong)] sm:text-[16px]",
          placeholder ? "text-[var(--text-muted)]" : "",
        )}
      >
        {label}
      </span>
    </span>
  );
}

export function EventRangeField({
  kind,
  startValue,
  endValue,
  use24Hour = false,
  collapseSingleValue = false,
  onClick,
  disabled,
  interactive = true,
  className,
}: EventRangeFieldProps) {
  const Icon = kind === "date" ? CalendarDays : Clock3;
  const isSingleDate = kind === "date" && Boolean(startValue) && startValue === endValue;
  const showSingleColumn = kind === "date" ? isSingleDate : collapseSingleValue;
  const startColumn =
    kind === "date"
      ? parseDateLabel(startValue, "Start date")
      : parseTimeLabel(startValue, use24Hour, "Start time");
  const endColumn =
    kind === "date"
      ? parseDateLabel(endValue, "End date")
      : parseTimeLabel(endValue, use24Hour, "End time");

  const content = (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)]">
        <Icon className="size-[18px]" />
      </span>
      {showSingleColumn ? (
        <span className="min-w-0">
          <RangeColumn
            meta={kind === "date" ? startColumn.meta : undefined}
            label={startColumn.label}
            placeholder={startColumn.placeholder}
            showMetaIcon={false}
          />
        </span>
      ) : (
        <span className="grid min-w-0 grid-cols-[minmax(0,132px)_18px_minmax(0,132px)] items-center gap-1.5 sm:grid-cols-[minmax(0,146px)_22px_minmax(0,146px)] sm:gap-3">
          <RangeColumn
            meta={kind === "date" ? startColumn.meta : undefined}
            label={startColumn.label}
            placeholder={startColumn.placeholder}
            showMetaIcon={kind === "time" && !startColumn.placeholder && !endColumn.placeholder}
          />
          <span className="text-center text-[20px] leading-none text-[var(--text-muted)]">
            -
          </span>
          <RangeColumn
            meta={kind === "date" ? endColumn.meta : undefined}
            label={endColumn.label}
            placeholder={endColumn.placeholder}
            showMetaIcon={kind === "time" && !startColumn.placeholder && !endColumn.placeholder}
          />
        </span>
      )}
    </>
  );

  if (!interactive) {
    return (
      <div
        className={cn(
          "inline-flex max-w-full items-center gap-2.5 rounded-2xl px-1 py-1 text-left",
          className,
        )}
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={kind === "date" ? "Choose event dates" : "Choose event time"}
      className={cn(
        "group inline-flex max-w-full items-center gap-2.5 rounded-2xl px-1 py-1 text-left transition hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-transparent",
        className,
      )}
    >
      {content}
    </button>
  );
}

export function EventSingleField({
  kind,
  label,
  className,
}: EventSingleFieldProps) {
  const Icon = kind === "date" ? CalendarDays : Clock3;

  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center gap-2.5 rounded-2xl px-1 py-1 text-left",
        className,
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)]">
        <Icon className="size-[18px]" />
      </span>
      <span className="font-poppins text-[16px] font-semibold text-[var(--text-strong)]">
        {label}
      </span>
    </div>
  );
}

/**
 * Unified date + time range display.
 *
 * Renders both the date row and the time row inside a single 3-column grid so
 * the centre separator (–) spans the full height and stays perfectly centred
 * regardless of AM/PM visibility or text height changes.
 *
 * Layout:
 *   [CalendarDays icon] [start-date / start-time]  |  [–]  |  [end-date / end-time]
 *                                                              [Clock3 icon on left]
 */
export function EventDateTimeRangeField({
  startDate,
  endDate,
  startTime,
  endTime,
  use24Hour = false,
  isAllDay = false,
  collapseSingleTimeValue = false,
  onDateClick,
  onTimeClick,
  dateDisabled,
  timeDisabled,
  allDayToggle,
  className,
}: EventDateTimeRangeFieldProps) {
  const isSingleDate =
    Boolean(startDate) && startDate === endDate;
  const showSingleDateColumn = isSingleDate;
  const showSingleTimeColumn = isAllDay || collapseSingleTimeValue;

  const startDateCol = parseDateLabel(startDate, "Start date");
  const endDateCol = parseDateLabel(endDate, "End date");
  const startTimeCol = parseTimeLabel(startTime, use24Hour, "Start time");
  const endTimeCol = parseTimeLabel(endTime, use24Hour, "End time");

  const hasTimeValues = !startTimeCol.placeholder && !endTimeCol.placeholder;

  // Each side (start/end) stacks: weekday meta, date, then time
  function StartBlock() {
    return (
      <span className="flex min-w-0 flex-col">
        {/* date part — clickable */}
        <button
          type="button"
          onClick={onDateClick}
          disabled={dateDisabled}
          className="group rounded-xl px-1 py-0.5 text-left transition hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-transparent"
          aria-label="Choose event dates"
        >
          <span className="mb-0.5 flex h-[14px] items-center gap-1 text-[11px] font-medium text-[var(--text-muted)]">
            {startDateCol.meta ? (
              <span className="truncate">{startDateCol.meta}</span>
            ) : null}
          </span>
          <span
            className={cn(
              "block truncate font-poppins text-[15px] font-semibold tracking-[0.02em] text-[var(--text-strong)] sm:text-[16px]",
              startDateCol.placeholder ? "text-[var(--text-muted)]" : "",
            )}
          >
            {startDateCol.label}
          </span>
        </button>

        {/* time part — clickable */}
        {isAllDay ? (
          <span className="px-1 py-0.5">
            <span className="block font-poppins text-[15px] font-semibold text-[var(--text-muted)] sm:text-[16px]">
              All day
            </span>
          </span>
        ) : (
          <button
            type="button"
            onClick={onTimeClick}
            disabled={timeDisabled}
            className="group rounded-xl px-1 py-0.5 text-left transition hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-transparent"
            aria-label="Choose event time"
          >
            {hasTimeValues ? (
              <span className="mb-0.5 flex h-[14px] items-center justify-start">
                <ArrowUpDown className="size-3 text-[var(--text-muted)]" />
              </span>
            ) : (
              <span className="mb-0.5 flex h-[14px] items-center" />
            )}
            <span
              className={cn(
                "block truncate font-poppins font-semibold tabular-nums tracking-[0.1em] text-[var(--text-strong)] text-[16px] sm:text-[17px]",
                startTimeCol.placeholder ? "text-[var(--text-muted)]" : "",
              )}
            >
              {startTimeCol.label}
            </span>
          </button>
        )}
      </span>
    );
  }

  function EndBlock() {
    if (showSingleDateColumn) {
      return null;
    }

    return (
      <span className="flex min-w-0 flex-col">
        {/* date part */}
        <button
          type="button"
          onClick={onDateClick}
          disabled={dateDisabled}
          className="group rounded-xl px-1 py-0.5 text-left transition hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-transparent"
          aria-label="Choose event dates"
        >
          <span className="mb-0.5 flex h-[14px] items-center gap-1 text-[11px] font-medium text-[var(--text-muted)]">
            {endDateCol.meta ? (
              <span className="truncate">{endDateCol.meta}</span>
            ) : null}
          </span>
          <span
            className={cn(
              "block truncate font-poppins text-[15px] font-semibold tracking-[0.02em] text-[var(--text-strong)] sm:text-[16px]",
              endDateCol.placeholder ? "text-[var(--text-muted)]" : "",
            )}
          >
            {endDateCol.label}
          </span>
        </button>

        {/* time part */}
        {isAllDay ? (
          <span className="px-1 py-0.5">
            <span className="block font-poppins text-[15px] font-semibold text-[var(--text-muted)] sm:text-[16px]">
              All day
            </span>
          </span>
        ) : (
          <button
            type="button"
            onClick={onTimeClick}
            disabled={timeDisabled}
            className="group rounded-xl px-1 py-0.5 text-left transition hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-transparent"
            aria-label="Choose event time"
          >
            {hasTimeValues ? (
              <span className="mb-0.5 flex h-[14px] items-center justify-start">
                <ArrowUpDown className="size-3 text-[var(--text-muted)]" />
              </span>
            ) : (
              <span className="mb-0.5 flex h-[14px] items-center" />
            )}
            <span
              className={cn(
                "block truncate font-poppins font-semibold tabular-nums tracking-[0.1em] text-[var(--text-strong)] text-[16px] sm:text-[17px]",
                endTimeCol.placeholder ? "text-[var(--text-muted)]" : "",
              )}
            >
              {endTimeCol.label}
            </span>
          </button>
        )}
      </span>
    );
  }

  return (
    <div className={cn("flex max-w-full items-start gap-2.5 px-1 py-1", className)}>
      {/* Left icons column */}
      <span className="flex shrink-0 flex-col items-center gap-0">
        <span className="flex size-8 items-center justify-center rounded-full text-[var(--text-muted)]">
          <CalendarDays className="size-[18px]" />
        </span>
        <span className="flex size-8 items-center justify-center rounded-full text-[var(--text-muted)]">
          <Clock3 className="size-[18px]" />
        </span>
      </span>

      {/* Main content: start | separator | end */}
      {showSingleDateColumn ? (
        /* Single-date mode: no separator, just a single stacked column */
        <StartBlock />
      ) : (
        <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_16px_minmax(0,1fr)] items-stretch gap-x-1.5 sm:gap-x-3">
          {/* Start column */}
          <StartBlock />

          {/* Centre separator — full height, always centred */}
          <span className="flex items-center justify-center self-stretch">
            <span className="text-[20px] leading-none text-[var(--text-muted)]">-</span>
          </span>

          {/* End column */}
          <EndBlock />
        </span>
      )}

      {/* All-day toggle slot (optional) */}
      {allDayToggle ? (
        <span className="ml-auto shrink-0 self-center">{allDayToggle}</span>
      ) : null}
    </div>
  );
}
