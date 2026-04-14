"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
  ArrowUpDown,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock3,
  MapPin,
  PanelLeft,
  Plus,
  RefreshCw,
  Bell,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { useAppState } from "@/components/providers/app-state-provider";
import { AllDayTabToggle } from "@/components/shared/all-day-tab-toggle";
import { BrickIcon } from "@/components/shared/brick-icon";
import { EmptyState } from "@/components/shared/empty-state";
import {
  EventBrickSelector,
  resolveEventBrickSelection,
} from "@/components/shared/event-brick-selector";
import {
  EventDateRangePopup,
  EventTimeRangePopup,
} from "@/components/shared/event-date-time-popups";
import {
  EventRangeField,
  EventSingleField,
} from "@/components/shared/event-range-field";
import { SectionLoading } from "@/components/shared/section-loading";
import { Button } from "@/components/ui/button";
import { BrickFilterBar } from "@/components/shared/brick-filter-bar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { brickApi, eventApi, type EventData } from "@/lib/api";
import { brickIconOptions } from "@/lib/brick-icons";
import { colorPalette } from "@/lib/presets";
import { queryKeys } from "@/lib/query-keys";
import {
  toggleAllBrickSelection,
  toggleBrickSelection,
} from "@/lib/brick-filter-selection";
import { formatTimeRangeByPreference } from "@/lib/time-format";

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  startAt: Date;
  endAt: Date;
  spansMultipleDays: boolean;
  color: string;
  location: string;
  brickId?: string;
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

type HomeSidebarMetaRangeProps = {
  icon: React.ComponentType<{ className?: string }>;
  startValue: string;
  endValue?: string | null;
  startCaption?: string | null;
  endCaption?: string | null;
  showArrowMarkers?: boolean;
  emphasize?: boolean;
};

