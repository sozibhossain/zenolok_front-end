"use client";

import * as React from "react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Clock3,
  MapPin,
  MessageCircle,
  Plus,
} from "lucide-react";
import { motion } from "motion/react";
import { addDays, endOfDay, format, isSameDay, startOfDay } from "date-fns";
import { toast } from "sonner";

import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AllDayTabToggle } from "@/components/shared/all-day-tab-toggle";
import { BrickIcon } from "@/components/shared/brick-icon";
import { BrickFilterBar } from "@/components/shared/brick-filter-bar";
import { DragScrollArea } from "@/components/shared/drag-scroll-area";
import { EmptyState } from "@/components/shared/empty-state";
import { EventDateRangePopup, EventTimeRangePopup } from "@/components/shared/event-date-time-popups";
import { EventRangeField, EventSingleField } from "@/components/shared/event-range-field";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { SectionLoading } from "@/components/shared/section-loading";
import { eventApi, brickApi, jamApi, paginateArray } from "@/lib/api";
import { brickIconOptions } from "@/lib/brick-icons";
import { colorPalette } from "@/lib/presets";
import { queryKeys } from "@/lib/query-keys";
import {
  formatTimeRangeByPreference,
} from "@/lib/time-format";

const eventFilters = [
  { label: "Upcoming", value: "upcoming" },
  { label: "Past", value: "past" },
  { label: "All", value: "all" },
] as const;

