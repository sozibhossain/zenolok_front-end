"use client";

import * as React from "react";
import {
  
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  CalendarClock,
  Clock3,
  ChevronDown,
  ChevronUp,
  MapPin,
  Plus,
  RefreshCw,
  Bell,
  AlarmClock,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAppState } from "@/components/providers/app-state-provider";
import { BrickIcon } from "@/components/shared/brick-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { EventDateRangePopup, EventTimeRangePopup } from "@/components/shared/event-date-time-popups";
import { SectionLoading } from "@/components/shared/section-loading";
import { BrickFilterBar } from "./_components/brick-filter-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  brickApi,
  eventApi,
  type EventData,
} from "@/lib/api";
import { brickIconOptions } from "@/lib/brick-icons";
import { colorPalette } from "@/lib/presets";
import { queryKeys } from "@/lib/query-keys";

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  spansMultipleDays: boolean;
  color: string;
  location: string;
  brickName?: string;
  icon?: string;
  isAllDay: boolean;
  todos: Array<{
    id: string;
    text: string;
    isCompleted: boolean;
  }>;
};

type WeekSegment = {
  id: string;
  eventId: string;
  title: string;
  color: string;
  startCol: number;
  endCol: number;
  lane: number;
  isStart: boolean;
  isEnd: boolean;
};