function HomeSidebarMetaRange({
  icon: Icon,
  startValue,
  endValue,
  startCaption,
  endCaption,
  showArrowMarkers = false,
  emphasize = false,
}: HomeSidebarMetaRangeProps) {
  const showEnd = Boolean(endValue && endValue !== startValue);

  return (
    <div className="flex items-start gap-1.5">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-[#8E97A7]" />
      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0">
          <p
            className={`font-poppins text-[12px] leading-[120%] ${
              emphasize
                ? "font-semibold text-[#586171]"
                : "font-medium text-[#6A7282]"
            }`}
          >
            {startValue}
          </p>
          {startCaption ? (
            <div className="mt-0.5 flex items-center gap-1 text-[#A0A8B8]">
              <span className="font-poppins text-[10px] leading-none font-medium tracking-[0.14em]">
                {startCaption}
              </span>
              {showEnd && showArrowMarkers ? (
                <ArrowUpDown className="size-2.5" />
              ) : null}
            </div>
          ) : null}
        </div>
        {showEnd ? (
          <>
            <span className="pt-0.5 text-[13px] leading-none text-[#98A1B2]">
              -
            </span>
            <div className="min-w-0">
              <p
                className={`font-poppins text-[12px] leading-[120%] ${
                  emphasize
                    ? "font-semibold text-[#586171]"
                    : "font-medium text-[#6A7282]"
                }`}
              >
                {endValue}
              </p>
              {endCaption ? (
                <div className="mt-0.5 flex items-center gap-1 text-[#A0A8B8]">
                  <span className="font-poppins text-[10px] leading-none font-medium tracking-[0.14em]">
                    {endCaption}
                  </span>
                  {showArrowMarkers ? (
                    <ArrowUpDown className="size-2.5" />
                  ) : null}
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function HomeEventTodoRow({
  text,
  completed,
}: {
  text: string;
  completed: boolean;
}) {
  const markerColor = completed ? "#2CCB62" : "#F7C700";

  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="size-4 shrink-0 rounded-full border-2 bg-transparent"
        style={{ borderColor: markerColor }}
      />
      <span
        className={`font-poppins text-[15px] leading-[120%] font-medium text-[#575F6D] ${
          completed ? "line-through opacity-60" : ""
        }`}
      >
        {text}
      </span>
    </div>
  );
}

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

function parseDateTimeValue(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
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

export default function HomePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const currentUserId = session?.user?._id || session?._id || "";
  const [selectedBrickIds, setSelectedBrickIds] = React.useState<
    string[] | null
  >(null);
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
  const [preferredCreateEventBrickId, setPreferredCreateEventBrickId] =
    React.useState("");
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
  const [eventsDrawerOpen, setEventsDrawerOpen] = React.useState(false);

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
  const allBrickIds = React.useMemo(
    () => bricks.map((brick) => brick._id),
    [bricks],
  );
  const effectiveSelectedBrickIds = React.useMemo(() => {
    if (selectedBrickIds === null) {
      return allBrickIds;
    }

    return selectedBrickIds;
  }, [allBrickIds, selectedBrickIds]);

  const allBricksSelected = React.useMemo(() => {
    if (!allBrickIds.length) {
      return false;
    }

    return allBrickIds.every((brickId) =>
      effectiveSelectedBrickIds.includes(brickId),
    );
  }, [allBrickIds, effectiveSelectedBrickIds]);

  const normalizedEvents = React.useMemo<CalendarEvent[]>(() => {
    return (eventsQuery.data || []).reduce<CalendarEvent[]>(
      (items, event: EventData) => {
        const startAt = parseDateTimeValue(event.startTime);
        const rawEndAt = parseDateTimeValue(event.endTime);
        if (!startAt || !rawEndAt) {
          return items;
        }

        const endAt = rawEndAt < startAt ? startAt : rawEndAt;
        const start = startOfDay(startAt);
        const rawEnd = startOfDay(endAt);
        const end = rawEnd < start ? start : rawEnd;
        const spansMultipleDays = differenceInCalendarDays(end, start) > 0;

        const titleLower = event.title.toLowerCase();
        const color = titleLower.includes("exhibition week")
          ? exhibitionColor
          : event.brick?.color || "#84C6EC";

        items.push({
          id: event._id,
          title: event.title,
          start,
          end,
          startAt,
          endAt,
          spansMultipleDays,
          color,
          location: event.location || "No location",
          brickId: event.brick?._id,
          brickName: event.brick?.name,
          icon: event.brick?.icon,
          isAllDay: event.isAllDay,
          todos: (event.todos || [])
            .filter((todo) => todo.createdBy === currentUserId)
            .map((todo) => ({
              id: todo._id,
              text: todo.text,
              isCompleted: todo.isCompleted,
            })),
        });
        return items;
      },
      [],
    );
  }, [currentUserId, eventsQuery.data]);

  const filteredEvents = React.useMemo(() => {
    if (!effectiveSelectedBrickIds.length) {
      return [];
    }

    if (allBricksSelected) {
      return normalizedEvents;
    }

    return normalizedEvents.filter((event) =>
      Boolean(
        event.brickId && effectiveSelectedBrickIds.includes(event.brickId),
      ),
    );
  }, [effectiveSelectedBrickIds, normalizedEvents, allBricksSelected]);

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weeks = splitIntoWeeks(days);

  const weekdayLabels = React.useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) =>
        addDays(startOfWeek(new Date(), { weekStartsOn }), index),
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

  const selectedDateEvents = React.useMemo(() => {
    const dayEvents = filteredEvents.filter(
      (event) => event.start <= selectedDate && event.end >= selectedDate,
    );

    return dayEvents.sort((a, b) => {
      if (a.isAllDay !== b.isAllDay) {
        return a.isAllDay ? -1 : 1;
      }
      return a.startAt.getTime() - b.startAt.getTime();
    });
  }, [filteredEvents, selectedDate]);
  const handleOpenEventDetails = React.useCallback(
    (eventId: string) => {
      setEventsDrawerOpen(false);
      router.push(`/events/${eventId}`);
    },
    [router],
  );
  const hasEventDateRange = Boolean(eventStartDate && eventEndDate);
  const isSingleDayEvent = Boolean(
    eventStartDate && eventEndDate && eventStartDate === eventEndDate,
  );

  const openCreateEventDialog = React.useCallback(() => {
    const defaultStartDate = format(selectedDateRange.start, "yyyy-MM-dd");
    const defaultEndDate = format(selectedDateRange.end, "yyyy-MM-dd");

    setEventTitle("");
    setEventLocation("");
    setEventIsAllDay(false);
    setEventDatePopupOpen(false);
    setEventTimePopupOpen(false);
    setEventStartDate(defaultStartDate);
    setEventEndDate(defaultEndDate);
    setEventStartTime("");
    setEventEndTime("");
    setNewEventBrick(
      resolveEventBrickSelection(
        allBrickIds,
        preferredCreateEventBrickId
          ? [preferredCreateEventBrickId, ...effectiveSelectedBrickIds]
          : effectiveSelectedBrickIds,
      ),
    );
    setCreateEventOpen(true);
  }, [
    allBrickIds,
    effectiveSelectedBrickIds,
    preferredCreateEventBrickId,
    selectedDateRange,
  ]);

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
    onSuccess: () => {
      toast.success("Brick created");
      queryClient.invalidateQueries({ queryKey: queryKeys.bricks });
      setCreateBrickOpen(false);
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

      const usesSingleTime = !eventIsAllDay && eventStartDate === eventEndDate;
      const resolvedEndTime = usesSingleTime ? eventStartTime : eventEndTime;

      if (!eventIsAllDay && !eventStartTime) {
        throw new Error("Start time is required");
      }

      if (!eventIsAllDay && !usesSingleTime && !resolvedEndTime) {
        throw new Error("Start and end times are required");
      }

      const startDate = new Date(
        `${eventStartDate}T${eventStartTime || "00:00"}:00`,
      );
      const endDate = new Date(
        `${eventEndDate}T${resolvedEndTime || "00:00"}:00`,
      );

      if (
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime())
      ) {
        throw new Error("Invalid start or end date/time");
      }

      const normalizedStart = eventIsAllDay ? startOfDay(startDate) : startDate;
      const normalizedEnd = eventIsAllDay ? endOfDay(endDate) : endDate;

      if (normalizedEnd.getTime() < normalizedStart.getTime()) {
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
      setNewEventBrick("");
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to create event"),
  });

  React.useEffect(() => {
    setSelectedBrickIds((previous) => {
      if (previous === null) {
        return null;
      }

      const filtered = previous.filter((brickId) =>
        allBrickIds.includes(brickId),
      );
      return filtered.length === previous.length ? previous : filtered;
    });
  }, [allBrickIds]);

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
    if (eventIsAllDay || !isSingleDayEvent) {
      return;
    }

    setEventEndTime((previous) => {
      if (!eventStartTime) {
        return previous ? "" : previous;
      }

      return previous === eventStartTime ? previous : eventStartTime;
    });
  }, [eventIsAllDay, eventStartTime, isSingleDayEvent]);

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

  const eventsSidebarContent = (
    <>
      <div className="mb-3 flex items-center justify-end">
        <button
          type="button"
          onClick={openCreateEventDialog}
          className="home-add-event-btn flex size-8 items-center justify-center rounded-lg border border-dashed border-[#BFC7D7] text-[#8A94A7]"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {selectedDateEvents.length ? (
        <div className="space-y-2">
          {selectedDateEvents.map((event) => {
            const hasTodos = event.todos.length > 0;
            const expanded = hasTodos && expandedEventId === event.id;
            const sameDayRange = isSameDay(event.start, event.end);
            const eventStartDateLabel = format(
              event.startAt,
              "dd MMM yyyy",
            ).toUpperCase();
            const eventEndDateLabel = sameDayRange
              ? undefined
              : format(event.endAt, "dd MMM yyyy").toUpperCase();
            const eventStartDayLabel = format(event.startAt, "EEE").toUpperCase();
            const eventEndDayLabel = sameDayRange
              ? undefined
              : format(event.endAt, "EEE").toUpperCase();
            const eventStartTimeLabel = event.isAllDay
              ? "All day"
              : formatTimeRangeByPreference(
                  event.startAt,
                  event.startAt,
                  preferences.use24Hour,
                );
            const eventEndTimeLabel = event.isAllDay
              ? undefined
              : formatTimeRangeByPreference(
                  event.endAt,
                  event.endAt,
                  preferences.use24Hour,
                );

            return (
              <div
                key={event.id}
                className="home-event-card rounded-xl border border-[#D3DAE8] bg-[#DFE4EC] px-2 py-2"
                role="button"
                tabIndex={0}
                onClick={() => handleOpenEventDetails(event.id)}
                onKeyDown={(keyEvent) => {
                  if (keyEvent.key !== "Enter" && keyEvent.key !== " ") {
                    return;
                  }

                  keyEvent.preventDefault();
                  handleOpenEventDetails(event.id);
                }}
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
                          {/* <span className="mx-1 text-[#B6BDC9]">|</span> */}
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
                    {hasTodos ? (
                      <button
                        type="button"
                        className="inline-flex items-center justify-center"
                        aria-label={
                          expanded
                            ? "Collapse event todos"
                            : "Expand event todos"
                        }
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          setExpandedEventId((prev) =>
                            prev === event.id ? null : event.id,
                          );
                        }}
                      >
                        {expanded ? (
                          <ChevronUp className="size-4" />
                        ) : (
                          <ChevronDown className="size-4" />
                        )}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-1 space-y-1.5">
                  <HomeSidebarMetaRange
                    icon={CalendarDays}
                    startValue={eventStartDateLabel}
                    endValue={eventEndDateLabel}
                    startCaption={eventStartDayLabel}
                    endCaption={eventEndDayLabel}
                    showArrowMarkers={!event.isAllDay && !sameDayRange}
                  />
                  <HomeSidebarMetaRange
                    icon={Clock3}
                    startValue={eventStartTimeLabel}
                    endValue={eventEndTimeLabel}
                    emphasize
                  />
                </div>

                <p className="font-poppins mt-1 flex items-center gap-1 text-[12px] leading-[120%] text-[#7A8396]">
                  <MapPin className="size-3.5" />
                  {event.location}
                </p>

                {expanded ? (
                  <div className="ml-8 mt-2 space-y-2">
                    {event.todos.map((todo) => (
                      <HomeEventTodoRow
                        key={todo.id}
                        text={todo.text}
                        completed={todo.isCompleted}
                      />
                    ))}
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
    </>
  );

  return (
    <div className="home-page space-y-4">
      <BrickFilterBar
        bricks={bricks}
        selectedBrickIds={effectiveSelectedBrickIds}
        onToggleBrick={(brickId) =>
          setSelectedBrickIds((previous) =>
            toggleBrickSelection(previous, brickId, allBrickIds),
          )
        }
        onSelectAll={() =>
          setSelectedBrickIds((previous) =>
            toggleAllBrickSelection(previous, allBrickIds),
          )
        }
        onCreateBrick={() => setCreateBrickOpen(true)}
      />

      <section className="home-calendar-shell rounded-[30px] border border-[#DFE4ED] bg-[#F4F6FA] p-3 sm:p-4">
        {eventsQuery.isLoading ? (
          <SectionLoading rows={8} />
        ) : (
          <>
            <div className="home-calendar-layout grid !gap-4 xl:grid-cols-[272px_minmax(0,1fr)]">
              <aside className="home-events-sidebar hidden rounded-[24px] border border-[#D8DEEA] bg-[#ECEFF4] p-3 xl:block">
                {eventsSidebarContent}
              </aside>

              <div className="min-w-0 space-y-2">
                <div className="flex items-center justify-between xl:hidden">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-10 rounded-xl p-0"
                    onClick={() => setEventsDrawerOpen(true)}
                    aria-label="Open selected events drawer"
                  >
                    <PanelLeft className="size-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-10 rounded-xl p-0"
                    onClick={openCreateEventDialog}
                    aria-label="Create event"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>

                <div className="home-calendar-wrap w-full overflow-x-auto">
                  <div className="home-calendar-board min-w-[820px]">
                    <div className="mb-2 grid grid-cols-7 ">
                      {weekdayLabels.map((weekday) => {
                        const label = format(weekday, "EEE");
                        const isSundayLabel = weekday.getDay() === 0;

                        return (
                          <div key={label} className="px-2 py-1 text-center">
                            <p
                              className={`font-poppins text-[16px] leading-[120%] font-medium ${
                                isSundayLabel
                                  ? "!text-[#FF3B30]"
                                  : "!text-[var(--text-default)]"
                              }`}
                            >
                              {label}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="space-y-0 rounded-[18px] border border-[var(--border)] bg-[var(--surface-1)]">
                      {weeks.map((week, weekIndex) => {
                        const weekInfo = buildWeekSegments(
                          week,
                          filteredEvents,
                        );
                        const shouldScrollSegments = weekInfo.laneCount > 3;

                        return (
                          <div
                            key={`${format(week[0], "yyyy-MM-dd")}-${weekIndex}`}
                            className="relative grid grid-cols-7 overflow-hidden border-b border-[var(--border)] last:border-b-0"
                          >
                            {week.map((day, dayIndex) => {
                              const isInSelectedRange =
                                day >= selectedDateRange.start &&
                                day <= selectedDateRange.end;
                              const isSunday = day.getDay() === 0;
                              const isLastDayOfWeek =
                                dayIndex === week.length - 1;
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
                                  className={`home-day-cell relative flex h-[136px] select-none items-start justify-center px-2 pt-3 pb-2 text-center ${
                                    isLastDayOfWeek
                                      ? "border-r-0"
                                      : "border-r border-[var(--border)]"
                                  } ${
                                    isInSelectedRange
                                      ? "bg-[var(--surface-2)]"
                                      : ""
                                  }`}
                                >
                                  <span
                                    className={`font-poppins inline-flex min-w-[32px] items-center justify-center rounded-xl px-2 text-[20px] leading-[120%] font-medium ${
                                      isInSelectedRange
                                        ? "text-[var(--text-strong)]"
                                        : isSunday
                                          ? "text-[#FF3B30]"
                                          : isSameMonth(day, monthCursor)
                                            ? "text-[var(--text-default)]"
                                            : "text-[var(--text-muted)]"
                                    }`}
                                  >
                                    {format(day, "d")}
                                  </span>
                                </button>
                              );
                            })}

                            <div className="pointer-events-none absolute inset-x-0 top-14">
                              <div
                                className={`grid grid-cols-7 auto-rows-[20px] ${
                                  shouldScrollSegments
                                    ? "pointer-events-auto max-h-[80px] overflow-y-auto"
                                    : ""
                                }`}
                              >
                                {weekInfo.segments.map((segment) => (
                                  <div
                                    key={segment.id}
                                    style={{
                                      gridColumn: `${segment.startCol} / ${segment.endCol + 1}`,
                                      gridRow: segment.lane + 1,
                                      backgroundColor: segment.color,
                                      color: "#FFFFFF",
                                    }}
                                    className="flex h-[18px] items-center overflow-hidden rounded-[1px]"
                                  >
                                    {segment.isStart ? (
                                      <span className="truncate px-1 font-poppins text-[14px] leading-[120%] font-medium text-white">
                                        {segment.title}
                                      </span>
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
            </div>

            <AnimatePresence>
              {eventsDrawerOpen ? (
                <div className="fixed inset-0 z-50 xl:hidden">
                  <motion.button
                    type="button"
                    className="absolute inset-0 bg-black/35"
                    onClick={() => setEventsDrawerOpen(false)}
                    aria-label="Close selected events drawer overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                  <motion.aside
                    className="home-events-sidebar absolute left-0 top-0 h-full w-[86%] max-w-[340px] overflow-y-auto border-r border-[var(--border)] bg-[var(--surface-2)] p-4 shadow-[0_16px_44px_rgba(17,24,37,0.20)]"
                    initial={{ x: -36, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -24, opacity: 0 }}
                    transition={{ duration: 0.24 }}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <p className="font-poppins text-[22px] leading-[120%] font-semibold text-[var(--text-strong)]">
                        Day Events
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 w-10 rounded-xl p-0"
                        onClick={() => setEventsDrawerOpen(false)}
                        aria-label="Close selected events drawer"
                      >
                        <X className="size-5" />
                      </Button>
                    </div>
                    {eventsSidebarContent}
                  </motion.aside>
                </div>
              ) : null}
            </AnimatePresence>
          </>
        )}
      </section>

      <Dialog open={createBrickOpen} onOpenChange={setCreateBrickOpen}>
        <DialogContent className="max-w-5xl rounded-[28px] border border-[var(--border)] bg-[var(--surface-1)] p-4 sm:p-6 space-y-2">
          <DialogHeader>
            <DialogTitle className="text-3xl text-[var(--text-strong)]">
              Create Brick
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Brick name"
              value={brickName}
              onChange={(event) => setBrickName(event.target.value)}
            />
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-2)] p-3 sm:p-4">
              <div className="grid grid-cols-10 gap-2 sm:gap-3">
                {colorPalette.map((color) => (
                  <button
                    type="button"
                    key={color}
                    onClick={() => setBrickColor(color)}
                    className={`size-8 rounded-full border-2 transition sm:size-10 ${
                      brickColor === color
                        ? "border-[#283040] scale-[1.05]"
                        : "border-transparent"
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
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-2)] p-3 sm:p-4">
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 sm:gap-2.5 md:grid-cols-10">
                  {brickIconOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setBrickIcon(option.value)}
                      className={`flex h-9 items-center justify-center rounded-xl border transition sm:h-10 ${
                        brickIcon === option.value
                          ? "border-[#36A9E1] bg-[#DDECFF] text-[#1B5FB8]"
                          : "border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-default)] hover:border-[var(--ring)]"
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

            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
              <span
                className="h-5 w-5 rounded-full"
                style={{ backgroundColor: brickColor }}
              />
              <BrickIcon name={brickIcon} className="size-4" />
              <span className="font-poppins text-[14px] font-medium text-[var(--text-default)]">
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

      <Dialog
        open={createEventOpen}
        onOpenChange={(open) => {
          if (open) {
            openCreateEventDialog();
            return;
          }
          setCreateEventOpen(false);
        }}
      >
        <DialogContent className="max-w-2xl rounded-[26px] space-y-4">
          <DialogHeader>
            <DialogTitle className="text-3xl">Create Event</DialogTitle>
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
            <div className="space-y-3">
              <EventRangeField
                kind="date"
                startValue={eventStartDate}
                endValue={eventEndDate}
                onClick={() => setEventDatePopupOpen(true)}
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                {eventIsAllDay ? (
                  <EventSingleField kind="time" label="All day" />
                ) : (
                  <EventRangeField
                    kind="time"
                    startValue={eventStartTime}
                    endValue={eventEndTime}
                    use24Hour={preferences.use24Hour}
                    collapseSingleValue={isSingleDayEvent}
                    onClick={() => setEventTimePopupOpen(true)}
                    disabled={!hasEventDateRange}
                    className="max-w-full"
                  />
                )}
                <AllDayTabToggle
                  active={eventIsAllDay}
                  onToggle={() => {
                    const next = !eventIsAllDay;
                    setEventIsAllDay(next);
                    if (next) {
                      setEventTimePopupOpen(false);
                    }
                  }}
                  className="self-end sm:self-auto"
                />
              </div>
            </div>

            <EventBrickSelector
              bricks={bricks}
              selectedBrickId={newEventBrick}
              onSelectBrick={(brickId) => {
                setNewEventBrick(brickId);
                setPreferredCreateEventBrickId(brickId);
              }}
              badgeClassName="!text-[14px]"
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => createEventMutation.mutate()}
              disabled={createEventMutation.isPending}
            >
              {createEventMutation.isPending ? "Creating..." : "Create Event"}
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
        selectionMode={isSingleDayEvent ? "single" : "range"}
        onApply={({ startTime, endTime, rollsEndToNextDay }) => {
          setEventStartTime(startTime);
          setEventEndTime(endTime);
          if (
            rollsEndToNextDay &&
            eventStartDate &&
            eventEndDate &&
            eventStartDate === eventEndDate
          ) {
            setEventEndDate(
              format(
                addDays(new Date(`${eventEndDate}T00:00:00`), 1),
                "yyyy-MM-dd",
              ),
            );
            toast.message("End time moved the end date to the next day.");
          }
        }}
      />
    </div>
  );
}
