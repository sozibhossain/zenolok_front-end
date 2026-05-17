"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
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
  ChevronDown,
  ChevronUp,
  ListTodo,
  MapPin,
  MessageCircle,
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
} from "@/components/shared/event-brick-selector";
import {
  EventDateRangePopup,
  EventTimeRangePopup,
} from "@/components/shared/event-date-time-popups";
import { EventDateTimeRangeField } from "@/components/shared/event-range-field";
import { SectionLoading } from "@/components/shared/section-loading";
import { TodoStatusCircle } from "@/components/shared/todo-status-circle";
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
import {
  brickApi,
  eventApi,
  eventTodoApi,
  notificationApi,
  type EventData,
  type EventTodo,
} from "@/lib/api";
import {
  isMessageNotification,
  notificationMatchesEvent,
} from "@/lib/notifications";
import { brickIconOptions, getBrickSvg } from "@/lib/brick-icons";
import { NO_BRICK_EVENT_COLOR } from "@/lib/event-colors";
import { colorPalette } from "@/lib/presets";
import { queryKeys } from "@/lib/query-keys";
import {
  toggleAllBrickSelection,
  toggleBrickSelection,
} from "@/lib/brick-filter-selection";
import { formatTimeRangeByPreference } from "@/lib/time-format";

type CalendarEvent = {
  id: string;
  originalId: string;
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
  reminder?: string;
  alarmPreset?: EventData["alarmPreset"];
  recurrence: EventData["recurrence"];
  recurrenceUntil?: Date | null;
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

const HOME_TODO_CREATE_DEBOUNCE_MS = 1000;
const CALENDAR_SEGMENT_ROW_HEIGHT = 18;
const CALENDAR_SEGMENT_ROW_GAP = 0;
const CALENDAR_SEGMENT_TOP_OFFSET = 40;
const CALENDAR_CELL_HORIZONTAL_PADDING = 0;
const CALENDAR_SEGMENT_STACK_CLEARANCE = 4;

function updateEventTodoInList(
  events: EventData[] | undefined,
  eventId: string,
  todoId: string,
  isCompleted: boolean,
) {
  if (!events) {
    return events;
  }

  return events.map((event) => {
    if (event._id !== eventId || !event.todos) {
      return event;
    }

    return {
      ...event,
      todos: event.todos.map((todo) =>
        todo._id === todoId ? { ...todo, isCompleted } : todo,
      ),
    };
  });
}

function updateSingleEventTodo(
  event: EventData | undefined,
  todoId: string,
  isCompleted: boolean,
) {
  if (!event?.todos) {
    return event;
  }

  return {
    ...event,
    todos: event.todos.map((todo) =>
      todo._id === todoId ? { ...todo, isCompleted } : todo,
    ),
  };
}

function updateEventTodoCollection(
  todos: EventTodo[] | undefined,
  todoId: string,
  isCompleted: boolean,
) {
  if (!todos) {
    return todos;
  }

  return todos.map((todo) =>
    todo._id === todoId ? { ...todo, isCompleted } : todo,
  );
}

function HomeEventTodoRow({
  text,
  completed,
  color,
  onToggle,
  disabled = false,
}: {
  text: string;
  completed: boolean;
  color: string;
  onToggle?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggle?.();
      }}
      disabled={disabled || !onToggle}
      className="flex w-full items-center gap-2 rounded-md text-left transition hover:bg-[var(--surface-1)] disabled:cursor-not-allowed disabled:opacity-60"
      aria-label={completed ? `Mark ${text} incomplete` : `Mark ${text} complete`}
    >
      <TodoStatusCircle
        checked={completed}
        checkedColor={color}
        uncheckedColor="var(--light-gray2, #D5D5D5)"
        aria-hidden="true"
        className="size-6 bg-transparent"
      />
      <span
        className={`font-poppins text-[15px] leading-[120%] font-medium`}
      >
        {text}
      </span>
    </button>
  );
}