export default function EventsPage() {
  const { preferences } = useAppState();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<(typeof eventFilters)[number]["value"]>("upcoming");
  const [selectedBrickIds, setSelectedBrickIds] = useState<string[] | null>(null);
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);

  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [createBrickOpen, setCreateBrickOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [datePopupOpen, setDatePopupOpen] = useState(false);
  const [timePopupOpen, setTimePopupOpen] = useState(false);
  const [newEventBrick, setNewEventBrick] = useState<string>("");
  const [brickName, setBrickName] = useState("");
  const [brickColor, setBrickColor] = useState("#36A9E1");
  const [brickIcon, setBrickIcon] = useState("home");

  const bricksQuery = useQuery({
    queryKey: queryKeys.bricks,
    queryFn: brickApi.getAll,
  });

  const eventsQuery = useQuery({
    queryKey: queryKeys.events({
      filter,
    }),
    queryFn: () =>
      eventApi.getAll({
        filter: filter === "upcoming" ? "all" : filter,
      }),
  });

  const createEventMutation = useMutation({
    mutationFn: () => {
      if (!title.trim()) {
        throw new Error("Title is required");
      }

      if (!startDate || !endDate) {
        throw new Error("Start and end dates are required");
      }

      const usesSingleTime = !isAllDay && startDate === endDate;
      const resolvedEndTime = usesSingleTime ? startTime : endTime;

      if (!isAllDay && !startTime) {
        throw new Error("Start time is required");
      }

      if (!isAllDay && !usesSingleTime && !resolvedEndTime) {
        throw new Error("Start and end times are required");
      }

      const startDateTime = new Date(`${startDate}T${(startTime || "00:00")}:00`);
      const endDateTime = new Date(`${endDate}T${(resolvedEndTime || "00:00")}:00`);

      if (Number.isNaN(startDateTime.getTime()) || Number.isNaN(endDateTime.getTime())) {
        throw new Error("Invalid start or end date/time");
      }

      const normalizedStart = isAllDay ? startOfDay(startDateTime) : startDateTime;
      const normalizedEnd = isAllDay ? endOfDay(endDateTime) : endDateTime;

      if (normalizedEnd.getTime() < normalizedStart.getTime()) {
        throw new Error("End date/time must be after start date/time");
      }

      return eventApi.create({
        title: title.trim(),
        location: location.trim() || undefined,
        brick: newEventBrick || undefined,
        startTime: normalizedStart.toISOString(),
        endTime: normalizedEnd.toISOString(),
        isAllDay,
      });
    },
    onSuccess: () => {
      toast.success("Event created");
      setCreateEventOpen(false);
      setTitle("");
      setLocation("");
      setIsAllDay(false);
      setStartDate("");
      setEndDate("");
      setStartTime("");
      setEndTime("");
      setDatePopupOpen(false);
      setTimePopupOpen(false);
      setNewEventBrick("");
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create event"),
  });

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
      setCreateBrickOpen(false);
      setBrickName("");
      setBrickColor("#36A9E1");
      setBrickIcon("home");
      queryClient.invalidateQueries({ queryKey: queryKeys.bricks });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create brick"),
  });

  const bricks = useMemo(() => bricksQuery.data ?? [], [bricksQuery.data]);
  const allBrickIds = useMemo(() => bricks.map((brick) => brick._id), [bricks]);
  const effectiveSelectedBrickIds = useMemo(
    () => selectedBrickIds ?? allBrickIds,
    [allBrickIds, selectedBrickIds],
  );
  const allBricksSelected = useMemo(() => {
    if (!allBrickIds.length) {
      return false;
    }

    return allBrickIds.every((brickId) =>
      effectiveSelectedBrickIds.includes(brickId),
    );
  }, [allBrickIds, effectiveSelectedBrickIds]);

  const filteredEvents = useMemo(() => {
    const now = eventsQuery.dataUpdatedAt || 0;
    const todayStart = startOfDay(new Date(now)).getTime();
    const events = (eventsQuery.data || [])
      .filter((event) => {
        const startTime = new Date(event.startTime).getTime();
        const endTime = new Date(event.endTime).getTime();
        if (Number.isNaN(startTime)) {
          return false;
        }
        if (Number.isNaN(endTime)) {
          return false;
        }

        if (filter === "upcoming") {
          return endTime >= todayStart;
        }

        if (filter === "past") {
          return endTime < todayStart;
        }

        return true;
      })
      .filter((event) => {
        if (!effectiveSelectedBrickIds.length) {
          return false;
        }

        if (allBricksSelected) {
          return true;
        }

        return Boolean(
          event.brick?._id && effectiveSelectedBrickIds.includes(event.brick._id),
        );
      });

    if (!searchText.trim()) {
      return events;
    }

    const q = searchText.toLowerCase();

    return events.filter(
      (event) =>
        event.title.toLowerCase().includes(q) ||
        event.location?.toLowerCase().includes(q) ||
        event.brick?.name?.toLowerCase().includes(q)
    );
  }, [
    allBricksSelected,
    effectiveSelectedBrickIds,
    eventsQuery.data,
    eventsQuery.dataUpdatedAt,
    filter,
    searchText,
  ]);

  const paged = useMemo(() => paginateArray(filteredEvents, page, 10), [filteredEvents, page]);
  const jamCountQueries = useQueries({
    queries: paged.items.map((event) => ({
      queryKey: queryKeys.jamMessages(event._id),
      queryFn: () => jamApi.getByEvent(event._id),
      enabled: Boolean(event._id),
      staleTime: 60_000,
    })),
  });
  const jamCountByEventId = useMemo(() => {
    return paged.items.reduce<Record<string, number>>((accumulator, event, index) => {
      const messageCount = jamCountQueries[index]?.data?.length ?? 0;
      accumulator[event._id] = messageCount;
      return accumulator;
    }, {});
  }, [paged.items, jamCountQueries]);
  const hasDateRange = Boolean(startDate && endDate);
  const isSingleDayEvent = Boolean(startDate && endDate && startDate === endDate);

  React.useEffect(() => {
    setPage(1);
  }, [effectiveSelectedBrickIds, filter, searchText]);

  React.useEffect(() => {
    setSelectedBrickIds((previous) => {
      if (previous === null) {
        return null;
      }

      const filtered = previous.filter((brickId) => allBrickIds.includes(brickId));
      return filtered.length === previous.length ? previous : filtered;
    });
  }, [allBrickIds]);

  React.useEffect(() => {
    if (!createEventOpen) {
      return;
    }
    setDatePopupOpen(false);
    setTimePopupOpen(false);
    setStartDate("");
    setEndDate("");
    setStartTime("");
    setEndTime("");
  }, [createEventOpen]);

  React.useEffect(() => {
    if (!hasDateRange) {
      setTimePopupOpen(false);
    }
  }, [hasDateRange]);

  React.useEffect(() => {
    if (isAllDay || !isSingleDayEvent) {
      return;
    }

    setEndTime((previous) => {
      if (!startTime) {
        return previous ? "" : previous;
      }

      return previous === startTime ? previous : startTime;
    });
  }, [isAllDay, isSingleDayEvent, startTime]);

  return (
    <div className="events-page space-y-4">
      <section className="events-toolbar flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 flex-1">
          <BrickFilterBar
            bricks={bricks}
            selectedBrickIds={effectiveSelectedBrickIds}
            onToggleBrick={(brickId) =>
              setSelectedBrickIds((previous) => {
                const currentSelection = previous ?? allBrickIds;
                const nextSelection = currentSelection.includes(brickId)
                  ? currentSelection.filter((id) => id !== brickId)
                  : [...currentSelection, brickId];

                return allBrickIds.length &&
                  allBrickIds.every((id) => nextSelection.includes(id))
                  ? null
                  : nextSelection;
              })
            }
            onSelectAll={() =>
              setSelectedBrickIds((previous) => {
                const currentSelection = previous ?? allBrickIds;

                return allBrickIds.length &&
                  allBrickIds.every((brickId) => currentSelection.includes(brickId))
                  ? []
                  : null;
              })
            }
            onCreateBrick={() => setCreateBrickOpen(true)}
          />
        </div>

        <div className="flex flex-col items-end gap-2">
          <Input
            className="h-10 w-full rounded-xl sm:w-[260px]"
            placeholder="Search events..."
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <div className="events-filter-tabs flex items-center rounded-xl border border-[#CCD2DE]">
            {eventFilters.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={`font-poppins whitespace-nowrap px-4 py-2 text-[20px] leading-[120%] font-medium ${
                  filter === item.value
                    ? "bg-[var(--surface-3)] text-[var(--text-strong)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-default)]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="events-content-shell rounded-[28px] border border-[#E0E4EC] bg-[#F4F6FA] p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="font-poppins text-[32px] leading-[120%] font-semibold text-[#3D414A]">Events</p>
          <button
            type="button"
            onClick={() => setCreateEventOpen(true)}
            className="events-create-btn flex size-9 items-center justify-center rounded-full border border-[#B2B8C6] bg-white text-[#7B8395] hover:bg-[#ECF0F7]"
            aria-label="Create event"
          >
            <Plus className="size-4" />
          </button>
        </div>
        {eventsQuery.isLoading ? (
          <SectionLoading rows={6} />
        ) : paged.items.length ? (
          <>
            <div className="space-y-3">
              {paged.items.map((event) => {
                const messageCount = jamCountByEventId[event._id] ?? 0;
                const startDate = new Date(event.startTime);
                const endDate = new Date(event.endTime);
                const hasValidRange =
                  !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime());
                const dateLabel = hasValidRange
                  ? isSameDay(startDate, endDate)
                    ? format(startDate, "dd MMM yyyy")
                    : `${format(startDate, "dd MMM yyyy")} - ${format(endDate, "dd MMM yyyy")}`
                  : "Invalid date";
                const timeLabel = event.isAllDay
                  ? "All day"
                  : hasValidRange
                    ? formatTimeRangeByPreference(
                        startDate,
                        endDate,
                        preferences.use24Hour,
                      )
                    : "Invalid time";

                return (
                  <motion.div
                    key={event._id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.24 }}
                  >
                    <Link href={`/events/${event._id}`}>
                      <Card className="events-list-card rounded-2xl border border-[#D9DEE9] bg-[#E6EAF1] px-4 py-3 shadow-none transition hover:scale-[1.002] hover:border-[#C8D0DF]">
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex items-start gap-3">
                            <span className="mt-1 h-8 w-1.5 rounded-full" style={{ backgroundColor: event.brick?.color || "#F7C700" }} />
                            <div>
                              <p className="font-poppins text-[28px] leading-[120%] font-semibold text-[#3D414A]">{event.title}</p>
                              <div className="font-poppins mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[#4D5463]">
                                <span className="flex items-center gap-1.5 text-[20px] leading-[120%] font-medium">
                                  <CalendarDays className="size-4" /> {dateLabel}
                                </span>
                                <span className="flex items-center gap-1.5 text-[20px] leading-[120%] font-medium">
                                  <MapPin className="size-4" /> {event.location || "No location"}
                                </span>
                                <span className="flex items-center gap-1.5 text-[20px] leading-[120%] font-medium">
                                  <Clock3 className="size-4" /> {timeLabel}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="font-poppins flex items-center gap-3 text-[#7A8293]">
                            <MessageCircle className="size-5" />
                            <span className="rounded-full bg-white px-2 py-0.5 text-[14px] leading-[120%] font-normal">{messageCount}</span>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
            <PaginationControls page={paged.page} totalPages={paged.totalPages} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState
            title="No events found"
            description="Create a new event or switch your filter to view past items."
          />
        )}
      </section>

      <Dialog open={createBrickOpen} onOpenChange={setCreateBrickOpen}>
        <DialogContent className="max-w-5xl rounded-[28px] border border-[var(--border)] bg-[var(--surface-1)] p-4 sm:p-6 space-y-2">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-strong)]">Create Brick</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Brick name" value={brickName} onChange={(event) => setBrickName(event.target.value)} />
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-2)] p-3 sm:p-4">
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
              <span className="h-5 w-5 rounded-full" style={{ backgroundColor: brickColor }} />
              <BrickIcon name={brickIcon} className="size-4" />
              <span className="fs-pop-14-regular-right text-left text-[var(--text-default)]">{brickName.trim() || "Preview"}</span>
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
        <DialogContent className="max-w-2xl rounded-[26px] space-y-3">
          <DialogHeader>
            <DialogTitle>Create Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
            <Input placeholder="Location" value={location} onChange={(event) => setLocation(event.target.value)} />
            <div className="space-y-3">
              <EventRangeField
                kind="date"
                startValue={startDate}
                endValue={endDate}
                onClick={() => setDatePopupOpen(true)}
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                {isAllDay ? (
                  <EventSingleField kind="time" label="All day" />
                ) : (
                  <EventRangeField
                    kind="time"
                    startValue={startTime}
                    endValue={endTime}
                    use24Hour={preferences.use24Hour}
                    collapseSingleValue={isSingleDayEvent}
                    onClick={() => setTimePopupOpen(true)}
                    disabled={!hasDateRange}
                    className="max-w-full"
                  />
                )}
                <AllDayTabToggle
                  active={isAllDay}
                  onToggle={() => {
                    const next = !isAllDay;
                    setIsAllDay(next);
                    if (next) {
                      setTimePopupOpen(false);
                    }
                  }}
                  className="self-end sm:self-auto"
                />
              </div>
            </div>
            <DragScrollArea className="pb-1">
              {bricks.map((brick) => (
                <button key={brick._id} type="button" className="shrink-0" onClick={() => setNewEventBrick(brick._id)}>
                  <Badge
                    variant="neutral"
                    style={
                      newEventBrick === brick._id
                        ? {
                            color: brick.color,
                            borderColor: brick.color,
                            backgroundColor: "var(--ui-badge-neutral-bg)",
                          }
                        : {
                            backgroundColor: brick.color,
                            color: "white",
                            borderColor: brick.color,
                          }
                    }
                    className="rounded-full px-4 py-1 !text-[14px]"
                  >
                    <BrickIcon name={brick.icon} className="size-4" /> {brick.name}
                  </Badge>
                </button>
              ))}
            </DragScrollArea>
          </div>
          <DialogFooter>
            <Button onClick={() => createEventMutation.mutate()} disabled={createEventMutation.isPending}>
              {createEventMutation.isPending ? "Creating..." : "Create Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EventDateRangePopup
        open={datePopupOpen}
        onOpenChange={setDatePopupOpen}
        startDate={startDate}
        endDate={endDate}
        onApply={({ startDate: nextStartDate, endDate: nextEndDate }) => {
          setStartDate(nextStartDate);
          setEndDate(nextEndDate);
        }}
      />
        <EventTimeRangePopup
          open={timePopupOpen}
          onOpenChange={setTimePopupOpen}
          startTime={startTime}
          endTime={endTime}
          selectionMode={isSingleDayEvent ? "single" : "range"}
          onApply={({ startTime: nextStartTime, endTime: nextEndTime, rollsEndToNextDay }) => {
            setStartTime(nextStartTime);
            setEndTime(nextEndTime);
            if (rollsEndToNextDay && startDate && endDate && startDate === endDate) {
              setEndDate(format(addDays(new Date(`${endDate}T00:00:00`), 1), "yyyy-MM-dd"));
              toast.message("End time moved the end date to the next day.");
            }
          }}
        />
    </div>
  );
}
