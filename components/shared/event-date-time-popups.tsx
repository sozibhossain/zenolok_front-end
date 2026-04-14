"use client";

import * as React from "react";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Delete } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { useAppState } from "@/components/providers/app-state-provider";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type DateRangeValue = {
  startDate: string;
  endDate: string;
};

type DateRangePopupProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startDate: string;
  endDate: string;
  onApply: (value: DateRangeValue) => void;
  selectionMode?: "range" | "single";
};

type TimeRangeValue = {
  startTime: string;
  endTime: string;
  rollsEndToNextDay?: boolean;
};

type TimeRangePopupProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startTime: string;
  endTime: string;
  onApply: (value: TimeRangeValue) => void;
  selectionMode?: "range" | "single";
};

function parseDateValue(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function toDateValue(date: Date) {
  return format(date, "yyyy-MM-dd");
}

type Meridiem = "AM" | "PM";
type TimeDigits = [string, string, string, string];

function createEmptyTimeDigits(): TimeDigits {
  return ["", "", "", ""];
}

function toTimeDigits(value: string, use24Hour: boolean): { digits: TimeDigits; meridiem: Meridiem } {
  if (!value) {
    return { digits: createEmptyTimeDigits(), meridiem: "AM" };
  }

  const parsed = new Date(`1970-01-01T${value}:00`);
  if (Number.isNaN(parsed.getTime())) {
    return { digits: createEmptyTimeDigits(), meridiem: "AM" };
  }

  const meridiem = format(parsed, "a").toUpperCase() as Meridiem;
  const digitsString = use24Hour ? format(parsed, "HHmm") : format(parsed, "hhmm");

  return {
    digits: [
      digitsString[0] || "",
      digitsString[1] || "",
      digitsString[2] || "",
      digitsString[3] || "",
    ],
    meridiem,
  };
}

function isCompleteTimeDigits(digits: TimeDigits) {
  return digits.every((digit) => digit !== "");
}

function isValidTimeDigits(digits: TimeDigits, use24Hour: boolean) {
  if (!isCompleteTimeDigits(digits)) {
    return false;
  }

  const hour = Number(`${digits[0]}${digits[1]}`);
  const minute = Number(`${digits[2]}${digits[3]}`);

  if (use24Hour) {
    return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
  }

  return hour >= 1 && hour <= 12 && minute >= 0 && minute <= 59;
}

function isValidPartialTimeDigits(digits: TimeDigits, use24Hour: boolean) {
  if (digits.some((digit) => digit !== "" && !/^\d$/.test(digit))) {
    return false;
  }

  if (digits[0]) {
    const firstHourDigit = Number(digits[0]);
    if (firstHourDigit > (use24Hour ? 2 : 1)) {
      return false;
    }
  }

  if (digits[0] && digits[1]) {
    const hour = Number(`${digits[0]}${digits[1]}`);
    if (use24Hour) {
      if (hour > 23) {
        return false;
      }
    } else if (hour === 0 || hour > 12) {
      return false;
    }
  }

  if (digits[2] && Number(digits[2]) > 5) {
    return false;
  }

  if (digits[2] && digits[3]) {
    const minute = Number(`${digits[2]}${digits[3]}`);
    if (minute > 59) {
      return false;
    }
  }

  return true;
}

function timeDigitsToValue(
  digits: TimeDigits,
  meridiem: Meridiem,
  use24Hour: boolean,
) {
  if (!isValidTimeDigits(digits, use24Hour)) {
    return "";
  }

  const hourValue = Number(`${digits[0]}${digits[1]}`);
  const minuteValue = Number(`${digits[2]}${digits[3]}`);
  const hour24 = use24Hour
    ? hourValue
    : meridiem === "PM"
      ? (hourValue % 12) + 12
      : hourValue % 12;

  return `${String(hour24).padStart(2, "0")}:${String(minuteValue).padStart(2, "0")}`;
}

function timeDigitsToMinutes(
  digits: TimeDigits,
  meridiem: Meridiem,
  use24Hour: boolean,
) {
  const value = timeDigitsToValue(digits, meridiem, use24Hour);
  if (!value) {
    return null;
  }

  const [hourValue, minuteValue] = value.split(":").map(Number);
  return hourValue * 60 + minuteValue;
}

function minutesToTimeDraft(totalMinutes: number, use24Hour: boolean) {
  const normalizedMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  const hour24 = Math.floor(normalizedMinutes / 60);
  const minute = normalizedMinutes % 60;
  const meridiem: Meridiem = hour24 >= 12 ? "PM" : "AM";
  const hourValue = use24Hour ? hour24 : hour24 % 12 || 12;
  const digitsString = `${String(hourValue).padStart(2, "0")}${String(minute).padStart(2, "0")}`;

  return {
    digits: [
      digitsString[0] || "",
      digitsString[1] || "",
      digitsString[2] || "",
      digitsString[3] || "",
    ] as TimeDigits,
    meridiem,
  };
}

function DayPill({
  day,
  inCurrentMonth,
  isStart,
  isEnd,
  isRangeStart,
  isRangeEnd,
  inRange,
  onClick,
}: {
  day: Date;
  inCurrentMonth: boolean;
  isStart: boolean;
  isEnd: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
  inRange: boolean;
  onClick: () => void;
}) {
  const isSunday = inCurrentMonth && day.getDay() === 0;
  let className =
    "flex h-9 items-center justify-center text-[17px] leading-none transition-colors";

  if (isRangeStart) {
    className += " w-full rounded-l-full rounded-r-none bg-[var(--ui-calendar-range-bg)] text-white";
  } else if (isRangeEnd) {
    className += " w-full rounded-r-full rounded-l-none bg-[var(--ui-calendar-range-bg)] text-white";
  } else if (inRange) {
    className += " w-full rounded-none bg-[var(--ui-calendar-range-bg)] text-white";
  } else if (isStart || isEnd) {
    className += " mx-auto size-9 rounded-full bg-[var(--ui-calendar-range-bg)] text-white";
  } else if (isSunday) {
    className += " mx-auto size-9 rounded-full bg-[var(--ui-calendar-accent)] text-white hover:bg-[var(--ui-calendar-accent-hover)]";
  } else if (inCurrentMonth) {
    className += " mx-auto size-9 rounded-full bg-[var(--ui-calendar-neutral-bg)] text-white hover:bg-[var(--ui-calendar-neutral-hover)]";
  } else {
    className += " mx-auto size-9 rounded-full bg-[var(--ui-calendar-outside-bg)] text-[var(--ui-calendar-outside-text)]";
  }

  return (
    <motion.button type="button" onClick={onClick} className={className} whileTap={{ scale: 0.95 }}>
      {format(day, "d")}
    </motion.button>
  );
}

function TimeDigitSlots({
  label,
  digits,
  meridiem,
  use24Hour,
  singleMode,
  activeField,
  activeIndex,
  onDigitClick,
  onMeridiemChange,
}: {
  label: string;
  digits: TimeDigits;
  meridiem: Meridiem;
  use24Hour: boolean;
  singleMode?: boolean;
  activeField: boolean;
  activeIndex: number;
  onDigitClick: (index: number) => void;
  onMeridiemChange: (value: Meridiem) => void;
}) {
  return (
    <motion.div
      className={cn(
        "w-full text-left",
        singleMode
          ? "rounded-none border-transparent bg-transparent px-0 py-0"
          : `rounded-2xl border px-2 py-2 ${
              activeField
                ? "border-[var(--ui-calendar-accent)] bg-[var(--ui-calendar-popup-slot-active-bg)]"
                : "border-[var(--ui-calendar-popup-input-border)] bg-[var(--ui-calendar-popup-slot-bg)]"
            }`,
      )}
    >
      <p
        className={cn(
          "text-[11px] leading-none",
          singleMode ? "text-center" : "",
          activeField
            ? "text-[var(--ui-calendar-accent)]"
            : "text-[var(--ui-calendar-popup-muted)]",
        )}
      >
        {label}
      </p>
      <div className={cn("mt-1 flex items-center gap-1", singleMode ? "justify-center" : "")}>
        {digits.map((char, index) => (
          <React.Fragment key={`${label}-${index}`}>
            <motion.button
              type="button"
              onClick={() => onDigitClick(index)}
              className={`inline-flex size-6 items-center justify-center rounded-full border text-[12px] leading-none transition ${
                char
                  ? "border-[var(--ui-calendar-accent)] bg-[var(--ui-calendar-accent)] text-white"
                  : "border-transparent bg-[var(--ui-calendar-keypad-empty)] text-white"
              } ${
                activeField && activeIndex === index
                  ? "ring-2 ring-[var(--ui-calendar-accent)]/35 ring-offset-1 ring-offset-[var(--ui-calendar-popup-slot-bg)]"
                  : ""
              }`}
              whileTap={{ scale: 0.95 }}
            >
              {char || "0"}
            </motion.button>
            {index === 1 ? (
              <span className="inline-flex w-2 items-center justify-center text-[14px] leading-none text-[var(--ui-calendar-popup-subtle)]">
                :
              </span>
            ) : null}
          </React.Fragment>
        ))}
      </div>
      {!use24Hour ? (
        <div className={cn("mt-1 flex items-center gap-2", singleMode ? "justify-center" : "pl-1")}>
          {(["AM", "PM"] as const).map((value) => (
            <motion.button
              key={`${label}-${value}`}
              type="button"
              onClick={() => onMeridiemChange(value)}
              className={`text-[10px] font-medium transition ${
                meridiem === value
                  ? "text-[var(--ui-calendar-accent)]"
                  : "text-[var(--ui-calendar-popup-subtle)]"
              }`}
              whileTap={{ scale: 0.96 }}
            >
              {value}
            </motion.button>
          ))}
        </div>
      ) : null}
    </motion.div>
  );
}

function PopupTitle({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <motion.p
      className="font-poppins inline-flex items-center gap-2 text-[18px] leading-[120%] font-medium text-[var(--ui-calendar-popup-title)]"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      <Icon className="size-4" />
      {children}
    </motion.p>
  );
}

export function EventDateRangePopup({
  open,
  onOpenChange,
  startDate,
  endDate,
  onApply,
  selectionMode = "range",
}: DateRangePopupProps) {
  const minYear = 1900;
  const maxYear = 2100;
  const isSingleMode = selectionMode === "single";
  const [draftStart, setDraftStart] = React.useState<Date | null>(null);
  const [draftEnd, setDraftEnd] = React.useState<Date | null>(null);
  const [cursorMonth, setCursorMonth] = React.useState(startOfMonth(new Date()));
  const [view, setView] = React.useState<"month" | "day">("month");
  const [yearSearch, setYearSearch] = React.useState("");
  const activeYearRef = React.useRef<HTMLDivElement | null>(null);
  const yearsScrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const parsedStart = parseDateValue(startDate);
    const parsedEnd = parseDateValue(endDate);
    const today = startOfDay(new Date());
    const normalizedStart = parsedStart || parsedEnd || today;
    const normalizedEnd = parsedEnd || parsedStart || normalizedStart;

    setDraftStart(normalizedStart);
    setDraftEnd(isSingleMode ? null : normalizedEnd);
    setCursorMonth(startOfMonth(normalizedStart));
    setView("day");
    setYearSearch("");
  }, [open, startDate, endDate, isSingleMode]);

  const monthStart = startOfMonth(cursorMonth);
  const monthEnd = endOfMonth(cursorMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const years = React.useMemo(
    () => Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index),
    [maxYear, minYear],
  );
  const filteredYears = React.useMemo(() => {
    const query = yearSearch.trim();
    if (!query) {
      return years;
    }

    return years.filter((year) => year.toString().includes(query));
  }, [yearSearch, years]);
  const scrollTargetYear = React.useMemo(() => {
    const cursorYear = cursorMonth.getFullYear();

    if (filteredYears.includes(cursorYear)) {
      return cursorYear;
    }

    return filteredYears[0] ?? null;
  }, [filteredYears, cursorMonth]);

  const scrollToActiveYear = React.useCallback(() => {
    const scroller = yearsScrollRef.current;
    const target = activeYearRef.current;
    if (!scroller || !target || scroller.clientHeight === 0) {
      return false;
    }

    const scrollerRect = scroller.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const targetTopInScroller = targetRect.top - scrollerRect.top + scroller.scrollTop;
    const centeredScrollTop =
      targetTopInScroller - scroller.clientHeight / 2 + targetRect.height / 2;

    scroller.scrollTop = Math.max(0, centeredScrollTop);
    return true;
  }, []);

  React.useEffect(() => {
    if (!open || view !== "month" || scrollTargetYear === null) {
      return;
    }

    let cancelled = false;
    let attempt = 0;
    let frameId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const tryScroll = () => {
      if (cancelled) {
        return;
      }

      if (scrollToActiveYear()) {
        return;
      }

      attempt += 1;
      if (attempt >= 8) {
        return;
      }

      timeoutId = setTimeout(() => {
        frameId = window.requestAnimationFrame(tryScroll);
      }, 40);
    };

    frameId = window.requestAnimationFrame(tryScroll);

    return () => {
      cancelled = true;
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [open, view, scrollTargetYear, filteredYears.length, scrollToActiveYear]);

  const handleDaySelect = (day: Date) => {
    if (isSingleMode) {
      setDraftStart(day);
      setDraftEnd(null);
      return;
    }

    if (!draftStart || draftEnd) {
      setDraftStart(day);
      setDraftEnd(null);
      return;
    }

    if (isBefore(day, draftStart)) {
      setDraftStart(day);
      return;
    }

    setDraftEnd(day);
  };

  const canApply = Boolean(draftStart);

  const applySelection = () => {
    if (!draftStart) {
      return;
    }

    const normalizedEnd = isSingleMode ? draftStart : draftEnd || draftStart;
    onApply({
      startDate: toDateValue(draftStart),
      endDate: toDateValue(normalizedEnd),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose={false}
        className="max-w-[380px] rounded-[26px] border-[var(--ui-calendar-popup-border)] bg-[var(--ui-calendar-popup-bg)] p-4 text-[var(--ui-calendar-popup-strong)]"
      >
        <div className="space-y-3">
          <PopupTitle icon={CalendarDays}>Choose a date</PopupTitle>

          <div className="rounded-[22px] bg-[var(--ui-calendar-popup-panel-bg)] p-3">
            <AnimatePresence mode="wait" initial={false}>
              {view === "month" ? (
                <motion.div
                  key="month"
                  className="space-y-3"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.22 }}
                >
                
                  <div ref={yearsScrollRef} className="max-h-[312px] space-y-4 overflow-y-auto pr-1">
                    {filteredYears.map((year) => (
                      <div key={year} ref={year === scrollTargetYear ? activeYearRef : null}>
                        <p className="mb-2 text-[30px] leading-none font-medium text-[var(--ui-calendar-popup-year)]">{year}</p>
                        <div className="grid grid-cols-6 gap-2">
                          {Array.from({ length: 12 }, (_, index) => {
                            const monthDate = new Date(year, index, 1);
                            const active =
                              cursorMonth.getFullYear() === year && cursorMonth.getMonth() === index;

                            return (
                              <motion.button
                                key={`${year}-${index}`}
                                type="button"
                                onClick={() => {
                                  setCursorMonth(monthDate);
                                  setView("day");
                                }}
                                className={`flex size-10 items-center justify-center rounded-full text-[20px] leading-none text-white ${
                                  active
                                    ? "bg-[var(--ui-calendar-accent)]"
                                    : "bg-[var(--ui-calendar-neutral-bg)] hover:bg-[var(--ui-calendar-neutral-hover)]"
                                }`}
                                whileTap={{ scale: 0.95 }}
                              >
                                {index + 1}
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {!filteredYears.length ? (
                      <p className="py-4 text-center text-[13px] text-[var(--text-muted)]">
                        No year found
                      </p>
                    ) : null}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="day"
                  className="space-y-3"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.22 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <motion.button
                        type="button"
                        onClick={() => setCursorMonth(addDays(monthStart, -1))}
                        className="rounded-full p-1 text-[var(--ui-calendar-popup-nav)] transition hover:bg-[var(--ui-calendar-popup-input-bg)] hover:text-[var(--ui-calendar-popup-strong)]"
                        aria-label="Previous month"
                        whileTap={{ scale: 0.95 }}
                      >
                        <ChevronLeft className="size-4" />
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={() => setView("month")}
                        className="text-[24px] leading-none font-medium text-[var(--ui-calendar-popup-strong)]"
                        whileTap={{ scale: 0.98 }}
                      >
                        {format(cursorMonth, "MMMM")}
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={() => setCursorMonth(addDays(monthEnd, 1))}
                        className="rounded-full p-1 text-[var(--ui-calendar-popup-nav)] transition hover:bg-[var(--ui-calendar-popup-input-bg)] hover:text-[var(--ui-calendar-popup-strong)]"
                        aria-label="Next month"
                        whileTap={{ scale: 0.95 }}
                      >
                        <ChevronRight className="size-4" />
                      </motion.button>
                    </div>

                    <motion.button
                      type="button"
                      disabled={!canApply}
                      onClick={applySelection}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[16px] text-[var(--ui-calendar-popup-subtle)] transition hover:text-[var(--ui-calendar-popup-strong)] disabled:opacity-40"
                      whileTap={{ scale: 0.97 }}
                    >
                      Done
                      <ChevronRight className="size-4" />
                    </motion.button>
                  </div>

                  <div className="grid grid-cols-7 gap-2 px-0.5">
                    {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
                      <p
                        key={`${label}-${index}`}
                        className={`text-center text-[11px] leading-none ${
                          index === 0 ? "text-[var(--ui-calendar-accent)]" : "text-[var(--ui-calendar-popup-weekday)]"
                        }`}
                      >
                        {label}
                      </p>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-x-0 gap-y-2">
                    {days.map((day) => {
                      const hasRange = Boolean(draftStart && draftEnd && !isSameDay(draftStart, draftEnd));
                      const isStart = Boolean(draftStart && isSameDay(day, draftStart));
                      const isEnd = Boolean(draftEnd && isSameDay(day, draftEnd));
                      const inRange = Boolean(
                        draftStart &&
                          draftEnd &&
                          isAfter(day, draftStart) &&
                          isBefore(day, draftEnd),
                      );

                      return (
                        <DayPill
                          key={format(day, "yyyy-MM-dd")}
                          day={day}
                          inCurrentMonth={isSameMonth(day, cursorMonth)}
                          isStart={isStart}
                          isEnd={isEnd}
                          isRangeStart={hasRange && isStart}
                          isRangeEnd={hasRange && isEnd}
                          inRange={inRange}
                          onClick={() => handleDaySelect(day)}
                        />
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {view === "month" ? (
            <div className="flex items-center justify-end">
              <motion.button
                type="button"
                onClick={() => setView("day")}
                className="rounded-full px-3 py-1 text-[12px] text-[var(--ui-calendar-popup-subtle)] transition hover:bg-[var(--ui-calendar-popup-panel-bg)] hover:text-[var(--ui-calendar-popup-strong)]"
                whileTap={{ scale: 0.97 }}
              >
                Back
              </motion.button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EventTimeRangePopup({
  open,
  onOpenChange,
  startTime,
  endTime,
  onApply,
  selectionMode = "range",
}: TimeRangePopupProps) {
  const { preferences } = useAppState();
  const [draftStartDigits, setDraftStartDigits] = React.useState<TimeDigits>(createEmptyTimeDigits());
  const [draftEndDigits, setDraftEndDigits] = React.useState<TimeDigits>(createEmptyTimeDigits());
  const [draftStartMeridiem, setDraftStartMeridiem] = React.useState<Meridiem>("AM");
  const [draftEndMeridiem, setDraftEndMeridiem] = React.useState<Meridiem>("AM");
  const [activeField, setActiveField] = React.useState<"start" | "end">("start");
  const [activeDigitIndex, setActiveDigitIndex] = React.useState(0);
  const isSingleMode = selectionMode === "single";

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const nextStartDraft = toTimeDigits(startTime, preferences.use24Hour);
    const nextEndDraft = toTimeDigits(
      isSingleMode ? startTime || endTime : endTime,
      preferences.use24Hour,
    );

    setDraftStartDigits(nextStartDraft.digits);
    setDraftStartMeridiem(nextStartDraft.meridiem);
    setDraftEndDigits(nextEndDraft.digits);
    setDraftEndMeridiem(nextEndDraft.meridiem);
    setActiveField("start");
    setActiveDigitIndex(0);
  }, [endTime, isSingleMode, open, preferences.use24Hour, startTime]);

  const getActiveDigits = () =>
    activeField === "start" ? draftStartDigits : draftEndDigits;
  const updateDigitsForField = (
    field: "start" | "end",
    nextDigits: TimeDigits,
  ) => {
    if (field === "start") {
      setDraftStartDigits(nextDigits);
      return;
    }

    setDraftEndDigits(nextDigits);
  };

  const updateMeridiemForField = (
    field: "start" | "end",
    value: Meridiem,
  ) => {
    if (field === "start") {
      setDraftStartMeridiem(value);
      return;
    }

    setDraftEndMeridiem(value);
  };

  const selectDigit = (field: "start" | "end", index: number) => {
    setActiveField(field);
    setActiveDigitIndex(index);
  };

  const handleDigit = (digit: string) => {
    const sourceDigits = [...getActiveDigits()] as TimeDigits;
    sourceDigits[activeDigitIndex] = digit;

    if (!isValidPartialTimeDigits(sourceDigits, preferences.use24Hour)) {
      return;
    }

    updateDigitsForField(activeField, sourceDigits);

    if (activeDigitIndex < 3) {
      setActiveDigitIndex((prev) => prev + 1);
      return;
    }

    if (activeField === "start" && !isSingleMode) {
      setActiveField("end");
      setActiveDigitIndex(0);
    }
  };

  const handleBackspace = () => {
    const sourceDigits = [...getActiveDigits()] as TimeDigits;
    let nextIndex = activeDigitIndex;

    if (!sourceDigits[nextIndex]) {
      nextIndex = 0;
      for (let index = activeDigitIndex - 1; index >= 0; index -= 1) {
        if (sourceDigits[index] !== "") {
          nextIndex = index;
          break;
        }
      }
    }

    sourceDigits[nextIndex] = "";
    updateDigitsForField(activeField, sourceDigits);
    setActiveDigitIndex(nextIndex);
  };

  const handleClear = () => {
    updateDigitsForField(activeField, createEmptyTimeDigits());
    setActiveDigitIndex(0);
  };

  const handleDurationPreset = (durationMinutes: number) => {
    if (isSingleMode) {
      return;
    }

    const startMinutes = timeDigitsToMinutes(
      draftStartDigits,
      draftStartMeridiem,
      preferences.use24Hour,
    );

    if (startMinutes === null) {
      return;
    }

    const nextEndDraft = minutesToTimeDraft(
      startMinutes + durationMinutes,
      preferences.use24Hour,
    );

    setDraftEndDigits(nextEndDraft.digits);
    setDraftEndMeridiem(nextEndDraft.meridiem);
    setActiveField("end");
    setActiveDigitIndex(3);
  };

  const isStartValid = isValidTimeDigits(draftStartDigits, preferences.use24Hour);
  const isEndValid = isSingleMode || isValidTimeDigits(draftEndDigits, preferences.use24Hour);
  const startMinutes = isStartValid
    ? timeDigitsToMinutes(draftStartDigits, draftStartMeridiem, preferences.use24Hour)
    : null;
  const endMinutes =
    !isSingleMode && isEndValid
      ? timeDigitsToMinutes(draftEndDigits, draftEndMeridiem, preferences.use24Hour)
      : null;
  const rollsEndToNextDay =
    !isSingleMode &&
    startMinutes !== null &&
    endMinutes !== null &&
    endMinutes < startMinutes;
  const canApply = isStartValid && isEndValid;
  const formatLabel = preferences.use24Hour ? "24-hour format" : "12-hour format";
  const keypadDigits = [7, 8, 9, 4, 5, 6, 1, 2, 3];
  const shortcuts = [
    { label: "1h", value: 60 },
    { label: "1.5h", value: 90 },
    { label: "2h", value: 120 },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose={false}
        className="max-w-[380px] rounded-[26px] border-[var(--ui-calendar-popup-border)] bg-[var(--ui-calendar-popup-bg)] p-4 text-[var(--ui-calendar-popup-strong)]"
      >
        <div className="space-y-3">
          <PopupTitle icon={Clock3}>Set time</PopupTitle>

          <div className="space-y-3 rounded-[22px] bg-[var(--ui-calendar-popup-panel-bg)] p-3">
            <div className={`grid gap-2 ${isSingleMode ? "grid-cols-1" : "grid-cols-2"}`}>
              <TimeDigitSlots
                label="Start Time"
                digits={draftStartDigits}
                meridiem={draftStartMeridiem}
                use24Hour={preferences.use24Hour}
                singleMode={isSingleMode}
                activeField={activeField === "start"}
                activeIndex={activeField === "start" ? activeDigitIndex : -1}
                onDigitClick={(index) => selectDigit("start", index)}
                onMeridiemChange={(value) => updateMeridiemForField("start", value)}
              />
              {!isSingleMode ? (
                <TimeDigitSlots
                  label="End Time"
                  digits={draftEndDigits}
                  meridiem={draftEndMeridiem}
                  use24Hour={preferences.use24Hour}
                  singleMode={false}
                  activeField={activeField === "end"}
                  activeIndex={activeField === "end" ? activeDigitIndex : -1}
                  onDigitClick={(index) => selectDigit("end", index)}
                  onMeridiemChange={(value) => updateMeridiemForField("end", value)}
                />
              ) : null}
            </div>

            <div className="flex items-center gap-3 px-1">
              <span className="h-px flex-1 bg-[var(--ui-calendar-popup-input-border)]" />
              <p className="text-[12px] font-medium text-[var(--ui-calendar-popup-subtle)]">
                {formatLabel}
              </p>
              <span className="h-px flex-1 bg-[var(--ui-calendar-popup-input-border)]" />
            </div>

            <div className={`grid gap-3 ${isSingleMode ? "grid-cols-1" : "grid-cols-[minmax(0,1fr)_56px]"}`}>
              <div className="grid grid-cols-3 gap-x-3 gap-y-2">
                {keypadDigits.map((digit) => (
                  <motion.button
                    key={digit}
                    type="button"
                    onClick={() => handleDigit(String(digit))}
                    className="flex h-11 items-center justify-center rounded-full text-[22px] font-medium leading-none text-[var(--ui-calendar-popup-strong)] transition hover:bg-[var(--ui-calendar-popup-slot-bg)]"
                    whileTap={{ scale: 0.94 }}
                  >
                    {digit}
                  </motion.button>
                ))}
                <motion.button
                  type="button"
                  onClick={handleClear}
                  className="flex h-11 items-center justify-center rounded-full text-[18px] font-medium leading-none text-[var(--ui-calendar-popup-strong)] transition hover:bg-[var(--ui-calendar-popup-slot-bg)]"
                  whileTap={{ scale: 0.94 }}
                >
                  C
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => handleDigit("0")}
                  className="flex h-11 items-center justify-center rounded-full bg-[var(--ui-calendar-popup-slot-active-bg)] text-[22px] font-medium leading-none text-[var(--ui-calendar-accent)] transition hover:bg-[var(--ui-calendar-popup-slot-active-bg)]"
                  whileTap={{ scale: 0.94 }}
                >
                  0
                </motion.button>
                <motion.button
                  type="button"
                  onClick={handleBackspace}
                  className="flex h-11 items-center justify-center rounded-full text-[var(--ui-calendar-popup-subtle)] transition hover:bg-[var(--ui-calendar-popup-slot-bg)] hover:text-[var(--ui-calendar-popup-strong)]"
                  aria-label="Delete"
                  whileTap={{ scale: 0.94 }}
                >
                  <Delete className="size-4" />
                </motion.button>
              </div>

              {!isSingleMode ? (
                <div className="flex flex-col items-center gap-2 pt-1">
                  {shortcuts.map((shortcut) => (
                    <motion.button
                      key={shortcut.label}
                      type="button"
                      onClick={() => handleDurationPreset(shortcut.value)}
                      disabled={!isStartValid}
                      className="flex h-10 w-full items-center justify-center rounded-full bg-[var(--ui-calendar-popup-slot-bg)] px-2 text-[11px] font-medium text-[var(--ui-calendar-popup-subtle)] transition hover:bg-[var(--ui-calendar-popup-input-bg)] hover:text-[var(--ui-calendar-popup-strong)] disabled:opacity-40"
                      whileTap={{ scale: 0.96 }}
                    >
                      {shortcut.label}
                    </motion.button>
                  ))}
                </div>
              ) : null}
            </div>

            {rollsEndToNextDay ? (
              <p className="text-[11px] text-[var(--ui-calendar-accent)]">
                End date will move to the next day.
              </p>
            ) : null}

            <div className="flex min-h-6 justify-end">
              {canApply ? (
                <motion.button
                  type="button"
                  onClick={() => {
                    const nextStartTime = timeDigitsToValue(
                      draftStartDigits,
                      draftStartMeridiem,
                      preferences.use24Hour,
                    );
                    const nextEndTime = isSingleMode
                      ? nextStartTime
                      : timeDigitsToValue(
                          draftEndDigits,
                          draftEndMeridiem,
                          preferences.use24Hour,
                        );

                    onApply({
                      startTime: nextStartTime,
                      endTime: nextEndTime,
                      rollsEndToNextDay,
                    });
                    onOpenChange(false);
                  }}
                  className="rounded-full px-2 text-[12px] text-[var(--ui-calendar-popup-subtle)] transition hover:text-[var(--ui-calendar-popup-strong)]"
                  whileTap={{ scale: 0.97 }}
                >
                  Done
                </motion.button>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