function HomeEventTodoCreateInput({
  onAdd,
}: {
  onAdd: (text: string) => Promise<void> | Promise<unknown> | void;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValueRef = React.useRef("");
  const [value, setValue] = React.useState("");
  const [saveState, setSaveState] = React.useState<"idle" | "saving">("idle");

  React.useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const stopPropagation = React.useCallback(
    (event: React.SyntheticEvent) => {
      event.stopPropagation();
    },
    [],
  );

  const restoreFocus = React.useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const submit = React.useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const trimmed = latestValueRef.current.trim();
    if (!trimmed) {
      restoreFocus();
      return;
    }

    setSaveState("saving");
    try {
      await onAdd(trimmed);
      setValue("");
      latestValueRef.current = "";
    } catch {
      // Caller handles error display.
    } finally {
      setSaveState("idle");
      requestAnimationFrame(() => {
        restoreFocus();
      });
    }
  }, [onAdd, restoreFocus]);

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      setValue(nextValue);
      latestValueRef.current = nextValue;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      if (!nextValue.trim()) {
        return;
      }

      debounceTimerRef.current = setTimeout(() => {
        void submit();
      }, HOME_TODO_CREATE_DEBOUNCE_MS);
    },
    [submit],
  );

  return (
    <div
      className="pl-7"
      onClick={stopPropagation}
      onMouseDown={stopPropagation}
    >
      <Input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key !== "Enter") {
            return;
          }

          event.preventDefault();
          void submit();
        }}
        placeholder="New todo"
        disabled={saveState === "saving"}
        className="h-auto border-none bg-transparent px-0 py-0 font-poppins text-sm text-[var(--text-muted)] shadow-none placeholder:text-[var(--text-muted)] focus-visible:ring-0"
        aria-label="Create new todo"
      />
    </div>
  );
}

function HomeHoverRevealText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  return (
    <span
      className={`home-hover-reveal block min-w-0 ${className}`}
      data-full-text={text}
      title={text}
    >
      <span className="block truncate">{text}</span>
    </span>
  );
}

