"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpDown,
  Bell,
  CalendarDays,
  Clock3,
  MapPin,
  MessageCircle,
  Plus,
  Repeat2,
  SlidersHorizontal,
} from "lucide-react";
import { motion } from "motion/react";
import { addDays, endOfDay, format, startOfDay } from "date-fns";
import { toast } from "sonner";

import { useAppState } from "@/components/providers/app-state-provider";
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
import {
  EventBrickSelector,
} from "@/components/shared/event-brick-selector";
import { BrickFilterBar } from "@/components/shared/brick-filter-bar";
import { EmptyState } from "@/components/shared/empty-state";
import {
  EventDateRangePopup,
  EventTimeRangePopup,
} from "@/components/shared/event-date-time-popups";
import {
  EventRangeField,
  EventSingleField,
} from "@/components/shared/event-range-field";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { SectionLoading } from "@/components/shared/section-loading";
import {
  eventApi,
  brickApi,
  notificationApi,
  paginateArray,
} from "@/lib/api";
import { brickIconOptions, getBrickSvg } from "@/lib/brick-icons";
import { NO_BRICK_EVENT_COLOR } from "@/lib/event-colors";
import { colorPalette } from "@/lib/presets";
import {
  isMessageNotification,
  notificationMatchesEvent,
} from "@/lib/notifications";
import { queryKeys } from "@/lib/query-keys";
import {
  toggleAllBrickSelection,
  toggleBrickSelection,
} from "@/lib/brick-filter-selection";
import { formatTimeByPreference } from "@/lib/time-format";

const eventFilters = [
  { label: "Upcoming", value: "upcoming" },
  { label: "Past", value: "past" },
  { label: "All", value: "all" },
] as const;

