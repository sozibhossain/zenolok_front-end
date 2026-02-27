"use client";

import * as React from "react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlarmClock,
  CalendarDays,
  Clock3,
  ListFilter,
  MapPin,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { endOfMonth, format, startOfMonth } from "date-fns";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { BrickIcon } from "@/components/shared/brick-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { SectionLoading } from "@/components/shared/section-loading";
import { eventApi, brickApi, paginateArray } from "@/lib/api";
import { defaultBricks } from "@/lib/presets";
import { queryKeys } from "@/lib/query-keys";

const eventFilters = [
  { label: "Upcoming", value: "upcoming" },
  { label: "Past", value: "past" },
  { label: "All", value: "all" },
] as const;

export default function EventsPage() {
  const queryClient = useQueryClient();
  const { monthCursor } = useAppState();
  const [filter, setFilter] = useState<(typeof eventFilters)[number]["value"]>("upcoming");
  const [selectedBrick, setSelectedBrick] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [startDateTime, setStartDateTime] = useState("");
  const [endDateTime, setEndDateTime] = useState("");
  const [newEventBrick, setNewEventBrick] = useState<string>("");
  const monthStart = useMemo(() => format(startOfMonth(monthCursor), "yyyy-MM-dd"), [monthCursor]);
  const monthEnd = useMemo(() => format(endOfMonth(monthCursor), "yyyy-MM-dd"), [monthCursor]);

  const bricksQuery = useQuery({
    queryKey: queryKeys.bricks,
    queryFn: brickApi.getAll,
  });

  const eventsQuery = useQuery({
    queryKey: queryKeys.events({
      filter,
      brickId: selectedBrick === "all" ? undefined : selectedBrick,
      startDate: monthStart,
      endDate: monthEnd,
    }),
    queryFn: () =>
      eventApi.getAll({
        filter,
        brickId: selectedBrick === "all" ? undefined : selectedBrick,
        startDate: monthStart,
        endDate: monthEnd,
      }),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!title.trim()) {
        throw new Error("Title is required");
      }

      if (!startDateTime || !endDateTime) {
        throw new Error("Start and end date/time are required");
      }

      return eventApi.create({
        title,
        location,
        brick: newEventBrick || undefined,
        startTime: new Date(startDateTime).toISOString(),
        endTime: new Date(endDateTime).toISOString(),
        isAllDay,
      });
    },
    onSuccess: () => {
      toast.success("Event created");
      setCreateOpen(false);
      setTitle("");
      setLocation("");
      setStartDateTime("");
      setEndDateTime("");
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create event"),
  });

  const bricks = useMemo(() => {
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

  const filteredEvents = useMemo(() => {
    const all = eventsQuery.data || [];
    if (!searchText.trim()) {
      return all;
    }

    const q = searchText.toLowerCase();

    return all.filter(
      (event) =>
        event.title.toLowerCase().includes(q) ||
        event.location?.toLowerCase().includes(q) ||
        event.brick?.name?.toLowerCase().includes(q)
    );
  }, [eventsQuery.data, searchText]);

  const paged = useMemo(() => paginateArray(filteredEvents, page, 6), [filteredEvents, page]);

  React.useEffect(() => {
    setPage(1);
  }, [filter, monthEnd, monthStart, searchText, selectedBrick]);

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral" className="rounded-full px-4 py-2">
            <ListFilter className="size-4" /> All
          </Badge>
          {bricks.map((brick) => {
            const active = selectedBrick === brick._id;

            return (
              <button
                type="button"
                key={brick._id}
                className="rounded-full"
                onClick={() => setSelectedBrick(active ? "all" : brick._id)}
              >
                <Badge
                  variant={active ? "blue" : "neutral"}
                  className="rounded-full px-4 py-2"
                  style={
                    active
                      ? { backgroundColor: brick.color, color: "white" }
                      : { color: brick.color, borderColor: brick.color }
                  }
                >
                  <BrickIcon name={brick.icon} className="size-4" /> {brick.name}
                </Badge>
              </button>
            );
          })}

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <button className="flex size-9 items-center justify-center rounded-full border border-[#B2B8C6] text-[#7B8395] hover:bg-[#ECF0F7]">
                <Plus className="size-4" />
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl rounded-[26px]">
              <DialogHeader>
                <DialogTitle>Create event</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
                <Input placeholder="Location" value={location} onChange={(event) => setLocation(event.target.value)} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input type="datetime-local" value={startDateTime} onChange={(event) => setStartDateTime(event.target.value)} />
                  <Input type="datetime-local" value={endDateTime} onChange={(event) => setEndDateTime(event.target.value)} />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-[#E4E8F0] p-3">
                  <p className="font-medium text-[#3A404D]">All day</p>
                  <Switch checked={isAllDay} onCheckedChange={setIsAllDay} />
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
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create event"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="h-10 w-full min-w-[220px] rounded-xl bg-white sm:w-[260px]"
            placeholder="Search events..."
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <div className="flex items-center rounded-xl border border-[#CCD2DE]">
            {eventFilters.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={`font-poppins px-4 py-2 text-[20px] leading-[120%] font-medium ${
                  filter === item.value ? "bg-[#DFE5F2] text-[#252932]" : "text-[#727A8A]"
                }`}
              >
                {item.label}
              </button>
            ))}
            <button className="px-3 text-[#717A8A]">
              <SlidersHorizontal className="size-4" />
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-[#E0E4EC] bg-[#F4F6FA] p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="font-poppins text-[32px] leading-[120%] font-semibold text-[#3D414A]">Events</p>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex size-9 items-center justify-center rounded-full border border-[#B2B8C6] bg-white text-[#7B8395] hover:bg-[#ECF0F7]"
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
                const incompleteCount = event.todos?.filter((todo) => !todo.isCompleted).length ?? 0;

                return (
                  <Link key={event._id} href={`/events/${event._id}`}>
                    <Card className="rounded-2xl border border-[#D9DEE9] bg-[#E6EAF1] px-4 py-3 shadow-none transition hover:scale-[1.002] hover:border-[#C8D0DF]">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start gap-3">
                          <span className="mt-1 h-8 w-1.5 rounded-full" style={{ backgroundColor: event.brick?.color || "#F7C700" }} />
                          <div>
                            <p className="font-poppins text-[40px] leading-[120%] font-semibold text-[#3D414A]">{event.title}</p>
                            <div className="font-poppins mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[#4D5463]">
                              <span className="flex items-center gap-1.5 text-[20px] leading-[120%] font-medium">
                                <CalendarDays className="size-4" /> {format(new Date(event.startTime), "dd MMM yyyy")}
                              </span>
                              <span className="flex items-center gap-1.5 text-[20px] leading-[120%] font-medium">
                                <MapPin className="size-4" /> {event.location || "No location"}
                              </span>
                              <span className="flex items-center gap-1.5 text-[20px] leading-[120%] font-medium">
                                <Clock3 className="size-4" />
                                {event.isAllDay
                                  ? "All day"
                                  : `${format(new Date(event.startTime), "hh:mm a")} - ${format(new Date(event.endTime), "hh:mm a")}`}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="font-poppins flex items-center gap-3 text-[#7A8293]">
                          <AlarmClock className="size-5" />
                          <span className="rounded-full bg-white px-2 py-0.5 text-[14px] leading-[120%] font-normal">{incompleteCount}</span>
                        </div>
                      </div>
                    </Card>
                  </Link>
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
    </div>
  );
}