function HomeEventMetaRow({
  location,
  className = "",
}: {
  location: string;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 items-center gap-1.5 ${className}`}>
      <MapPin
        className="size-3.5 shrink-0 text-[var(--text-muted)]"
        strokeWidth={2.2}
      />
      <HomeHoverRevealText
        text={location}
        className="flex-1 font-poppins text-xs text-[var(--text-muted)]"
      />
    </div>
  );
}

function formatSidebarClock(date: Date, use24Hour: boolean) {
  if (use24Hour) {
    return { main: format(date, "HH:mm"), suffix: "" };
  }

  return { main: format(date, "h:mm"), suffix: format(date, "a") };
}

type HomeSidebarActionIconProps = {
  icon: React.ComponentType<{ className?: string }>;
  badgeCount?: number;
  label: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

function HomeSidebarActionIcon({
  icon: Icon,
  badgeCount = 0,
  label,
  onClick,
}: HomeSidebarActionIconProps) {
  const badge = badgeCount > 0 ? (
    <span className="absolute -top-2.5 right-0 inline-flex size-[18px] items-center justify-center rounded-full bg-[#FF4D42] text-[10px] font-semibold leading-none text-white">
      {badgeCount}
    </span>
  ) : null;

  if (onClick) {
    return (
      <button
        type="button"
        className="relative inline-flex size-7 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--surface-1)] hover:text-[var(--text-default)]"
        aria-label={label}
        onClick={onClick}
      >
        <Icon className="size-[15px]" />
        {badge}
      </button>
    );
  }

  return (
    <span
      className="relative inline-flex size-7 items-center justify-center rounded-full text-[var(--text-muted)]"
      aria-hidden="true"
    >
      <Icon className="size-[15px]" />
      {badge}
    </span>
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

function expandRecurringEvent(
  event: CalendarEvent,
  rangeEnd: Date,
): CalendarEvent[] {
  if (event.recurrence === "once") {
    return [event];
  }

  // Drop the base occurrence if the series was capped before its own start.
  const untilTime = event.recurrenceUntil
    ? event.recurrenceUntil.getTime()
    : null;
  if (untilTime !== null && event.startAt.getTime() > untilTime) {
    return [];
  }

  const occurrences: CalendarEvent[] = [event];
  const durationMs = event.endAt.getTime() - event.startAt.getTime();
  const rangeEndTime = rangeEnd.getTime();
  const hardCap =
    untilTime !== null ? Math.min(rangeEndTime, untilTime) : rangeEndTime;

  let nextStart = event.startAt;
  for (let index = 0; index < 400; index += 1) {
    if (event.recurrence === "daily") {
      nextStart = addDays(nextStart, 1);
    } else if (event.recurrence === "weekly") {
      nextStart = addWeeks(nextStart, 1);
    } else if (event.recurrence === "monthly") {
      nextStart = addMonths(nextStart, 1);
    } else if (event.recurrence === "yearly") {
      nextStart = addYears(nextStart, 1);
    } else {
      break;
    }

    if (nextStart.getTime() > hardCap) {
      break;
    }

    const nextEnd = new Date(nextStart.getTime() + durationMs);
    const start = startOfDay(nextStart);
    const rawEnd = startOfDay(nextEnd);
    const end = rawEnd < start ? start : rawEnd;

    occurrences.push({
      ...event,
      id: `${event.id}-rec-${format(start, "yyyy-MM-dd")}`,
      startAt: nextStart,
      endAt: nextEnd,
      start,
      end,
      spansMultipleDays: differenceInCalendarDays(end, start) > 0,
    });
  }

  return occurrences;
}

function buildWeekSegments(
  week: Date[],
  events: CalendarEvent[],
): { segments: WeekSegment[]; laneCount: number } {
  const weekStart = startOfDay(week[0]);
  const weekEnd = startOfDay(week[6]);

  const relevant = events
    .filter(
      (event) => event.spansMultipleDays && intersectsWeek(event, weekStart, weekEnd),
    )
    .sort(
      (a, b) =>
        a.start.getTime() - b.start.getTime() ||
        Number(b.isAllDay) - Number(a.isAllDay) ||
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
  const [showAllTodosEventId, setShowAllTodosEventId] = React.useState<string | null>(null);
  const [eventsDrawerOpen, setEventsDrawerOpen] = React.useState(false);
  const [expandedDayKey, setExpandedDayKey] = React.useState<string | null>(null);

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
  const recurringEventsQuery = useQuery({
    queryKey: queryKeys.events({ filter: "all" }),
    queryFn: () => eventApi.getAll({ filter: "all" }),
  });
  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: notificationApi.getAll,
    enabled: Boolean(session),
    staleTime: 30_000,
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
    const expansionLimit = endOfDay(calendarEnd);
    const seenIds = new Set<string>();
    const sourceEvents: EventData[] = [];

    for (const event of eventsQuery.data || []) {
      if (seenIds.has(event._id)) {
        continue;
      }
      seenIds.add(event._id);
      sourceEvents.push(event);
    }

    for (const event of recurringEventsQuery.data || []) {
      if (seenIds.has(event._id)) {
        continue;
      }
      if (!event.recurrence || event.recurrence === "once") {
        continue;
      }
      seenIds.add(event._id);
      sourceEvents.push(event);
    }

    return sourceEvents.reduce<CalendarEvent[]>(
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
          : event.brick?.color || NO_BRICK_EVENT_COLOR;

        const baseEvent: CalendarEvent = {
          id: event._id,
          originalId: event._id,
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
          reminder: event.reminder ?? "none",
          alarmPreset: event.alarmPreset ?? "none",
          recurrence: event.recurrence ?? "once",
          recurrenceUntil: event.recurrenceUntil
            ? new Date(event.recurrenceUntil)
            : null,
          todos: (event.todos || [])
            .filter((todo) => {
              if (!currentUserId) {
                return true;
              }

              return (
                todo.createdBy === currentUserId ||
                Boolean(todo.participants?.includes(currentUserId))
              );
            })
            .map((todo) => ({
              id: todo._id,
              text: todo.text,
              isCompleted: todo.isCompleted,
            })),
        };

        items.push(...expandRecurringEvent(baseEvent, expansionLimit));
        return items;
      },
      [],
    );
  }, [calendarEnd, currentUserId, eventsQuery.data, recurringEventsQuery.data]);

  const filteredEvents = React.useMemo(() => {
    if (!allBrickIds.length) {
      return normalizedEvents;
    }

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
  }, [allBrickIds, allBricksSelected, effectiveSelectedBrickIds, normalizedEvents]);
  const unreadMessageCountByEventId = React.useMemo(() => {
    const unreadMessageNotifications = (
      notificationsQuery.data?.items ?? []
    ).filter(
      (notification) =>
        !notification.read && isMessageNotification(notification),
    );

    return filteredEvents.reduce<Record<string, number>>((accumulator, event) => {
      accumulator[event.id] = unreadMessageNotifications.filter((notification) =>
        notificationMatchesEvent(notification, event),
      ).length;
      return accumulator;
    }, {});
  }, [filteredEvents, notificationsQuery.data?.items]);
  const unreadAlertCountByEventId = React.useMemo(() => {
    const unreadAlertNotifications = (
      notificationsQuery.data?.items ?? []
    ).filter(
      (notification) =>
        !notification.read && !isMessageNotification(notification),
    );

    return filteredEvents.reduce<Record<string, number>>((accumulator, event) => {
      accumulator[event.id] = unreadAlertNotifications.filter((notification) =>
        notificationMatchesEvent(notification, event),
      ).length;
      return accumulator;
    }, {});
  }, [filteredEvents, notificationsQuery.data?.items]);

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
      if (a.spansMultipleDays !== b.spansMultipleDays) {
        return a.spansMultipleDays ? -1 : 1;
      }
      if (a.isAllDay !== b.isAllDay) {
        return a.isAllDay ? -1 : 1;
      }
      return a.startAt.getTime() - b.startAt.getTime();
    });
  }, [filteredEvents, selectedDate]);

  const singleDayEventsByDate = React.useMemo(() => {
    const byDate = new Map<string, CalendarEvent[]>();

    for (const event of filteredEvents) {
      if (event.spansMultipleDays) {
        continue;
      }

      const key = format(event.start, "yyyy-MM-dd");
      const current = byDate.get(key) ?? [];
      current.push(event);
      byDate.set(key, current);
    }

    for (const events of byDate.values()) {
      events.sort((a, b) => {
        if (a.isAllDay !== b.isAllDay) {
          return a.isAllDay ? -1 : 1;
        }

        return a.startAt.getTime() - b.startAt.getTime();
      });
    }

    return byDate;
  }, [filteredEvents]);
  const handleOpenEventDetails = React.useCallback(
    (eventId: string, occurrenceDate?: Date) => {
      setEventsDrawerOpen(false);
      setExpandedDayKey(null);
      const path = occurrenceDate
        ? `/events/${eventId}?occurrenceDate=${encodeURIComponent(
            occurrenceDate.toISOString(),
          )}`
        : `/events/${eventId}`;
      router.push(path);
    },
    [router],
  );
  const hasEventDateRange = Boolean(eventStartDate && eventEndDate);
  const isEventSingleDayEvent = Boolean(
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
    setNewEventBrick("");
    setCreateEventOpen(true);
  }, [selectedDateRange]);

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
      setBrickName("");
      setBrickColor("#36A9E1");
      setBrickIcon("home");
      if (createEventOpen) {
        setNewEventBrick(createdBrick._id);
      }
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

      if (!eventIsAllDay && !eventStartTime) {
        throw new Error("Start time is required");
      }

      if (!eventIsAllDay && !eventEndTime) {
        throw new Error("Start and end times are required");
      }

      const startDate = new Date(
        `${eventStartDate}T${eventStartTime || "00:00"}:00`,
      );
      const endDate = new Date(
        `${eventEndDate}T${eventEndTime || "00:00"}:00`,
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
  const createEventTodoMutation = useMutation({
    mutationFn: ({
      eventId,
      text,
    }: {
      eventId: string;
      text: string;
    }) => {
      if (!text.trim()) {
        throw new Error("Todo text is required");
      }

      return eventTodoApi.create({
        eventId,
        text: text.trim(),
      });
    },
    onSuccess: (_todo, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.event(eventId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.eventTodos(eventId),
      });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to add todo"),
  });
  const toggleEventTodoMutation = useMutation({
    mutationFn: ({
      todoId,
      isCompleted,
    }: {
      eventId: string;
      todoId: string;
      isCompleted: boolean;
    }) => eventTodoApi.update(todoId, { isCompleted }),
    onMutate: async ({ eventId, todoId, isCompleted }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["events"] }),
        queryClient.cancelQueries({ queryKey: queryKeys.event(eventId) }),
        queryClient.cancelQueries({ queryKey: queryKeys.eventTodos(eventId) }),
      ]);

      const previousEventLists = queryClient.getQueriesData<EventData[]>({
        queryKey: ["events"],
      });
      const previousEvent = queryClient.getQueryData<EventData>(
        queryKeys.event(eventId),
      );
      const previousEventTodos = queryClient.getQueryData<EventTodo[]>(
        queryKeys.eventTodos(eventId),
      );

      queryClient.setQueriesData<EventData[]>(
        { queryKey: ["events"] },
        (current) =>
          updateEventTodoInList(current, eventId, todoId, isCompleted),
      );
      queryClient.setQueryData<EventData>(queryKeys.event(eventId), (current) =>
        updateSingleEventTodo(current, todoId, isCompleted),
      );
      queryClient.setQueryData<EventTodo[]>(
        queryKeys.eventTodos(eventId),
        (current) => updateEventTodoCollection(current, todoId, isCompleted),
      );

      return {
        eventId,
        previousEventLists,
        previousEvent,
        previousEventTodos,
      };
    },
    onError: (error: Error, _variables, context) => {
      context?.previousEventLists.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });

      if (context?.previousEvent) {
        queryClient.setQueryData(
          queryKeys.event(context.eventId),
          context.previousEvent,
        );
      }

      if (context?.previousEventTodos) {
        queryClient.setQueryData(
          queryKeys.eventTodos(context.eventId),
          context.previousEventTodos,
        );
      }

      toast.error(error.message || "Failed to update todo");
    },
    onSettled: (_data, _error, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.event(eventId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.eventTodos(eventId),
      });
    },
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
    if (!selectedDateEvents.length) {
      setExpandedEventId(null);
      return;
    }

    setExpandedEventId((prev) => {
      if (prev && selectedDateEvents.some((event) => event.id === prev)) {
        return prev;
      }

      return null;
    });
  }, [selectedDateEvents]);

  const sidebarHeight = weeks.length * 136 + 36;

  const eventsSidebarContent = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-end">
        <button
          type="button"
          onClick={openCreateEventDialog}
          className="home-add-event-btn flex size-8 items-center justify-center rounded-lg border border-dashed border-[#BFC7D7] text-[#8A94A7]"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <div className="drag-scrollbar-hidden min-h-0 flex-1 overflow-y-auto pr-1">
        {selectedDateEvents.length ? (
          <div className="space-y-2">
            {selectedDateEvents.map((event) => {
              const hasTodos = event.todos.length > 0;
              const expanded = hasTodos && expandedEventId === event.id;
              const incompleteTodoCount = event.todos.filter(
                (todo) => !todo.isCompleted,
              ).length;
              const hasAlarm = event.alarmPreset !== "none";
              const hasRepeat = event.recurrence !== "once";
              const messageCount = unreadMessageCountByEventId[event.id] ?? 0;
              const alertCount = unreadAlertCountByEventId[event.id] ?? 0;
              const typeLabel = event.spansMultipleDays
                ? "Streak"
                : event.isAllDay
                  ? "All day"
                  : null;
              const rangeLabel = event.spansMultipleDays
                ? `${format(event.startAt, "dd MMM yyyy").toUpperCase()} - ${format(
                    event.endAt,
                    "dd MMM yyyy",
                  ).toUpperCase()}`
                : null;
              const startClock = formatSidebarClock(
                event.startAt,
                preferences.use24Hour,
              );
              const endClock = formatSidebarClock(
                event.endAt,
                preferences.use24Hour,
              );

              return (
                <div
                  key={event.id}
                  className="group/home-event relative overflow-visible rounded-2xl bg-transparent hover:z-30 focus-within:z-30"
                >
                  <div
                    className="home-event-card rounded-2xl border border-[var(--border)] bg-[var(--surface-3)] px-3 pt-3 pb-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      handleOpenEventDetails(event.originalId, event.startAt)
                    }
                    onKeyDown={(keyEvent) => {
                      if (keyEvent.key !== "Enter" && keyEvent.key !== " ") {
                        return;
                      }

                      keyEvent.preventDefault();
                      handleOpenEventDetails(event.originalId, event.startAt);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        {typeLabel ? (
                          <>
                            <div className="flex items-center gap-2">
                              <span
                                className="h-9 w-1.5 shrink-0 rounded-full"
                                style={{ backgroundColor: event.color }}
                              />
                              <div className="flex min-w-0 items-center gap-2">
                                <span
                                  className="shrink-0 font-poppins text-sm font-semibold"
                                  style={{
                                    color: event.color,
                                  }}
                                >
                                  {typeLabel}
                                </span>
                                <span className="h-5 w-px shrink-0 bg-[var(--border)]" />
                                <HomeHoverRevealText
                                  text={event.title}
                                  className="font-poppins text-base font-medium text-[var(--text-default)]"
                                />
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span
                              className="h-10 w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: event.color }}
                            />
                            <div className="flex min-w-0 items-center gap-2.5">
                              <div className="w-13 shrink-0">
                                <p className="font-poppins text-sm font-semibold text-[var(--text-default)]">
                                  {startClock.main}
                                  {startClock.suffix ? (
                                    <span className="ml-0.5 align-top text-xs font-semibold text-[var(--text-muted)]">
                                      {startClock.suffix}
                                    </span>
                                  ) : null}
                                </p>
                                <p className="mt-0.5 font-poppins text-xs text-[var(--text-muted)]">
                                  {endClock.main}
                                  {endClock.suffix ? (
                                    <span className="ml-0.5 align-top text-xs font-medium text-[var(--text-muted)]">
                                      {endClock.suffix}
                                    </span>
                                  ) : null}
                                </p>
                              </div>
                              <span className="h-8 w-px shrink-0 bg-[var(--border)]" />
                              <div className="min-w-0">
                                <HomeHoverRevealText
                                  text={event.title}
                                  className="font-poppins text-sm font-medium text-[var(--text-default)]"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-0.5 text-[var(--text-muted)]">
                        {event.spansMultipleDays ? (
                          <HomeSidebarActionIcon
                            icon={MessageCircle}
                            badgeCount={messageCount}
                            label={`${event.title} streak updates`}
                          />
                        ) : null}

                        {hasRepeat ? (
                          <HomeSidebarActionIcon
                            icon={RefreshCw}
                            label={`${event.title} recurrence`}
                          />
                        ) : null}

                        {hasAlarm ? (
                          <HomeSidebarActionIcon
                            icon={Bell}
                            badgeCount={alertCount}
                            label={`${event.title} alerts`}
                          />
                        ) : null}

                        {hasTodos ? (
                          <HomeSidebarActionIcon
                            icon={ListTodo}
                            badgeCount={incompleteTodoCount}
                            label={`${event.title} tasks`}
                          />
                        ) : null}

                        {hasTodos ? (
                          <button
                            type="button"
                            className="inline-flex size-7 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--surface-1)] hover:text-[var(--text-default)]"
                            aria-label={
                              expanded
                                ? "Collapse event todos"
                                : "Expand event todos"
                            }
                            onClick={(clickEvent) => {
                              clickEvent.stopPropagation();
                              setExpandedEventId((prev) => {
                                const next = prev === event.id ? null : event.id;
                                if (next === null) setShowAllTodosEventId(null);
                                return next;
                              });
                            }}
                          >
                            {expanded ? (
                              <ChevronUp className="size-[18px]" />
                            ) : (
                              <ChevronDown className="size-[18px]" />
                            )}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {rangeLabel ? (
                      <HomeHoverRevealText
                        text={rangeLabel}
                        className="ml-[22px] mt-1.5 w-[calc(100%-22px)] font-poppins text-xs text-[var(--text-muted)]"
                      />
                    ) : null}
                    <HomeEventMetaRow
                      location={event.location}
                      className="ml-[22px] mt-1.5 w-[calc(100%-22px)]"
                    />

                    {expanded ? (() => {
                      const VISIBLE_LIMIT = 3;
                      const showAll = showAllTodosEventId === event.id;
                      const sortedExpandedTodos = [...event.todos].sort(
                        (a, b) => Number(a.isCompleted) - Number(b.isCompleted),
                      );
                      const visibleTodos = showAll
                        ? sortedExpandedTodos
                        : sortedExpandedTodos.slice(0, VISIBLE_LIMIT);
                      const hiddenCount = Math.max(0, sortedExpandedTodos.length - VISIBLE_LIMIT);

                      return (
                        <div className="mt-3 flex flex-col gap-2 pl-8 pb-1">
                          <div className="space-y-2">
                            {visibleTodos.map((todo) => (
                              <HomeEventTodoRow
                                key={todo.id}
                                text={todo.text}
                                completed={todo.isCompleted}
                                color={event.color}
                                onToggle={() =>
                                  toggleEventTodoMutation.mutate({
                                    eventId: event.originalId,
                                    todoId: todo.id,
                                    isCompleted: !todo.isCompleted,
                                  })
                                }
                                disabled={
                                  toggleEventTodoMutation.isPending &&
                                  toggleEventTodoMutation.variables?.todoId === todo.id
                                }
                              />
                            ))}
                            {!showAll && hiddenCount > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowAllTodosEventId(event.id);
                                }}
                                className="font-poppins text-[12px] font-semibold text-[var(--text-muted)] transition hover:text-[var(--text-default)]"
                              >
                                +{hiddenCount}
                              </button>
                            ) : null}
                          </div>
                          <HomeEventTodoCreateInput
                            onAdd={(text) =>
                              createEventTodoMutation.mutateAsync({
                                eventId: event.originalId,
                                text,
                              })
                            }
                          />
                        </div>
                      );
                    })() : null}
                  </div>
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
      </div>
    </div>
  );

  const openDayEventsPanel = React.useCallback(
    (day: Date) => {
      const normalized = startOfDay(day);
      const dayKey = format(normalized, "yyyy-MM-dd");
      setSelectedDateRange({ start: normalized, end: normalized });
      skipRangeSyncRef.current = true;
      setSelectedDate(normalized);
      setExpandedDayKey((previous) => (previous === dayKey ? null : dayKey));
    },
    [setSelectedDate],
  );

  const handleDayEventsWheel = React.useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.scrollTop += event.deltaY;
    },
    [],
  );

  React.useEffect(() => {
    setExpandedDayKey(null);
  }, [monthCursor]);

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
              <aside
                className="home-events-sidebar hidden min-h-0 rounded-[24px] border border-[#D8DEEA] bg-[#ECEFF4] p-3 xl:flex xl:flex-col"
                style={{ height: sidebarHeight }}
              >
                {eventsSidebarContent}
              </aside>

              <div className="min-w-0 space-y-2 ">
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
                        const visiblePeriodRows = Math.min(weekInfo.laneCount, 2);

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
                              const dayKey = format(day, "yyyy-MM-dd");
                              const dayEvents =
                                singleDayEventsByDate.get(dayKey) ?? [];
                              const occupiedPeriodRows = weekInfo.segments.filter(
                                (segment) =>
                                  segment.startCol <= dayIndex + 1 &&
                                  segment.endCol >= dayIndex + 1 &&
                                  segment.lane < visiblePeriodRows,
                              ).length;
                              const visibleSlots = Math.max(
                                0,
                                4 - occupiedPeriodRows,
                              );
                              const visibleDayEvents = dayEvents.slice(
                                0,
                                visibleSlots,
                              );
                              const hiddenDayEventsCount = Math.max(
                                0,
                                dayEvents.length - visibleDayEvents.length,
                              );
                              const isExpandedDay = expandedDayKey === dayKey;
                              return (
                                <button
                                  key={format(day, "yyyy-MM-dd")}
                                  type="button"
                                  onClick={() => openDayEventsPanel(day)}
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
                                  className={`home-day-cell relative flex h-[136px] select-none flex-col items-stretch pt-2 text-left ${
                                    isLastDayOfWeek
                                      ? "border-r-0"
                                      : "border-r border-[var(--border)]"
                                  } ${
                                    isInSelectedRange
                                      ? "bg-[var(--surface-2)]"
                                      : ""
                                  }`}
                                >
                                  <div className="flex justify-center">
                                    <span
                                      className={`font-poppins inline-flex min-w-[32px] min-h-[32px] items-center justify-center rounded-full p-1 text-[20px] leading-[120%] font-medium ${
                                        isInSelectedRange
                                          ? "bg-[var(--home-calendar-selected-day-bg)] text-[var(--home-calendar-selected-day-text)]"
                                          : isSunday
                                            ? "text-[#FF3B30]"
                                            : isSameMonth(day, monthCursor)
                                              ? "text-[var(--text-default)]"
                                              : "text-[var(--text-muted)]"
                                      }`}
                                    >
                                      {format(day, "d")}
                                    </span>
                                  </div>

                                  <div
                                    className="flex-1 space-y-0 overflow-hidden"
                                    style={{
                                      paddingLeft: CALENDAR_CELL_HORIZONTAL_PADDING,
                                      paddingRight: CALENDAR_CELL_HORIZONTAL_PADDING,
                                      paddingTop:
                                        occupiedPeriodRows > 0
                                          ? occupiedPeriodRows *
                                              (CALENDAR_SEGMENT_ROW_HEIGHT +
                                                CALENDAR_SEGMENT_ROW_GAP) +
                                            CALENDAR_SEGMENT_STACK_CLEARANCE
                                          : 0,
                                    }}
                                  >
                                    {visibleDayEvents.map((event) => {
                                      if (event.isAllDay) {
                                        return (
                                          <div
                                            key={event.id}
                                            className="flex h-[16px] min-w-0 items-center gap-1.5 overflow-hidden"
                                          >
                                            <span
                                              className="h-3 w-0.75 shrink-0 rounded-[1px]"
                                              style={{
                                                backgroundColor: event.color,
                                              }}
                                            />
                                            <span className="truncate font-poppins text-[12px] leading-none font-semibold text-(--text-default)">
                                              {event.title}
                                            </span>
                                          </div>
                                        );
                                      }

                                      return (
                                        <div
                                          key={event.id}
                                          className="flex h-[16px] min-w-0 items-center gap-1.5 overflow-hidden"
                                        >
                                          <span
                                            className="h-3 w-0.75 shrink-0 rounded-[1px]"
                                            style={{
                                              backgroundColor: event.color,
                                            }}
                                          />
                                          <span className="truncate font-poppins text-[12px] leading-none font-medium text-(--text-default)">
                                            {event.title}
                                          </span>
                                        </div>
                                      );
                                    })}
                                    {hiddenDayEventsCount > 0 ? (
                                      <button
                                        type="button"
                                        className="pointer-events-auto block h-[12px] pl-1 text-left font-poppins text-[12px] leading-none font-medium text-[var(--text-muted)]"
                                        onClick={(clickEvent) => {
                                          clickEvent.preventDefault();
                                          clickEvent.stopPropagation();
                                          openDayEventsPanel(day);
                                        }}
                                      >
                                        +{hiddenDayEventsCount}
                                      </button>
                                    ) : null}
                                  </div>

                                  {isExpandedDay ? (
                                    <div
                                      className="pointer-events-auto absolute inset-x-1 top-9 bottom-1 z-20 overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--surface-1)] shadow-[0_14px_28px_rgba(20,23,31,0.16)]"
                                      onClick={(clickEvent) => {
                                        clickEvent.preventDefault();
                                        clickEvent.stopPropagation();
                                      }}
                                    >
                                      <div className="flex items-center justify-between border-b border-[var(--border)] px-2 py-1.5">
                                        <p className="font-poppins text-[16px] leading-none font-semibold text-[var(--text-strong)]">
                                          {format(day, "dd MMM")}
                                        </p>
                                        <button
                                          type="button"
                                          className="inline-flex size-6 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-default)]"
                                          onClick={(clickEvent) => {
                                            clickEvent.preventDefault();
                                            clickEvent.stopPropagation();
                                            setExpandedDayKey(null);
                                          }}
                                          aria-label="Close day events"
                                        >
                                          <X className="size-4" />
                                        </button>
                                      </div>
                                      <div
                                        className="drag-scrollbar-hidden h-[calc(100%-38px)] overflow-y-auto px-1.5 py-1.5"
                                        onClick={(clickEvent) => {
                                          clickEvent.preventDefault();
                                          clickEvent.stopPropagation();
                                        }}
                                        onWheel={handleDayEventsWheel}
                                      >
                                        <div className="space-y-1">
                                          {dayEvents.map((event) => {
                                            const sameDayRange = isSameDay(
                                              event.start,
                                              event.end,
                                            );
                                            const timeLabel = event.isAllDay
                                              ? "All day"
                                              : formatTimeRangeByPreference(
                                                  event.startAt,
                                                  event.endAt,
                                                  preferences.use24Hour,
                                                );

                                            return (
                                              <button
                                                key={`${dayKey}-${event.id}`}
                                                type="button"
                                                className="flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)]"
                                                style={{
                                                  backgroundColor: event.color,
                                                }}
                                                onClick={(clickEvent) => {
                                                  clickEvent.preventDefault();
                                                  clickEvent.stopPropagation();
                                                  handleOpenEventDetails(
                                                    event.originalId,
                                                    event.startAt,
                                                  );
                                                }}
                                              >
                                                <span className="min-w-0 flex-1">
                                                  <span className="block truncate font-poppins text-[14px] leading-none font-semibold text-white">
                                                    {event.title}
                                                  </span>
                                                  <span className="mt-1 block truncate font-poppins text-[12px] leading-none text-white/80">
                                                    {sameDayRange
                                                      ? timeLabel
                                                      : format(
                                                          event.endAt,
                                                          "dd MMM",
                                                        )}
                                                  </span>
                                                </span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  ) : null}
                                </button>
                              );
                            })}

                            <div
                              className="pointer-events-none absolute inset-x-0"
                              style={{
                                top: CALENDAR_SEGMENT_TOP_OFFSET,
                                paddingLeft: CALENDAR_CELL_HORIZONTAL_PADDING,
                                paddingRight: CALENDAR_CELL_HORIZONTAL_PADDING,
                              }}
                            >
                              <div
                                className="grid grid-cols-7 auto-rows-[18px]"
                              >
                                {weekInfo.segments
                                  .filter((segment) => segment.lane < visiblePeriodRows)
                                  .map((segment) => {
                                    return (
                                      <div
                                        key={segment.id}
                                        style={{
                                          gridColumn: `${segment.startCol} / ${segment.endCol + 1}`,
                                          gridRow: segment.lane + 1,
                                          backgroundColor: `color-mix(in srgb, ${segment.color} 35%, transparent)`,
                                          ...(segment.isStart
                                            ? { borderLeft: `3px solid ${segment.color}` }
                                            : {}),
                                        }}
                                        className="flex h-4 min-w-0 items-center overflow-hidden pr-2 pl-1.5"
                                      >
                                        {segment.isStart ? (
                                          <span className="truncate font-poppins text-[12px] leading-none font-semibold text-(--text-default)">
                                            {segment.title}
                                          </span>
                                        ) : null}
                                      </div>
                                    );
                                  })}
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
        <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col rounded-[28px] border border-[var(--border)] bg-[var(--surface-1)] p-4 sm:p-6 gap-3">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-3xl text-[var(--text-strong)]">
              Create Brick
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
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
              <p className="text-sm">Brick Icon</p>
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
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="size-4 sm:size-5" aria-hidden="true" dangerouslySetInnerHTML={{ __html: getBrickSvg(option.svgKey) }} />
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
          <DialogFooter className="shrink-0">
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
            <EventDateTimeRangeField
              startDate={eventStartDate}
              endDate={eventEndDate}
              startTime={eventStartTime}
              endTime={eventEndTime}
              use24Hour={preferences.use24Hour}
              isAllDay={eventIsAllDay}
              collapseSingleTimeValue={false}
              onDateClick={() => setEventDatePopupOpen(true)}
              onTimeClick={() => setEventTimePopupOpen(true)}
              timeDisabled={!hasEventDateRange}
              allDayToggle={
                <AllDayTabToggle
                  active={eventIsAllDay}
                  onToggle={() => {
                    const next = !eventIsAllDay;
                    setEventIsAllDay(next);
                    if (next) {
                      setEventTimePopupOpen(false);
                    }
                  }}
                />
              }
            />

            <div className="space-y-2 rounded-[22px] border border-[var(--border)] bg-[var(--surface-1)]/60 p-3">
              <EventBrickSelector
                bricks={bricks}
                selectedBrickId={newEventBrick}
                onSelectBrick={setNewEventBrick}
                allowNoBrick
                onCreateBrick={() => setCreateBrickOpen(true)}
                badgeClassName="!text-[22px]"
              />
              {!bricks.length ? (
                <p className="font-poppins text-[13px] text-[var(--text-muted)]">
                  No bricks yet. You can create this event without one, or add a brick now.
                </p>
              ) : null}
            </div>
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
        selectionMode="range"
        displayDate={eventStartDate || undefined}
        displayEndDate={eventEndDate || undefined}
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