const weekStartsOnMap: Record<string, 0 | 1 | 2 | 3 | 4 | 5 | 6> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const exhibitionColor = "#E9DB95";

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const valid =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;

  const value = Number.parseInt(valid, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function splitIntoWeeks(days: Date[]) {
  const weeks: Date[][] = [];

  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  return weeks;
}

function intersectsWeek(event: CalendarEvent, weekStart: Date, weekEnd: Date) {
  return event.start <= weekEnd && event.end >= weekStart;
}

function clampDate(date: Date, min: Date, max: Date) {
  if (date < min) {
    return min;
  }
  if (date > max) {
    return max;
  }
  return date;
}

function normalizeDateRange(start: Date, end: Date) {
  const normalizedStart = startOfDay(start);
  const normalizedEnd = startOfDay(end);

  if (normalizedStart.getTime() <= normalizedEnd.getTime()) {
    return { start: normalizedStart, end: normalizedEnd };
  }

  return { start: normalizedEnd, end: normalizedStart };
}

function buildWeekSegments(
  week: Date[],
  events: CalendarEvent[],
): { segments: WeekSegment[]; laneCount: number } {
  const weekStart = startOfDay(week[0]);
  const weekEnd = startOfDay(week[6]);

  const relevant = events
    .filter((event) => intersectsWeek(event, weekStart, weekEnd))
    .sort(
      (a, b) =>
        a.start.getTime() - b.start.getTime() ||
        a.end.getTime() - b.end.getTime(),
    );

  const laneEnds: Date[] = [];
  const segments: WeekSegment[] = [];

  for (const event of relevant) {
    const segmentStart = clampDate(event.start, weekStart, weekEnd);
    const segmentEnd = clampDate(event.end, weekStart, weekEnd);

    let lane = 0;
    while (laneEnds[lane] && laneEnds[lane] >= segmentStart) {
      lane += 1;
    }
    laneEnds[lane] = segmentEnd;

    const startCol = differenceInCalendarDays(segmentStart, weekStart) + 1;
    const endCol = differenceInCalendarDays(segmentEnd, weekStart) + 1;

    segments.push({
      id: `${event.id}-${format(segmentStart, "yyyy-MM-dd")}-${format(segmentEnd, "yyyy-MM-dd")}`,
      eventId: event.id,
      title: event.title,
      color: event.color,
      startCol,
      endCol,
      lane,
      isStart: isSameDay(segmentStart, event.start),
      isEnd: isSameDay(segmentEnd, event.end),
    });
  }

  return { segments, laneCount: laneEnds.length };
}

function getSegmentTextColor(hex: string) {
  const normalized = hex.replace("#", "");
  const valid =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;

  const value = Number.parseInt(valid, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;

  const darken = (channel: number) => Math.max(0, Math.round(channel * 0.58));
  return `rgb(${darken(r)}, ${darken(g)}, ${darken(b)})`;
}

export default function HomePage() {
  const queryClient = useQueryClient();
  const [selectedBrick, setSelectedBrick] = React.useState("all");
  const { monthCursor, selectedDate, setSelectedDate, preferences } =
    useAppState();
  const [createBrickOpen, setCreateBrickOpen] = React.useState(false);
  const [brickName, setBrickName] = React.useState("");
  const [brickColor, setBrickColor] = React.useState("#36A9E1");
  const [brickIcon, setBrickIcon] = React.useState("home");
  const [createEventOpen, setCreateEventOpen] = React.useState(false);
  const [eventTitle, setEventTitle] = React.useState("");
  const [eventLocation, setEventLocation] = React.useState("");
  const [eventIsAllDay, setEventIsAllDay] = React.useState(false);
  const [eventStartDate, setEventStartDate] = React.useState("");
  const [eventEndDate, setEventEndDate] = React.useState("");
  const [eventStartTime, setEventStartTime] = React.useState("");
  const [eventEndTime, setEventEndTime] = React.useState("");
  const [eventDatePopupOpen, setEventDatePopupOpen] = React.useState(false);
  const [eventTimePopupOpen, setEventTimePopupOpen] = React.useState(false);
  const [newEventBrick, setNewEventBrick] = React.useState("");
  const [selectedDateRange, setSelectedDateRange] = React.useState(() => {
    const normalized = startOfDay(selectedDate);
    return { start: normalized, end: normalized };
  });
  const [rangeDragAnchor, setRangeDragAnchor] = React.useState<Date | null>(
    null,
  );
  const [isRangeDragging, setIsRangeDragging] = React.useState(false);
  const skipRangeSyncRef = React.useRef(false);
  const [expandedEventId, setExpandedEventId] = React.useState<string | null>(
    null,
  );

  const weekStartsOn = weekStartsOnMap[preferences.weekStartDay] ?? 1;
  const monthStart = React.useMemo(
    () => startOfMonth(monthCursor),
    [monthCursor],
  );
  const monthEnd = React.useMemo(() => endOfMonth(monthCursor), [monthCursor]);
  const calendarStart = React.useMemo(
    () => startOfWeek(monthStart, { weekStartsOn }),
    [monthStart, weekStartsOn],
  );
  const calendarEnd = React.useMemo(
    () => endOfWeek(monthEnd, { weekStartsOn }),
    [monthEnd, weekStartsOn],
  );
  const calendarStartParam = format(calendarStart, "yyyy-MM-dd");
  const calendarEndParam = format(calendarEnd, "yyyy-MM-dd");

  const bricksQuery = useQuery({
    queryKey: queryKeys.bricks,
    queryFn: brickApi.getAll,
  });

  const eventsQuery = useQuery({
    queryKey: queryKeys.events({
      filter: "all",
      startDate: calendarStartParam,
      endDate: calendarEndParam,
    }),
    queryFn: () =>
      eventApi.getAll({
        filter: "all",
        startDate: calendarStartParam,
        endDate: calendarEndParam,
      }),
  });

  const bricks = React.useMemo(
    () => bricksQuery.data ?? [],
    [bricksQuery.data],
  );

  const normalizedEvents = React.useMemo<CalendarEvent[]>(() => {
    return (eventsQuery.data || []).map((event: EventData) => {
      const start = startOfDay(new Date(event.startTime));
      const rawEnd = startOfDay(new Date(event.endTime));
      const end = rawEnd < start ? start : rawEnd;
      const spansMultipleDays = differenceInCalendarDays(end, start) > 0;

      const titleLower = event.title.toLowerCase();
      const color = titleLower.includes("exhibition week")
        ? exhibitionColor
        : event.brick?.color || "#84C6EC";

      return {
        id: event._id,
        title: event.title,
        start,
        end,
        spansMultipleDays,
        color,
        location: event.location || "No location",
        brickName: event.brick?.name,
        icon: event.brick?.icon,
        isAllDay: event.isAllDay,
        todos: (event.todos || []).map((todo) => ({
          id: todo._id,
          text: todo.text,
          isCompleted: todo.isCompleted,
        })),
      };
    });
  }, [eventsQuery.data]);

  const filteredEvents = React.useMemo(() => {
    if (selectedBrick === "all") {
      return normalizedEvents;
    }

    const selected = bricks.find((brick) => brick._id === selectedBrick);
    if (!selected) {
      return normalizedEvents;
    }

    return normalizedEvents.filter(
      (event) => event.brickName?.toLowerCase() === selected.name.toLowerCase(),
    );
  }, [selectedBrick, normalizedEvents, bricks]);

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weeks = splitIntoWeeks(days);

  const weekdayLabels = React.useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) =>
        format(
          addDays(startOfWeek(new Date(), { weekStartsOn }), index),
          "EEE",
        ),
      ),
    [weekStartsOn],
  );

  const finishRangeSelection = React.useCallback(
    (finalDay?: Date) => {
      if (!rangeDragAnchor) {
        setIsRangeDragging(false);
        return;
      }

      const finalRange = normalizeDateRange(
        rangeDragAnchor,
        finalDay || selectedDateRange.end,
      );

      setSelectedDateRange(finalRange);
      setRangeDragAnchor(null);
      setIsRangeDragging(false);
      skipRangeSyncRef.current = true;
      setSelectedDate(finalRange.start);
    },
    [rangeDragAnchor, selectedDateRange.end, setSelectedDate],
  );

  const selectedDateEvents = React.useMemo(
    () => {
      const dayEvents = filteredEvents.filter(
        (event) => event.start <= selectedDate && event.end >= selectedDate,
      );

      return dayEvents.sort((a, b) => {
        if (a.isAllDay !== b.isAllDay) {
          return a.isAllDay ? -1 : 1;
        }
        return a.start.getTime() - b.start.getTime();
      });
    },
    [filteredEvents, selectedDate],
  );
  const hasEventDateRange = Boolean(eventStartDate && eventEndDate);
  const eventDateSummary = hasEventDateRange
    ? `${eventStartDate} - ${eventEndDate}`
    : "";
  const hasEventTimeRange = Boolean(eventStartTime && eventEndTime);

  const createBrickMutation = useMutation({
    mutationFn: () => {
      if (!brickName.trim()) {
        throw new Error("Brick name is required");
      }

      return brickApi.create({
        name: brickName.trim(),
        color: brickColor,
        icon: brickIcon,
      });
    },
    onSuccess: (createdBrick) => {
      toast.success("Brick created");
      queryClient.invalidateQueries({ queryKey: queryKeys.bricks });
      setCreateBrickOpen(false);
      setSelectedBrick(createdBrick._id);
      setBrickName("");
      setBrickColor("#36A9E1");
      setBrickIcon("home");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to create brick"),
  });

  const createEventMutation = useMutation({
    mutationFn: () => {
      if (!eventTitle.trim()) {
        throw new Error("Title is required");
      }

      if (!eventStartDate || !eventEndDate) {
        throw new Error("Start and end dates are required");
      }

      if (!eventIsAllDay && (!eventStartTime || !eventEndTime)) {
        throw new Error("Start and end times are required");
      }

      const startDate = new Date(`${eventStartDate}T${(eventStartTime || "00:00")}:00`);
      const endDate = new Date(`${eventEndDate}T${(eventEndTime || "00:00")}:00`);

      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        throw new Error("Invalid start or end date/time");
      }

      const normalizedStart = eventIsAllDay ? startOfDay(startDate) : startDate;
      const normalizedEnd = eventIsAllDay ? endOfDay(endDate) : endDate;

      if (normalizedEnd.getTime() <= normalizedStart.getTime()) {
        throw new Error("End time must be after start time");
      }

      return eventApi.create({
        title: eventTitle.trim(),
        brick: newEventBrick || undefined,
        location: eventLocation.trim() || undefined,
        startTime: normalizedStart.toISOString(),
        endTime: normalizedEnd.toISOString(),
        isAllDay: eventIsAllDay,
      });
    },
    onSuccess: () => {
      toast.success("Event created");
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setCreateEventOpen(false);
      setEventTitle("");
      setEventLocation("");
      setEventIsAllDay(false);
      setEventStartDate("");
      setEventEndDate("");
      setEventStartTime("");
      setEventEndTime("");
      setEventDatePopupOpen(false);
      setEventTimePopupOpen(false);
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to create event"),
  });

  React.useEffect(() => {
    if (!createEventOpen) {
      return;
    }

    const defaultStartDate = format(selectedDateRange.start, "yyyy-MM-dd");
    const defaultEndDate = format(selectedDateRange.end, "yyyy-MM-dd");

    setEventDatePopupOpen(false);
    setEventTimePopupOpen(false);
    setEventStartDate(defaultStartDate);
    setEventEndDate(defaultEndDate);
    setEventStartTime("");
    setEventEndTime("");
    setNewEventBrick(selectedBrick === "all" ? "" : selectedBrick);
  }, [createEventOpen, selectedBrick, selectedDateRange]);

  React.useEffect(() => {
    if (!isRangeDragging) {
      return;
    }

    const handleMouseUp = () => finishRangeSelection();
    window.addEventListener("mouseup", handleMouseUp);

    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [isRangeDragging, finishRangeSelection]);

  React.useEffect(() => {
    if (skipRangeSyncRef.current) {
      skipRangeSyncRef.current = false;
      return;
    }

    const normalized = startOfDay(selectedDate);
    setSelectedDateRange({ start: normalized, end: normalized });
  }, [selectedDate]);

  React.useEffect(() => {
    if (!hasEventDateRange) {
      setEventTimePopupOpen(false);
    }
  }, [hasEventDateRange]);

  React.useEffect(() => {
    if (!selectedDateEvents.length) {
      setExpandedEventId(null);
      return;
    }

    setExpandedEventId((prev) => {
      if (prev && selectedDateEvents.some((event) => event.id === prev)) {
        return prev;
      }
      return selectedDateEvents[0].id;
    });
  }, [selectedDateEvents]);

  return (
    <div className="space-y-4">
      <BrickFilterBar
        bricks={bricks}
        selectedBrick={selectedBrick}
        onSelectBrick={setSelectedBrick}
        onCreateBrick={() => setCreateBrickOpen(true)}
      />

      <section className="rounded-[30px] border border-[#DFE4ED] bg-[#F4F6FA] p-3 sm:p-4">
        {eventsQuery.isLoading ? (
          <SectionLoading rows={8} />
        ) : (
          <div className="grid gap-4 xl:grid-cols-[272px_minmax(0,1fr)]">
            <aside className="rounded-[24px] border border-[#D8DEEA] bg-[#ECEFF4] p-3">
              <div className="mb-3 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setCreateEventOpen(true)}
                  className="flex size-8 items-center justify-center rounded-lg border border-dashed border-[#BFC7D7] text-[#8A94A7]"
                >
                  <Plus className="size-4" />
                </button>
              </div>

              {selectedDateEvents.length ? (
                <div className="space-y-2">
                  {selectedDateEvents.map((event) => {
                    const expanded = expandedEventId === event.id;

                    return (
                      <div
                        key={event.id}
                        className="rounded-xl border border-[#D3DAE8] bg-[#DFE4EC] px-2 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-7 w-1.5 rounded-full"
                                style={{ backgroundColor: event.color }}
                              />
                              <div className="min-w-0">
                                <p className="font-poppins truncate text-[16px] leading-[120%] font-medium text-[#535A66]">
                                  <span
                                    className={
                                      event.isAllDay
                                        ? "text-[#26A4E6]"
                                        : "text-[#6C7485]"
                                    }
                                  >
                                    {event.isAllDay
                                      ? "All day"
                                      : format(event.start, "hh:mm a")}
                                  </span>
                                  <span className="mx-1 text-[#B6BDC9]">|</span>
                                  <span>{event.title}</span>
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1 text-[#A2A9B7]">
                            {event.spansMultipleDays ? (
                              <RefreshCw className="size-4" />
                            ) : null}
                            <Bell className="size-4" />
                            <AlarmClock className="size-5" />
                            <button
                              type="button"
                              className="inline-flex items-center justify-center"
                              aria-label={
                                expanded
                                  ? "Collapse event todos"
                                  : "Expand event todos"
                              }
                              onClick={() =>
                                setExpandedEventId((prev) =>
                                  prev === event.id ? null : event.id,
                                )
                              }
                            >
                              {expanded ? (
                                <ChevronUp className="size-4" />
                              ) : (
                                <ChevronDown className="size-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        <p className="font-poppins mt-1 flex items-center gap-1 text-[12px] leading-[120%] text-[#7A8396]">
                          <MapPin className="size-3.5" />
                          {event.location}
                        </p>

                        {expanded ? (
                          <div className="ml-8 mt-2 rounded-xl border border-[#D3DAE8] bg-white px-3 py-2">
                            <div className="space-y-2">
                              {event.todos.length ? (
                                event.todos.map((todo) => (
                                  <div
                                    key={todo.id}
                                    className="flex items-center gap-2 text-[13px] text-[#4C535F]"
                                  >
                                    <span className="size-2 rounded-full bg-[#B7BFCE]" />
                                    <span
                                      className={
                                        todo.isCompleted
                                          ? "line-through text-[#A2A9B6]"
                                          : ""
                                      }
                                    >
                                      {todo.text}
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <p className="text-[12px] text-[#A0A8B7]">
                                  No todos yet
                                </p>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="No events"
                  description="No events on selected day."
                />
              )}
            </aside>

            <div className="overflow-x-auto">
              <div className="min-w-[840px]">
                <div className="mb-2 grid grid-cols-7">
                  {weekdayLabels.map((label) => (
                    <div key={label} className="px-2 py-1 text-center">
                      <p
                        className={`font-poppins text-[16px] leading-[120%] font-medium ${
                          label.startsWith("Sun")
                            ? "text-[#FF3B30]"
                            : "text-[#3A4150]"
                        }`}
                      >
                        {label}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="space-y-0 rounded-[18px] border border-[#D7DCE6] bg-white">
                  {weeks.map((week, weekIndex) => {
                    const weekInfo = buildWeekSegments(week, filteredEvents);
                    const shouldScrollSegments = weekInfo.laneCount > 3;

                    return (
                      <div
                        key={`${format(week[0], "yyyy-MM-dd")}-${weekIndex}`}
                        className="relative grid grid-cols-7 overflow-hidden border-b border-[#DDE2EC] last:border-b-0"
                      >
                        {week.map((day) => {
                          const isInSelectedRange =
                            day >= selectedDateRange.start &&
                            day <= selectedDateRange.end;
                          return (
                            <button
                              key={format(day, "yyyy-MM-dd")}
                              type="button"
                              onMouseDown={(mouseEvent) => {
                                if (mouseEvent.button !== 0) {
                                  return;
                                }

                                mouseEvent.preventDefault();
                                const normalized = startOfDay(day);
                                setIsRangeDragging(true);
                                setRangeDragAnchor(normalized);
                                setSelectedDateRange({
                                  start: normalized,
                                  end: normalized,
                                });
                              }}
                              onMouseEnter={() => {
                                if (!isRangeDragging || !rangeDragAnchor) {
                                  return;
                                }

                                setSelectedDateRange(
                                  normalizeDateRange(rangeDragAnchor, day),
                                );
                              }}
                              onMouseUp={(mouseEvent) => {
                                mouseEvent.preventDefault();
                                mouseEvent.stopPropagation();
                                finishRangeSelection(day);
                              }}
                              onKeyDown={(keyEvent) => {
                                if (
                                  keyEvent.key !== "Enter" &&
                                  keyEvent.key !== " "
                                ) {
                                  return;
                                }

                                keyEvent.preventDefault();
                                const normalized = startOfDay(day);
                                setSelectedDateRange({
                                  start: normalized,
                                  end: normalized,
                                });
                                skipRangeSyncRef.current = true;
                                setSelectedDate(normalized);
                              }}
                              className={`h-[136px] select-none border-r border-[#DDE2EC] px-2 py-2 text-left last:border-r-0 ${
                                isInSelectedRange ? "bg-[#ECEDEF]" : ""
                              }`}
                            >
                              <span
                                className={`font-poppins inline-flex min-w-[32px] items-center justify-center rounded-xl pb-6 px-2 text-[20px] leading-[120%] font-medium ${
                                  isInSelectedRange
                                    ? "text-[#2E333E]"
                                    : isSameMonth(day, monthCursor)
                                      ? "text-[#2F3542]"
                                      : "text-[#A4ABBB]"
                                }`}
                              >
                                {format(day, "d")}
                              </span>
                            </button>
                          );
                        })}

                        <div className="pointer-events-none absolute inset-x-0 top-20 px-[2px]">
                          <div
                            className={`grid grid-cols-7 auto-rows-[24px] ${
                              shouldScrollSegments
                                ? "pointer-events-auto max-h-[72px] overflow-y-auto pr-1"
                                : ""
                            }`}
                          >
                            {weekInfo.segments.map((segment) => (
                              <div
                                key={segment.id}
                                style={{
                                  gridColumn: `${segment.startCol} / ${segment.endCol + 1}`,
                                  gridRow: segment.lane + 1,
                                  backgroundColor: hexToRgba(
                                    segment.color,
                                    0.45,
                                  ),
                                  color: getSegmentTextColor(segment.color),
                                }}
                                className="mx-[1px] flex h-[18px] items-center overflow-hidden rounded-[1px]"
                              >
                                {segment.isStart ? (
                                  <>
                                    <span
                                      className="h-full w-1.5 shrink-0 "
                                      style={{ backgroundColor: segment.color }}
                                    />
                                    <span className="truncate pl-1 font-poppins text-[14px] leading-[120%] font-medium">
                                      {segment.title}
                                    </span>
                                  </>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <Dialog open={createBrickOpen} onOpenChange={setCreateBrickOpen}>
        <DialogContent className="max-w-5xl rounded-[28px] border border-[#DCE2ED] bg-[#F5F7FB] p-4 sm:p-6 space-y-2">
          <DialogHeader>
            <DialogTitle className="text-3xl">Create Brick</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Brick name"
              value={brickName}
              onChange={(event) => setBrickName(event.target.value)}
            />
            <div className="rounded-3xl border border-[#DFE4EE] bg-[#EEF2F8] p-3 sm:p-4">
              <div className="grid grid-cols-10 gap-2 sm:gap-3">
                {colorPalette.map((color) => (
                  <button
                    type="button"
                    key={color}
                    onClick={() => setBrickColor(color)}
                    className={`size-8 rounded-full border-2 transition sm:size-10 ${
                      brickColor === color ? "border-[#283040] scale-[1.05]" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select ${color} color`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <p className="text-sm">Brick Icon</p>
              </div>
              <div className="rounded-3xl border border-[#DFE4EE] bg-[#EEF2F8] p-3 sm:p-4">
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 sm:gap-2.5 md:grid-cols-10">
                  {brickIconOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setBrickIcon(option.value)}
                      className={`flex h-9 items-center justify-center rounded-xl border transition sm:h-10 ${
                        brickIcon === option.value
                          ? "border-[#36A9E1] bg-[#DDECFF] text-[#1B5FB8]"
                          : "border-transparent bg-white text-[#5A6070] hover:border-[#C8D0E0]"
                      }`}
                      aria-label={option.label}
                      title={option.label}
                    >
                      <option.Icon className="size-4 sm:size-5" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-[#D6DCE8] bg-[#F5F7FB] px-3 py-2">
              <span
                className="h-5 w-5 rounded-full"
                style={{ backgroundColor: brickColor }}
              />
              <BrickIcon name={brickIcon} className="size-4" />
              <span className="font-poppins text-[14px] font-medium text-[#2E3542]">
                {brickName.trim() || "Preview"}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => createBrickMutation.mutate()}
              disabled={createBrickMutation.isPending}
            >
              {createBrickMutation.isPending ? "Creating..." : "Create Brick"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createEventOpen} onOpenChange={setCreateEventOpen}>
        <DialogContent className="max-w-2xl rounded-[26px] space-y-4">
          <DialogHeader>
            <DialogTitle className="text-3xl">Create event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Title"
              value={eventTitle}
              onChange={(event) => setEventTitle(event.target.value)}
            />
            <Input
              placeholder="Location"
              value={eventLocation}
              onChange={(event) => setEventLocation(event.target.value)}
            />
            <div className="space-y-2">
              <button
                type="button"
                className="font-poppins inline-flex items-center gap-2 rounded-full px-1 text-[20px] leading-[120%] font-medium text-[#4D4D4D]"
                onClick={() => setEventDatePopupOpen(true)}
              >
                <CalendarClock className="size-5" />
                Choose a date
              </button>
              {eventDateSummary ? <p className="text-[12px] text-[#8890A0]">{eventDateSummary}</p> : null}
            </div>
            {!eventIsAllDay ? (
              <div className="space-y-2">
                <button
                  type="button"
                  className="font-poppins inline-flex items-center gap-2 rounded-full px-1 text-[20px] leading-[120%] font-medium text-[#4D4D4D] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setEventTimePopupOpen(true)}
                  disabled={!hasEventDateRange}
                >
                  <Clock3 className="size-5" />
                  Set time
                </button>
                {hasEventTimeRange ? (
                  <p className="text-[12px] text-[#8890A0]">
                    {eventStartTime} - {eventEndTime}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="flex items-center justify-between rounded-xl border border-[#E4E8F0] p-3">
              <p className="font-medium text-[#3A404D]">All day</p>
              <Switch
                checked={eventIsAllDay}
                onCheckedChange={(checked) => {
                  setEventIsAllDay(checked);
                  if (checked) {
                    setEventTimePopupOpen(false);
                  }
                }}
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1">
              {bricks.map((brick) => (
                <button
                  key={brick._id}
                  type="button"
                  className="shrink-0"
                  onClick={() => setNewEventBrick(brick._id)}
                >
                  <Badge
                    variant={newEventBrick === brick._id ? "blue" : "neutral"}
                    style={
                      newEventBrick === brick._id
                        ? { backgroundColor: brick.color }
                        : { color: brick.color, borderColor: brick.color }
                    }
                  >
                    <BrickIcon name={brick.icon} className="size-4" />{" "}
                    {brick.name}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => createEventMutation.mutate()}
              disabled={createEventMutation.isPending}
            >
              {createEventMutation.isPending ? "Creating..." : "Create event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EventDateRangePopup
        open={eventDatePopupOpen}
        onOpenChange={setEventDatePopupOpen}
        startDate={eventStartDate}
        endDate={eventEndDate}
        onApply={({ startDate, endDate }) => {
          setEventStartDate(startDate);
          setEventEndDate(endDate);
        }}
      />
      <EventTimeRangePopup
        open={eventTimePopupOpen}
        onOpenChange={setEventTimePopupOpen}
        startTime={eventStartTime}
        endTime={eventEndTime}
        onApply={({ startTime, endTime }) => {
          setEventStartTime(startTime);
          setEventEndTime(endTime);
        }}
      />
    </div>
  );
}
