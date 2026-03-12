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

import { Dialog, DialogContent } from "@/components/ui/dialog";

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
};

type TimeRangeValue = {
  startTime: string;
  endTime: string;
};

type TimeRangePopupProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startTime: string;
  endTime: string;
  onApply: (value: TimeRangeValue) => void;
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

function toTimeDigits(value: string) {
  return value.replace(":", "").replace(/\D/g, "").slice(0, 4);
}

function toTimeValue(digits: string) {
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

function isValidTimeDigits(digits: string) {
  if (digits.length !== 4) {
    return false;
  }
  const hour = Number(digits.slice(0, 2));
  const minute = Number(digits.slice(2, 4));
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
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
    className += " w-full rounded-l-full rounded-r-none bg-[#F07373] text-white";
  } else if (isRangeEnd) {
    className += " w-full rounded-r-full rounded-l-none bg-[#4B4D54] text-white";
  } else if (inRange) {
    className += " w-full rounded-none bg-[#4B4D54] text-white";
  } else if (isStart) {
    className += " mx-auto size-9 rounded-full bg-[#F07373] text-white";
  } else if (isEnd) {
    className += " mx-auto size-9 rounded-full bg-[#4B4D54] text-white";
  } else if (isSunday) {
    className += " mx-auto size-9 rounded-full bg-[#F07373] text-white hover:bg-[#ea6a6a]";
  } else if (inCurrentMonth) {
    className += " mx-auto size-9 rounded-full bg-[#B6B8BC] text-white hover:bg-[#AEB0B4]";
  } else {
    className += " mx-auto size-9 rounded-full bg-[#D4D6DB] text-[#9CA1AA]";
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {format(day, "d")}
    </button>
  );
}