type EventStatusIconProps = {
  icon: React.ComponentType<{ className?: string }>;
  badgeCount?: number;
  active?: boolean;
  asButton?: boolean;
  label: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

function EventStatusIcon({
  icon: Icon,
  badgeCount = 0,
  active = false,
  asButton = false,
  label,
  onClick,
}: EventStatusIconProps) {
  const className =
    "relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-[#C5CCD8] transition hover:bg-white/75 " +
    (active ? "text-[#A5AFBF]" : "text-[#CBD2DD]");

  if (asButton) {
    return (
      <button
        type="button"
        className={className}
        aria-label={label}
        onClick={onClick}
      >
        <Icon className="size-[22px]" />
        {badgeCount > 0 ? (
          <span className="absolute -right-1 -top-2 inline-flex size-[18px] items-center justify-center rounded-full bg-[#FF4D42] text-[9px] font-semibold leading-none text-white shadow-[0_2px_6px_rgba(255,77,66,0.28)]">
            {badgeCount}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <span className={className} aria-hidden="true">
      <Icon className="size-[22px]" />
      {badgeCount > 0 ? (
        <span className="absolute -right-1 -top-2 inline-flex size-[18px] items-center justify-center rounded-full bg-[#FF4D42] text-[9px] font-semibold leading-none text-white shadow-[0_2px_6px_rgba(255,77,66,0.28)]">
          {badgeCount}
        </span>
      ) : null}
    </span>
  );
}

export default function EventsPage() {
  const router = useRouter();
  const { preferences } = useAppState();
  const queryClient = useQueryClient();
  const [filter, setFilter] =
    useState<(typeof eventFilters)[number]["value"]>("upcoming");
  const [selectedBrickIds, setSelectedBrickIds] = useState<string[] | null>(
    null,
  );
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
  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: notificationApi.getAll,
    staleTime: 30_000,
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

      const startDateTime = new Date(`${startDate}T${startTime || "00:00"}:00`);
      const endDateTime = new Date(
        `${endDate}T${resolvedEndTime || "00:00"}:00`,
      );

      if (
        Number.isNaN(startDateTime.getTime()) ||
        Number.isNaN(endDateTime.getTime())
      ) {
        throw new Error("Invalid start or end date/time");
      }

      const normalizedStart = isAllDay
        ? startOfDay(startDateTime)
        : startDateTime;
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
    onError: (error: Error) =>
      toast.error(error.message || "Failed to create event"),
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
    onSuccess: (createdBrick) => {
      toast.success("Brick created");
      setCreateBrickOpen(false);
      setBrickName("");
      setBrickColor("#36A9E1");
      setBrickIcon("home");
      queryClient.invalidateQueries({ queryKey: queryKeys.bricks });
      if (createEventOpen) {
        setNewEventBrick(createdBrick._id);
      }
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to create brick"),
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
        if (!allBrickIds.length) {
          return true;
        }

        if (!effectiveSelectedBrickIds.length) {
          return false;
        }

        if (allBricksSelected) {
          return true;
        }

        return Boolean(
          event.brick?._id &&
          effectiveSelectedBrickIds.includes(event.brick._id),
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
        event.brick?.name?.toLowerCase().includes(q),
    );
  }, [
    allBrickIds,
    allBricksSelected,
    effectiveSelectedBrickIds,
    eventsQuery.data,
    eventsQuery.dataUpdatedAt,
    filter,
    searchText,
  ]);

  const paged = useMemo(
    () => paginateArray(filteredEvents, page, 10),
    [filteredEvents, page],
  );
  const unreadMessageCountByEventId = useMemo(() => {
    const unreadMessageNotifications = (
      notificationsQuery.data?.items ?? []
    ).filter(
      (notification) =>
        !notification.read && isMessageNotification(notification),
    );

    return paged.items.reduce<Record<string, number>>((accumulator, event) => {
      accumulator[event._id] = unreadMessageNotifications.filter(
        (notification) => notificationMatchesEvent(notification, event),
      ).length;
      return accumulator;
    }, {});
  }, [notificationsQuery.data?.items, paged.items]);
  const unreadAlertCountByEventId = useMemo(() => {
    const unreadAlertNotifications = (
      notificationsQuery.data?.items ?? []
    ).filter(
      (notification) =>
        !notification.read && !isMessageNotification(notification),
    );

    return paged.items.reduce<Record<string, number>>((accumulator, event) => {
      accumulator[event._id] = unreadAlertNotifications.filter((notification) =>
        notificationMatchesEvent(notification, event),
      ).length;
      return accumulator;
    }, {});
  }, [notificationsQuery.data?.items, paged.items]);
  const hasDateRange = Boolean(startDate && endDate);
  const isSingleDayEvent = Boolean(
    startDate && endDate && startDate === endDate,
  );

  const openEventDetails = React.useCallback(
    (eventId: string) => {
      router.push(`/events/${eventId}`);
    },
    [router],
  );
  const openEventMessages = React.useCallback(
    (eventId: string) => {
      router.push(`/events/${eventId}?focus=messages`);
    },
    [router],
  );

  const openCreateEventDialog = React.useCallback(() => {
    setTitle("");
    setLocation("");
    setIsAllDay(false);
    setDatePopupOpen(false);
    setTimePopupOpen(false);
    setStartDate("");
    setEndDate("");
    setStartTime("");
    setEndTime("");
    setNewEventBrick("");
    setCreateEventOpen(true);
  }, []);

  React.useEffect(() => {
    setPage(1);
  }, [effectiveSelectedBrickIds, filter, searchText]);

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
        <div className="min-w-0 flex-1 ">
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
        </div>

        <div className="flex w-full flex-col items-stretch gap-2 sm:items-end xl:w-auto">
          <Input
            className="h-10 w-full rounded-xl sm:w-[260px]"
            placeholder="Search events..."
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <div className="events-filter-tabs flex w-full items-center rounded-xl border border-[#CCD2DE] sm:w-auto">
            {eventFilters.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={`font-poppins flex-1 whitespace-nowrap px-4 py-2 text-center text-[18px] leading-[120%] font-medium sm:flex-none sm:text-[20px] ${
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
          <p className="font-poppins text-[24px] leading-[120%] font-semibold text-[#3D414A]">
            Events
          </p>
          <button
            type="button"
            onClick={openCreateEventDialog}
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
                const messageCount =
                  unreadMessageCountByEventId[event._id] ?? 0;
                const alertCount = unreadAlertCountByEventId[event._id] ?? 0;
                const startDate = new Date(event.startTime);
                const endDate = new Date(event.endTime);
                const hasValidRange =
                  !Number.isNaN(startDate.getTime()) &&
                  !Number.isNaN(endDate.getTime());
                const startDayLabel = hasValidRange
                  ? format(startDate, "EEE").toUpperCase()
                  : "Date";
                const endDayLabel = hasValidRange
                  ? format(endDate, "EEE").toUpperCase()
                  : undefined;
                const startDateLabel = hasValidRange
                  ? format(startDate, "dd MMM yyyy").toUpperCase()
                  : "Invalid date";
                const endDateLabel = hasValidRange
                  ? format(endDate, "dd MMM yyyy").toUpperCase()
                  : undefined;
                const startTimeLabel = event.isAllDay
                  ? "All day"
                  : hasValidRange
                    ? formatTimeByPreference(startDate, preferences.use24Hour)
                    : "Invalid time";
                const endTimeLabel = event.isAllDay
                  ? undefined
                  : hasValidRange
                    ? formatTimeByPreference(endDate, preferences.use24Hour)
                    : undefined;
                const showDateRange =
                  Boolean(endDateLabel) &&
                  (endDateLabel !== startDateLabel ||
                    endDayLabel !== startDayLabel);

                return (
                  <motion.div
                    key={event._id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.24 }}
                  >
                    <Card
                      role="link"
                      tabIndex={0}
                      className="events-list-card cursor-pointer rounded-[26px] border border-[#D9DEE9] bg-[#EEF2F7] px-5 py-4 shadow-none transition hover:scale-[1.002] hover:border-[#C8D0DF] sm:px-6"
                      onClick={() => openEventDetails(event._id)}
                      onKeyDown={(keyboardEvent) => {
                        if (
                          keyboardEvent.key !== "Enter" &&
                          keyboardEvent.key !== " "
                        ) {
                          return;
                        }

                        keyboardEvent.preventDefault();
                        openEventDetails(event._id);
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex shrink-0 pt-1">
                          <span
                            className="h-7 w-1 rounded-full"
                            style={{
                              backgroundColor:
                                event.brick?.color || NO_BRICK_EVENT_COLOR,
                            }}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-poppins truncate text-[18px] leading-[120%] font-semibold text-[#454B57] sm:text-[20px]">
                              {event.title}
                            </p>
                            <div className="flex shrink-0 items-center gap-0.5">
                              <EventStatusIcon
                                icon={MessageCircle}
                                label={`Open messages for ${event.title}`}
                                badgeCount={messageCount}
                                active={messageCount > 0}
                                asButton
                                onClick={(clickEvent) => {
                                  clickEvent.preventDefault();
                                  clickEvent.stopPropagation();
                                  openEventMessages(event._id);
                                }}
                              />
                              <EventStatusIcon
                                icon={Repeat2}
                                label={`${event.title} recurrence`}
                                active={event.recurrence !== "once"}
                              />
                              <EventStatusIcon
                                icon={Bell}
                                label={`${event.title} alerts`}
                                badgeCount={alertCount}
                                active={Boolean(
                                  (event.alarmPreset &&
                                    event.alarmPreset !== "none") ||
                                    event.reminder ||
                                    alertCount > 0,
                                )}
                              />
                              <EventStatusIcon
                                icon={SlidersHorizontal}
                                label={`${event.title} details`}
                                active
                              />
                            </div>
                          </div>
                          <div className="mt-2.5 min-w-0">
                            {showDateRange ? (
                              /* Multi-day: grid with arrows between date and time */
                              <>
                                <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-1.5">
                                  <div
                                    className="inline-grid items-center gap-x-2.5 gap-y-0.5"
                                    style={{ gridTemplateColumns: "16px auto auto auto" }}
                                  >
                                    {/* Date row */}
                                    <CalendarDays className="size-4 text-[#9CA5B5]" />
                                    <span className="font-poppins text-[14px] font-semibold leading-none text-[#4D5463] sm:text-[15px]">{startDateLabel}</span>
                                    <span className="justify-self-center text-[14px] leading-none text-[#A4ACBB]">-</span>
                                    <span className="font-poppins text-[14px] font-semibold leading-none text-[#4D5463] sm:text-[15px]">{endDateLabel}</span>
                                    {/* Arrow row */}
                                    <span />
                                    <ArrowUpDown className="mx-auto size-3 text-[#B0B7C5]" />
                                    <span />
                                    <ArrowUpDown className="mx-auto size-3 text-[#B0B7C5]" />
                                    {/* Time row */}
                                    <Clock3 className="size-4 text-[#9CA5B5]" />
                                    <span className="font-poppins text-[14px] font-semibold leading-none text-[#4D5463] sm:text-[15px]">{startTimeLabel}</span>
                                    <span />
                                    <span className="font-poppins text-[14px] font-semibold leading-none text-[#4D5463] sm:text-[15px]">{endTimeLabel || ""}</span>
                                  </div>
                                  <div className="flex min-w-0 items-center gap-2 text-[#666E7D]">
                                    <MapPin className="size-4 shrink-0 text-[#A0A8B8]" />
                                    <p className="font-poppins min-w-0 truncate text-[14px] leading-none font-medium text-[#666E7D] sm:text-[15px]">
                                      {event.location || "No location"}
                                    </p>
                                  </div>
                                </div>
                              </>
                            ) : (
                              /* Single-day / All-day: simple rows, no arrows */
                              <div className="flex min-w-0 flex-wrap items-start gap-x-6 gap-y-1.5">
                                <div className="min-w-0 space-y-1">
                                  <div className="flex items-center gap-2.5">
                                    <CalendarDays className="size-4 shrink-0 text-[#9CA5B5]" />
                                    <span className="font-poppins text-[14px] font-semibold leading-none text-[#4D5463] sm:text-[15px]">{startDateLabel}</span>
                                  </div>
                                  <div className="flex items-center gap-2.5">
                                    <Clock3 className="size-4 shrink-0 text-[#9CA5B5]" />
                                    <span className="font-poppins text-[14px] font-semibold leading-none text-[#4D5463] sm:text-[15px]">{startTimeLabel}</span>
                                    {endTimeLabel ? (
                                      <>
                                        <span className="text-[14px] leading-none text-[#A4ACBB]">-</span>
                                        <span className="font-poppins text-[14px] font-semibold leading-none text-[#4D5463] sm:text-[15px]">{endTimeLabel}</span>
                                      </>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="flex min-w-0 items-center gap-2 text-[#666E7D]">
                                  <MapPin className="size-4 shrink-0 text-[#A0A8B8]" />
                                  <p className="font-poppins min-w-0 truncate text-[14px] leading-none font-medium text-[#666E7D] sm:text-[15px]">
                                    {event.location || "No location"}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
            <PaginationControls
              page={paged.page}
              totalPages={paged.totalPages}
              onPageChange={setPage}
            />
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
            <DialogTitle className="text-[var(--text-strong)]">
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
              <span className="fs-pop-14-regular-right text-left text-[var(--text-default)]">
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
        <DialogContent className="max-w-2xl rounded-[26px] space-y-3">
          <DialogHeader>
            <DialogTitle>Create Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <Input
              placeholder="Location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
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
        onApply={({
          startTime: nextStartTime,
          endTime: nextEndTime,
          rollsEndToNextDay,
        }) => {
          setStartTime(nextStartTime);
          setEndTime(nextEndTime);
          if (
            rollsEndToNextDay &&
            startDate &&
            endDate &&
            startDate === endDate
          ) {
            setEndDate(
              format(addDays(new Date(`${endDate}T00:00:00`), 1), "yyyy-MM-dd"),
            );
            toast.message("End time moved the end date to the next day.");
          }
        }}
      />
    </div>
  );
}
