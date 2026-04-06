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
  return (
    <span className="min-w-0 max-w-[132px] sm:max-w-[146px]">
      <span
        className={cn(
          "mb-0.5 flex h-[14px] text-[11px] font-medium text-[var(--text-muted)]",
          showMetaIcon ? "items-center justify-center" : "items-center gap-1",
        )}
      >
        {showMetaIcon ? <ArrowUpDown className="size-3" /> : null}
        {!showMetaIcon && meta ? <span className="truncate">{meta}</span> : null}
      </span>
      <span
        className={cn(
          "block truncate font-poppins font-semibold text-[var(--text-strong)]",
          showMetaIcon
            ? "text-[16px] tabular-nums tracking-[0.1em] sm:text-[17px]"
            : "text-[15px] tracking-[0.02em] sm:text-[16px]",
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
            showMetaIcon={kind === "time"}
          />
        </span>
      ) : (
        <span className="grid min-w-0 grid-cols-[minmax(0,132px)_18px_minmax(0,132px)] items-center gap-1.5 sm:grid-cols-[minmax(0,146px)_22px_minmax(0,146px)] sm:gap-3">
          <RangeColumn
            meta={kind === "date" ? startColumn.meta : undefined}
            label={startColumn.label}
            placeholder={startColumn.placeholder}
            showMetaIcon={kind === "time"}
          />
          <span className="text-center text-[20px] leading-none text-[var(--text-muted)]">
            -
          </span>
          <RangeColumn
            meta={kind === "date" ? endColumn.meta : undefined}
            label={endColumn.label}
            placeholder={endColumn.placeholder}
            showMetaIcon={kind === "time"}
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