function TimeDigitSlots({
  label,
  digits,
  active,
  onClick,
}: {
  label: string;
  digits: string;
  active: boolean;
  onClick: () => void;
}) {
  const chars = [digits[0] || "", digits[1] || "", digits[2] || "", digits[3] || ""];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border px-2 py-2 text-left ${
        active ? "border-[#F07373] bg-[#FFF6F6]" : "border-[#D9DCE3] bg-[#EFF1F5]"
      }`}
    >
      <p className="text-[11px] leading-none text-[#808692]">{label}</p>
      <div className="mt-1 flex items-center gap-1.5">
        {chars.map((char, index) => (
          <span
            key={`${label}-${index}`}
            className={`inline-flex size-6 items-center justify-center rounded-full text-[12px] leading-none ${
              char ? "bg-[#F07373] text-white" : "bg-[#C7CBD4] text-white"
            }`}
          >
            {char || "•"}
          </span>
        ))}
      </div>
    </button>
  );
}

export function EventDateRangePopup({
  open,
  onOpenChange,
  startDate,
  endDate,
  onApply,
}: DateRangePopupProps) {
  const minYear = 1900;
  const maxYear = 2100;
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
    setDraftEnd(normalizedEnd);
    setCursorMonth(startOfMonth(normalizedStart));
    setView("month");
    setYearSearch("");
  }, [open, startDate, endDate]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose={false} className="max-w-[380px] rounded-[26px] border-[#E2E5EC] bg-[#F4F5F7] p-4">
        <div className="space-y-3">
          <p className="font-poppins inline-flex items-center gap-2 text-[18px] leading-[120%] font-medium text-[#444A55]">
            <CalendarDays className="size-4" />
            Choose a date
          </p>

          <div className="rounded-[22px] bg-[#ECEDEF] p-3">
            {view === "month" ? (
              <div className="space-y-3">
                <input
                  type="text"
                  inputMode="numeric"
                  value={yearSearch}
                  onChange={(event) =>
                    setYearSearch(event.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder="Search year (e.g. 2026)"
                  className="h-9 w-full rounded-xl border border-[#D2D7E0] bg-[#F8F9FB] px-3 text-[14px] text-[#4A4F59] placeholder:text-[#9AA1AE] focus:border-[#B5BDC9] focus:outline-none"
                />
                <div
                  ref={yearsScrollRef}
                  className="max-h-[312px] space-y-4 overflow-y-auto pr-1"
                >
                  {filteredYears.map((year) => (
                    <div
                      key={year}
                      ref={year === scrollTargetYear ? activeYearRef : null}
                    >
                      <p className="mb-2 text-[30px] leading-none font-medium text-[#6D717B]">{year}</p>
                      <div className="grid grid-cols-6 gap-2">
                        {Array.from({ length: 12 }, (_, index) => {
                          const monthDate = new Date(year, index, 1);
                          const active =
                            cursorMonth.getFullYear() === year && cursorMonth.getMonth() === index;

                          return (
                            <button
                              key={`${year}-${index}`}
                              type="button"
                              onClick={() => {
                                setCursorMonth(monthDate);
                                setView("day");
                              }}
                              className={`flex size-10 items-center justify-center rounded-full text-[20px] leading-none ${
                                active ? "bg-[#F07373] text-white" : "bg-[#B6B8BC] text-white"
                              }`}
                            >
                              {index + 1}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {!filteredYears.length ? (
                    <p className="py-4 text-center text-[13px] text-[#8B92A0]">
                      No year found
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setView("month")}
                  className="inline-flex items-center gap-1 rounded-lg px-1 text-[13px] text-[#6F7684] hover:text-white bg-white hover:bg-[#4A4F59] w-full py-2"
                >
                  <ChevronLeft className="size-4" />
                  Year
                </button>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setCursorMonth(addDays(monthStart, -1))}
                    className="rounded-full p-1 text-[#767D89]"
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("month")}
                    className="text-[30px] leading-none font-medium text-[#4A4F59]"
                  >
                    {format(cursorMonth, "MMMM")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCursorMonth(addDays(monthEnd, 1))}
                    className="rounded-full p-1 text-[#767D89]"
                    aria-label="Next month"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-2 px-0.5">
                  {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
                    <p
                      key={`${label}-${index}`}
                      className={`text-center text-[11px] leading-none ${
                        index === 0 ? "text-[#F07373]" : "text-[#9BA0AA]"
                      }`}
                    >
                      {label}
                    </p>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-x-0 gap-y-2">
                  {days.map((day) => {
                    const hasRange = Boolean(
                      draftStart && draftEnd && !isSameDay(draftStart, draftEnd),
                    );
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
              </div>
            )}
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              disabled={!canApply}
              onClick={() => {
                if (!draftStart) {
                  return;
                }

                const normalizedEnd = draftEnd || draftStart;
                onApply({
                  startDate: toDateValue(draftStart),
                  endDate: toDateValue(normalizedEnd),
                });
                onOpenChange(false);
              }}
              className="rounded-full px-3 py-1 text-[12px] text-[#8E93A0] disabled:opacity-40"
            >
              Done
            </button>
          </div>
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
}: TimeRangePopupProps) {
  const [draftStartDigits, setDraftStartDigits] = React.useState("");
  const [draftEndDigits, setDraftEndDigits] = React.useState("");
  const [activeField, setActiveField] = React.useState<"start" | "end">("start");

  React.useEffect(() => {
    if (!open) {
      return;
    }
    setDraftStartDigits(toTimeDigits(startTime));
    setDraftEndDigits(toTimeDigits(endTime));
    setActiveField("start");
  }, [open, startTime, endTime]);

  const updateActive = (next: (prev: string) => string) => {
    if (activeField === "start") {
      setDraftStartDigits((prev) => next(prev));
      return;
    }
    setDraftEndDigits((prev) => next(prev));
  };

  const handleDigit = (digit: string) => {
    updateActive((prev) => {
      if (prev.length >= 4) {
        return prev;
      }
      const next = `${prev}${digit}`;
      if (next.length === 4 && activeField === "start") {
        setActiveField("end");
      }
      return next;
    });
  };

  const handleBackspace = () => {
    updateActive((prev) => prev.slice(0, -1));
  };

  const canApply = isValidTimeDigits(draftStartDigits) && isValidTimeDigits(draftEndDigits);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose={false} className="max-w-[380px] rounded-[26px] border-[#E2E5EC] bg-[#F4F5F7] p-4">
        <div className="space-y-3">
          <p className="font-poppins inline-flex items-center gap-2 text-[18px] leading-[120%] font-medium text-[#444A55]">
            <Clock3 className="size-4" />
            Set time
          </p>

          <div className="space-y-3 rounded-[22px] bg-[#ECEDEF] p-3">
            <div className="grid grid-cols-2 gap-2">
              <TimeDigitSlots
                label="Start Time"
                digits={draftStartDigits}
                active={activeField === "start"}
                onClick={() => setActiveField("start")}
              />
              <TimeDigitSlots
                label="End Time"
                digits={draftEndDigits}
                active={activeField === "end"}
                onClick={() => setActiveField("end")}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleDigit(String(digit))}
                  className="flex size-10 items-center justify-center rounded-full bg-[#B6B8BC] text-[20px] leading-none text-white"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleBackspace}
                className="flex size-10 items-center justify-center rounded-full bg-[#F07373] text-white"
                aria-label="Delete"
              >
                <Delete className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => handleDigit("0")}
                className="flex size-10 items-center justify-center rounded-full bg-[#B6B8BC] text-[20px] leading-none text-white"
              >
                0
              </button>
              <button
                type="button"
                disabled={!canApply}
                onClick={() => {
                  if (!canApply) {
                    return;
                  }
                  onApply({
                    startTime: toTimeValue(draftStartDigits),
                    endTime: toTimeValue(draftEndDigits),
                  });
                  onOpenChange(false);
                }}
                className="rounded-full px-2 text-[12px] text-[#8E93A0] disabled:opacity-40"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
