"use client";

import * as React from "react";
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarClock, MapPin, Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAppState } from "@/components/providers/app-state-provider";
import { BrickIcon } from "@/components/shared/brick-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionLoading } from "@/components/shared/section-loading";
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
import { brickApi, eventApi, type EventData } from "@/lib/api";
import { brickIconOptions } from "@/lib/brick-icons";
import { defaultBricks } from "@/lib/presets";
import { queryKeys } from "@/lib/query-keys";

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  color: string;
  location: string;
  brickName?: string;
  icon?: string;
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

function buildWeekSegments(week: Date[], events: CalendarEvent[]): { segments: WeekSegment[]; laneCount: number } {
  const weekStart = startOfDay(week[0]);
  const weekEnd = startOfDay(week[6]);

  const relevant = events
    .filter((event) => intersectsWeek(event, weekStart, weekEnd))
    .sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());

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

function toLocalDateTimeInputValue(date: Date) {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
}

export default function HomePage() {
  const queryClient = useQueryClient();
  const [selectedBrick, setSelectedBrick] = React.useState("all");
  const { monthCursor, selectedDate, setSelectedDate, preferences } = useAppState();
  const [createBrickOpen, setCreateBrickOpen] = React.useState(false);
  const [brickName, setBrickName] = React.useState("");
  const [brickColor, setBrickColor] = React.useState("#36A9E1");
  const [brickIcon, setBrickIcon] = React.useState("home");
  const [createEventOpen, setCreateEventOpen] = React.useState(false);
  const [eventTitle, setEventTitle] = React.useState("");
  const [eventLocation, setEventLocation] = React.useState("");
  const [eventIsAllDay, setEventIsAllDay] = React.useState(false);
  const [eventStart, setEventStart] = React.useState("");
  const [eventEnd, setEventEnd] = React.useState("");
  const [newEventBrick, setNewEventBrick] = React.useState("");

  const weekStartsOn = weekStartsOnMap[preferences.weekStartDay] ?? 1;
  const monthStart = React.useMemo(() => startOfMonth(monthCursor), [monthCursor]);
  const monthEnd = React.useMemo(() => endOfMonth(monthCursor), [monthCursor]);
  const calendarStart = React.useMemo(() => startOfWeek(monthStart, { weekStartsOn }), [monthStart, weekStartsOn]);
  const calendarEnd = React.useMemo(() => endOfWeek(monthEnd, { weekStartsOn }), [monthEnd, weekStartsOn]);
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

  const bricks = React.useMemo(() => {
    if (bricksQuery.data?.length) {
      return bricksQuery.data;
    }

    return defaultBricks.map((brick, index) => ({
      ...brick,
      _id: `default-${index}`,
      participants: [],
      createdBy: "",
    }));
  }, [bricksQuery.data]);

  const normalizedEvents = React.useMemo<CalendarEvent[]>(() => {
    return (eventsQuery.data || []).map((event: EventData) => {
      const start = startOfDay(new Date(event.startTime));
      const rawEnd = startOfDay(new Date(event.endTime));
      const end = rawEnd < start ? start : rawEnd;

      const titleLower = event.title.toLowerCase();
      const color = titleLower.includes("exhibition week")
        ? exhibitionColor
        : event.brick?.color || "#84C6EC";

      return {
        id: event._id,
        title: event.title,
        start,
        end,
        color,
        location: event.location || "No location",
        brickName: event.brick?.name,
        icon: event.brick?.icon,
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
      (event) =>
        event.brickName?.toLowerCase() === selected.name.toLowerCase()
    );
  }, [selectedBrick, normalizedEvents, bricks]);

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weeks = splitIntoWeeks(days);

  const weekdayLabels = React.useMemo(
    () => Array.from({ length: 7 }, (_, index) => format(addDays(startOfWeek(new Date(), { weekStartsOn }), index), "EEE")),
    [weekStartsOn]
  );

  const selectedDateEvents = React.useMemo(
    () => filteredEvents.filter((event) => event.start <= selectedDate && event.end >= selectedDate),
    [filteredEvents, selectedDate]
  );

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
    onError: (error: Error) => toast.error(error.message || "Failed to create brick"),
  });

  const createEventMutation = useMutation({
    mutationFn: () => {
      if (!eventTitle.trim()) {
        throw new Error("Title is required");
      }

      if (!eventStart || !eventEnd) {
        throw new Error("Start and end date/time are required");
      }

      return eventApi.create({
        title: eventTitle.trim(),
        brick: newEventBrick || undefined,
        location: eventLocation.trim() || undefined,
        startTime: new Date(eventStart).toISOString(),
        endTime: new Date(eventEnd).toISOString(),
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
      setEventStart("");
      setEventEnd("");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create event"),
  });

  React.useEffect(() => {
    if (!createEventOpen) {
      return;
    }

    const start = startOfDay(selectedDate);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start);
    end.setHours(10, 0, 0, 0);

    setEventStart(toLocalDateTimeInputValue(start));
    setEventEnd(toLocalDateTimeInputValue(end));
    setNewEventBrick(selectedBrick === "all" ? "" : selectedBrick);
  }, [createEventOpen, selectedBrick, selectedDate]);

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setSelectedBrick("all")}>
          <Badge variant={selectedBrick === "all" ? "neutral" : "neutral"} className="rounded-full px-4 py-2">
            <CalendarClock className="size-4" />
            All
          </Badge>
        </button>
        {bricks.map((brick) => {
          const active = selectedBrick === brick._id;
          return (
            <button key={brick._id} type="button" onClick={() => setSelectedBrick(brick._id)}>
              <Badge
                variant={active ? "blue" : "neutral"}
                className="rounded-full px-4 py-2"
                style={
                  active
                    ? { backgroundColor: brick.color, color: "white" }
                    : { color: brick.color, borderColor: brick.color, backgroundColor: "white" }
                }
              >
                <BrickIcon name={brick.icon} className="size-4" />
                {brick.name}
              </Badge>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setCreateBrickOpen(true)}
          className="flex size-8 items-center justify-center rounded-full border border-[#B9BFCA] bg-white text-[#7D8597]"
        >
          <Plus className="size-4" />
        </button>
      </section>

      <section className="rounded-[30px] border border-[#DFE4ED] bg-[#F4F6FA] p-3 sm:p-4">
        {eventsQuery.isLoading ? (
          <SectionLoading rows={8} />
        ) : (
          <div className="grid gap-4 xl:grid-cols-[272px_minmax(0,1fr)]">
            <aside className="rounded-[24px] border border-[#D8DEEA] bg-[#ECEFF4] p-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-poppins text-[20px] leading-[120%] font-medium text-[#2C323E]">Scheduled</h2>
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
                  {selectedDateEvents.slice(0, 5).map((event) => (
                    <div key={event.id} className="rounded-xl border border-[#D3DAE8] bg-white px-2 py-2">
                      <div className="flex items-center gap-2">
                        <span className="h-6 w-1.5 rounded-full" style={{ backgroundColor: event.color }} />
                        <p className="font-poppins truncate text-[20px] leading-[120%] font-medium text-[#2E3542]">{event.title}</p>
                      </div>
                      <p className="font-poppins mt-1 flex items-center gap-1 text-[14px] leading-[120%] text-[#7A8396]">
                        <MapPin className="size-3.5" />
                        {event.location}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No events" description="No events on selected day." />
              )}
            </aside>

            <div className="overflow-x-auto">
              <div className="min-w-[840px]">
                <div className="mb-2 grid grid-cols-7">
                  {weekdayLabels.map((label) => (
                    <div key={label} className="px-2 py-1 text-center">
                      <p
                        className={`font-poppins text-[16px] leading-[120%] font-medium ${
                          label.startsWith("Sun") ? "text-[#FF3B30]" : "text-[#3A4150]"
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
                    const visibleSegments = weekInfo.segments.filter((segment) => segment.lane < 3);

                    return (
                      <div
                        key={`${format(week[0], "yyyy-MM-dd")}-${weekIndex}`}
                        className="relative grid grid-cols-7 border-b border-[#DDE2EC] last:border-b-0"
                      >
                        {week.map((day) => {
                          const selected = isSameDay(day, selectedDate);
                          return (
                            <button
                              key={format(day, "yyyy-MM-dd")}
                              type="button"
                              onClick={() => setSelectedDate(day)}
                              className={`h-[136px] border-r border-[#DDE2EC] px-2 py-2 text-left last:border-r-0 ${
                                selected ? "bg-[#ECEDEF]" : ""
                              }`}
                            >
                              <span
                                className={`font-poppins inline-flex min-w-[32px] items-center justify-center rounded-xl px-2 text-[20px] leading-[120%] font-medium ${
                                  selected
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

                        <div className="pointer-events-none absolute inset-x-0 top-10 px-[2px]">
                          <div className="grid grid-cols-7 auto-rows-[24px]">
                            {visibleSegments.map((segment) => (
                              <div
                                key={segment.id}
                                style={{
                                  gridColumn: `${segment.startCol} / ${segment.endCol + 1}`,
                                  gridRow: segment.lane + 1,
                                  backgroundColor: hexToRgba(segment.color, 0.45),
                                  color: getSegmentTextColor(segment.color),
                                }}
                                className="mx-[1px] flex h-[18px] items-center overflow-hidden rounded-[1px] mt-14"
                              >
                                {segment.isStart ? (
                                  <>
                                    <span className="h-full w-1.5 shrink-0 " style={{ backgroundColor: segment.color }} />
                                    <span className="truncate pl-1 font-poppins text-[14px] leading-[120%] font-medium">
                                      {segment.title}
                                    </span>
                                  </>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>

                        {weekInfo.laneCount > 3 ? (
                          <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-[#EDEFF4] px-1.5 py-0.5 text-[10px] text-[#6C7486]">
                            +{weekInfo.laneCount - 3}
                          </div>
                        ) : null}
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
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle  className="mb-10 text-3xl">Create Brick</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Brick name" value={brickName} onChange={(event) => setBrickName(event.target.value)} />
            <div className="grid grid-cols-[1fr_auto] items-center gap-3">
              <Input value={brickColor} onChange={(event) => setBrickColor(event.target.value)} />
              <Input
                type="color"
                value={brickColor}
                onChange={(event) => setBrickColor(event.target.value)}
                className="h-10 w-14 cursor-pointer p-1"
              />
            </div>
            <select
              value={brickIcon}
              onChange={(event) => setBrickIcon(event.target.value)}
              className="h-10 w-full rounded-md border border-[#D6DCE8] bg-white px-3 text-sm text-[#2F3542]"
            >
              {brickIconOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2 rounded-xl border border-[#D6DCE8] bg-[#F5F7FB] px-3 py-2">
              <span className="h-5 w-5 rounded-full" style={{ backgroundColor: brickColor }} />
              <BrickIcon name={brickIcon} className="size-4" />
              <span className="font-poppins text-[14px] font-medium text-[#2E3542]">{brickName.trim() || "Preview"}</span>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createBrickMutation.mutate()} disabled={createBrickMutation.isPending}>
              {createBrickMutation.isPending ? "Creating..." : "Create Brick"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createEventOpen} onOpenChange={setCreateEventOpen}>
        <DialogContent className="max-w-2xl rounded-[26px]">
          <DialogHeader>
            <DialogTitle className="mb-10 text-4xl">Create event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Title" value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} />
            <Input placeholder="Location" value={eventLocation} onChange={(event) => setEventLocation(event.target.value)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input type="datetime-local" value={eventStart} onChange={(event) => setEventStart(event.target.value)} />
              <Input type="datetime-local" value={eventEnd} onChange={(event) => setEventEnd(event.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[#E4E8F0] p-3">
              <p className="font-medium text-[#3A404D]">All day</p>
              <Switch checked={eventIsAllDay} onCheckedChange={setEventIsAllDay} />
            </div>
            <div className="flex flex-wrap gap-2">
              {bricks.map((brick) => (
                <button key={brick._id} type="button" onClick={() => setNewEventBrick(brick._id)}>
                  <Badge
                    variant={newEventBrick === brick._id ? "blue" : "neutral"}
                    style={
                      newEventBrick === brick._id
                        ? { backgroundColor: brick.color }
                        : { color: brick.color, borderColor: brick.color }
                    }
                  >
                    <BrickIcon name={brick.icon} className="size-4" /> {brick.name}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createEventMutation.mutate()} disabled={createEventMutation.isPending}>
              {createEventMutation.isPending ? "Creating..." : "Create event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
