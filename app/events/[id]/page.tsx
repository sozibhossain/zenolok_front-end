"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import {
  ArrowLeft,
  Pencil,
  Trash2,
} from "lucide-react";
import { addDays, endOfDay, format, startOfDay } from "date-fns";
import { toast } from "sonner";

import { useAppState } from "@/components/providers/app-state-provider";
import {
  brickApi,
  eventApi,
  eventTodoApi,
  jamApi,
  notificationApi,
  userApi,
  type EventData,
  type EventTodo,
  type JamMessage,
  type UserProfile,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { AllDayTabToggle } from "@/components/shared/all-day-tab-toggle";
import { EmptyState } from "@/components/shared/empty-state";
import { EventBrickSelector } from "@/components/shared/event-brick-selector";
import {
  EventDateRangePopup,
  EventTimeRangePopup,
} from "@/components/shared/event-date-time-popups";
import {
  EventRangeField,
  EventSingleField,
} from "@/components/shared/event-range-field";
import { SectionLoading } from "@/components/shared/section-loading";
import { EventLibraryPanel } from "./_components/event-library-panel";
import {
  EventSummaryCard,
} from "./_components/event-summary-card";
import { JamPreviewPanel } from "./_components/jam-preview-panel";
import { TodoSection } from "./_components/todo-section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function mapParticipants(participants: EventData["participants"]): UserProfile[] {
  const mapped = participants
    .map((participant) =>
      typeof participant === "string" ? null : participant,
    )
    .filter((participant): participant is NonNullable<typeof participant> =>
      Boolean(participant),
    );

  const seen = new Set<string>();
  return mapped.filter((participant) => {
    if (seen.has(participant._id)) {
      return false;
    }
    seen.add(participant._id);
    return true;
  });
}

function mapParticipantIds(participants: EventData["participants"]) {
  const ids = participants
    .map((participant) =>
      typeof participant === "string" ? participant : participant._id,
    )
    .filter((participantId): participantId is string => Boolean(participantId));

  return Array.from(new Set(ids));
}

function isLinkText(value: string) {
  return /^https?:\/\/\S+$/i.test(value.trim());
}

function sortMessagesByCreatedAt(messages: JamMessage[]) {
  return [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function appendMessageIfMissing(messages: JamMessage[], next: JamMessage) {
  if (messages.some((message) => message._id === next._id)) {
    return messages;
  }

  return sortMessagesByCreatedAt([...messages, next]);
}

function toDateValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return format(date, "yyyy-MM-dd");
}

function toTimeValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return format(date, "HH:mm");
}

export default function EventDetailsPage() {
  const { preferences } = useAppState();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const id = params.id;

  const [newTodoText, setNewTodoText] = useState("");
  const [messageText, setMessageText] = useState("");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedShareUserIds, setSelectedShareUserIds] = useState<string[]>(
    [],
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editBrickId, setEditBrickId] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editDatePopupOpen, setEditDatePopupOpen] = useState(false);
  const [editTimePopupOpen, setEditTimePopupOpen] = useState(false);
  const [editIsAllDay, setEditIsAllDay] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jamView, setJamView] = useState<"jam" | "media">("jam");
  const [libraryTab, setLibraryTab] = useState<"media" | "files" | "link">(
    "media",
  );
  const socketRef = React.useRef<Socket | null>(null);
  const messagesPanelRef = React.useRef<HTMLDivElement | null>(null);
  const hasHandledFocusMessagesRef = React.useRef(false);
  const hasMarkedMessageNotificationsReadRef = React.useRef(false);
  const socketServerUrl = React.useMemo(
    () =>
      (
        process.env.NEXT_PUBLIC_BASE_URL ||
        process.env.NEXTPUBLICBASEURL ||
        ""
      ).replace(/\/+$/, ""),
    [],
  );

  const eventQuery = useQuery({
    queryKey: queryKeys.event(id),
    queryFn: () => eventApi.getById(id),
    enabled: Boolean(id),
  });

  const eventTodosQuery = useQuery({
    queryKey: queryKeys.eventTodos(id),
    queryFn: () => eventTodoApi.getByEvent(id),
    enabled: Boolean(id),
  });

  const messagesQuery = useQuery({
    queryKey: queryKeys.jamMessages(id),
    queryFn: () => jamApi.getByEvent(id),
    enabled: Boolean(id),
  });

  const usersQuery = useQuery({
    queryKey: ["users-for-event-share"],
    queryFn: async () => {
      const firstPage = await userApi.getAll({ page: 1, limit: 200 });
      const totalUsers = firstPage.meta.total;

      if (totalUsers > firstPage.users.length) {
        return userApi.getAll({ page: 1, limit: totalUsers });
      }

      return firstPage;
    },
    enabled: shareDialogOpen,
  });

  const bricksQuery = useQuery({
    queryKey: queryKeys.bricks,
    queryFn: brickApi.getAll,
  });

  const profileQuery = useQuery({
    queryKey: queryKeys.profile,
    queryFn: userApi.getProfile,
  });
  const markEventMessagesReadMutation = useMutation({
    mutationFn: () => notificationApi.markEventMessagesRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
  const editHasDateRange = Boolean(editStartDate && editEndDate);
  const editIsSingleDayEvent = Boolean(
    editStartDate && editEndDate && editStartDate === editEndDate,
  );
  const shouldFocusMessages = searchParams.get("focus") === "messages";

  React.useEffect(() => {
    hasHandledFocusMessagesRef.current = false;
    hasMarkedMessageNotificationsReadRef.current = false;
  }, [id]);

  React.useEffect(() => {
    if (!id || !socketServerUrl) {
      return;
    }

    const socket = io(socketServerUrl, {
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    const handleConnect = () => {
      socket.emit("joinEventRoom", id);
    };

    const handleNewMessage = (message: JamMessage) => {
      queryClient.setQueryData<JamMessage[]>(
        queryKeys.jamMessages(id),
        (previous = []) => appendMessageIfMissing(previous, message),
      );
    };

    const handleDeleteMessage = (messageId: string) => {
      queryClient.setQueryData<JamMessage[]>(
        queryKeys.jamMessages(id),
        (previous = []) =>
          previous.filter((message) => message._id !== messageId),
      );
    };

    socket.on("connect", handleConnect);
    socket.on("newMessage", handleNewMessage);
    socket.on("deleteMessage", handleDeleteMessage);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("newMessage", handleNewMessage);
      socket.off("deleteMessage", handleDeleteMessage);
      socket.disconnect();

      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [id, queryClient, socketServerUrl]);

  const refreshEverything = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.event(id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.eventTodos(id) });
    queryClient.invalidateQueries({
      queryKey: queryKeys.events({ filter: "upcoming" }),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.events({ filter: "past" }),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.events({ filter: "all" }),
    });
    queryClient.invalidateQueries({ queryKey: queryKeys.jamMessages(id) });
  };

  const deleteEventMutation = useMutation({
    mutationFn: () => eventApi.delete(id),
    onSuccess: () => {
      toast.success("Event deleted");
      router.push("/events");
      router.refresh();
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to delete event"),
  });

  const updateEventMutation = useMutation({
    mutationFn: (payload: Parameters<typeof eventApi.update>[1]) =>
      eventApi.update(id, payload),
    onSuccess: () => {
      toast.success("Event updated");
      refreshEverything();
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update event"),
  });

  const addTodoMutation = useMutation({
    mutationFn: ({ text, isShared }: { text: string; isShared?: boolean }) => {
      if (!text.trim()) {
        throw new Error("Todo text is required");
      }

      return eventTodoApi.create({
        text: text.trim(),
        eventId: id,
        isShared: Boolean(isShared),
      });
    },
    onSuccess: () => {
      setNewTodoText("");
      refreshEverything();
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to add todo"),
  });

  const updateTodoMutation = useMutation({
    mutationFn: ({
      todoId,
      payload,
    }: {
      todoId: string;
      payload: Partial<EventTodo>;
    }) => eventTodoApi.update(todoId, payload),
    onSuccess: refreshEverything,
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update todo"),
  });

  const deleteTodoMutation = useMutation({
    mutationFn: (todoId: string) => eventTodoApi.delete(id, todoId),
    onSuccess: refreshEverything,
    onError: (error: Error) =>
      toast.error(error.message || "Failed to delete todo"),
  });

  const addTodoSubnoteMutation = useMutation({
    mutationFn: ({ todoId, text }: { todoId: string; text: string }) => {
      if (!text.trim()) {
        throw new Error("Note text is required");
      }

      return eventTodoApi.addSubnote(todoId, { text: text.trim() });
    },
    onSuccess: refreshEverything,
    onError: (error: Error) =>
      toast.error(error.message || "Failed to add note"),
  });

  const updateTodoSubnoteMutation = useMutation({
    mutationFn: ({
      todoId,
      subnoteId,
      text,
    }: {
      todoId: string;
      subnoteId: string;
      text: string;
    }) => {
      if (!text.trim()) {
        throw new Error("Note text is required");
      }

      return eventTodoApi.updateSubnote(todoId, subnoteId, {
        text: text.trim(),
      });
    },
    onSuccess: refreshEverything,
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update note"),
  });

  const sendMessageMutation = useMutation({
    mutationFn: () => {
      if (!messageText.trim() && !selectedFile) {
        throw new Error("Write a message or attach a file");
      }

      const nextText = messageText.trim();
      let messageType: "text" | "media" | "file" | "link" = "text";

      if (selectedFile) {
        messageType =
          selectedFile.type.startsWith("image/") ||
          selectedFile.type.startsWith("video/")
            ? "media"
            : "file";
      } else if (nextText && isLinkText(nextText)) {
        messageType = "link";
      }

      const form = new FormData();
      form.append("eventId", id);
      if (nextText) {
        form.append("text", nextText);
      }
      form.append("messageType", messageType);

      if (selectedFile) {
        form.append("file", selectedFile);
      }

      return jamApi.create(form);
    },
    onSuccess: (message) => {
      setMessageText("");
      setSelectedFile(null);
      queryClient.setQueryData<JamMessage[]>(
        queryKeys.jamMessages(id),
        (previous = []) => appendMessageIfMissing(previous, message),
      );
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to send message"),
  });

  const event = eventQuery.data;
  const participants = useMemo(
    () => mapParticipants(event?.participants || []),
    [event?.participants],
  );
  const viewerId = profileQuery.data?._id;
  const currentParticipantIds = useMemo(
    () => new Set(mapParticipantIds(event?.participants || [])),
    [event?.participants],
  );
  const bricks = useMemo(() => bricksQuery.data ?? [], [bricksQuery.data]);

  React.useEffect(() => {
    if (!shareDialogOpen || !event) {
      return;
    }

    setSelectedShareUserIds(mapParticipantIds(event.participants || []));
  }, [shareDialogOpen, event]);

  React.useEffect(() => {
    if (!editDialogOpen || !event) {
      return;
    }

    setEditTitle(event.title || "");
    setEditLocation(event.location || "");
    setEditBrickId(event.brick?._id || "");
    setEditStartDate(toDateValue(event.startTime));
    setEditEndDate(toDateValue(event.endTime));
    setEditStartTime(toTimeValue(event.startTime));
    setEditEndTime(toTimeValue(event.endTime));
    setEditIsAllDay(Boolean(event.isAllDay));
  }, [editDialogOpen, event]);

  React.useEffect(() => {
    if (!editHasDateRange) {
      setEditTimePopupOpen(false);
    }
  }, [editHasDateRange]);

  React.useEffect(() => {
    if (editIsAllDay || !editIsSingleDayEvent) {
      return;
    }

    setEditEndTime((previous) => {
      if (!editStartTime) {
        return previous ? "" : previous;
      }

      return previous === editStartTime ? previous : editStartTime;
    });
  }, [editIsAllDay, editIsSingleDayEvent, editStartTime]);

  React.useEffect(() => {
    if (
      !shouldFocusMessages ||
      !event ||
      !messagesPanelRef.current ||
      hasHandledFocusMessagesRef.current
    ) {
      return;
    }

    hasHandledFocusMessagesRef.current = true;

    const timeoutId = window.setTimeout(() => {
      messagesPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 160);

    return () => window.clearTimeout(timeoutId);
  }, [event, shouldFocusMessages]);

  React.useEffect(() => {
    if (!id || !messagesPanelRef.current) {
      return;
    }

    const panelNode = messagesPanelRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;

        if (
          !entry?.isIntersecting ||
          entry.intersectionRatio < 0.55 ||
          hasMarkedMessageNotificationsReadRef.current
        ) {
          return;
        }

        hasMarkedMessageNotificationsReadRef.current = true;
        markEventMessagesReadMutation.mutate(undefined, {
          onError: () => {
            hasMarkedMessageNotificationsReadRef.current = false;
          },
        });
      },
      {
        threshold: [0.55],
      },
    );

    observer.observe(panelNode);

    return () => observer.disconnect();
  }, [id, markEventMessagesReadMutation]);

  if (eventQuery.isLoading) {
    return <SectionLoading rows={6} />;
  }

  if (!event) {
    return (
      <EmptyState
        title="Event not found"
        description="The event was removed or you don't have access."
      />
    );
  }

  const messages = messagesQuery.data || [];
  const privateTodos = (eventTodosQuery.data || []).filter(
    (todo) => !todo.isShared,
  );
  const mediaMessages = messages.filter(
    (message) => message.messageType === "media" || Boolean(message.mediaUrl),
  );
  const fileMessages = messages.filter(
    (message) =>
      message.messageType === "file" ||
      (!message.mediaUrl &&
        Boolean(message.fileName) &&
        message.messageType !== "link"),
  );
  const linkMessages = messages.filter(
    (message) =>
      message.messageType === "link" || isLinkText(message.text || ""),
  );
  const jamPreviewMessages = messages.slice(-2);
  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);
  const hasValidSchedule =
    !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime());
  const eventStartDateValue = hasValidSchedule
    ? format(startDate, "yyyy-MM-dd")
    : "";
  const eventEndDateValue = hasValidSchedule
    ? format(endDate, "yyyy-MM-dd")
    : "";
  const eventStartTimeValue = hasValidSchedule
    ? format(startDate, "HH:mm")
    : "";
  const eventEndTimeValue = hasValidSchedule ? format(endDate, "HH:mm") : "";
  const allUsers = usersQuery.data?.users || [];
  const isEventOwner = viewerId === event.createdBy;

  const toggleShareUser = (userId: string, checked: boolean) => {
    setSelectedShareUserIds((previous) => {
      if (checked) {
        if (previous.includes(userId)) {
          return previous;
        }
        return [...previous, userId];
      }
      return previous.filter((idValue) => idValue !== userId);
    });
  };

  const handleShareWithSelectedUsers = () => {
    if (!isEventOwner) {
      toast.error("Only the event creator can edit this event");
      return;
    }

    const nextParticipantIds = Array.from(new Set(selectedShareUserIds));
    const currentParticipantList = Array.from(currentParticipantIds);
    const hasChanges =
      nextParticipantIds.length !== currentParticipantList.length ||
      nextParticipantIds.some(
        (participantId) => !currentParticipantIds.has(participantId),
      );

    if (!hasChanges) {
      toast.info("No participant changes");
      return;
    }

    updateEventMutation.mutate(
      { participants: nextParticipantIds },
      {
        onSuccess: () => {
          setShareDialogOpen(false);
        },
      },
    );
  };

  const handleEditEvent = () => {
    if (!isEventOwner) {
      toast.error("Only the event creator can edit this event");
      return;
    }

    if (!editTitle.trim()) {
      toast.error("Title is required");
      return;
    }

    if (!editStartDate || !editEndDate) {
      toast.error("Start and end dates are required");
      return;
    }

    const usesSingleTime = !editIsAllDay && editStartDate === editEndDate;
    const resolvedEndTime = usesSingleTime ? editStartTime : editEndTime;

    if (!editIsAllDay && !editStartTime) {
      toast.error("Start time is required");
      return;
    }

    if (!editIsAllDay && !usesSingleTime && !resolvedEndTime) {
      toast.error("Start and end time are required");
      return;
    }

    const nextStart = new Date(
      `${editStartDate}T${editStartTime || "00:00"}:00`,
    );
    const nextEnd = new Date(`${editEndDate}T${resolvedEndTime || "00:00"}:00`);

    if (Number.isNaN(nextStart.getTime()) || Number.isNaN(nextEnd.getTime())) {
      toast.error("Invalid start or end date/time");
      return;
    }

    const normalizedStart = editIsAllDay ? startOfDay(nextStart) : nextStart;
    const normalizedEnd = editIsAllDay ? endOfDay(nextEnd) : nextEnd;

    if (normalizedEnd.getTime() < normalizedStart.getTime()) {
      toast.error("End date/time must be after start date/time");
      return;
    }

    updateEventMutation.mutate(
      {
        title: editTitle.trim(),
        location: editLocation.trim() || undefined,
        brick: editBrickId || undefined,
        isAllDay: editIsAllDay,
        startTime: normalizedStart.toISOString(),
        endTime: normalizedEnd.toISOString(),
      },
      {
        onSuccess: () => {
          setEditDialogOpen(false);
          setEditDatePopupOpen(false);
          setEditTimePopupOpen(false);
        },
      },
    );
  };

  return (
    <div className="event-details-page space-y-3 ">
      <div className=" flex items-center justify-between pt-1">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]"
        >
          <ArrowLeft className="size-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="cursor-pointer rounded-full p-1 text-[var(--ui-btn-danger-bg)] transition hover:bg-[var(--surface-3)]"
            onClick={() => {
              if (!isEventOwner) {
                toast.error("Only the event creator can delete this event");
                return;
              }
              setDeleteDialogOpen(true);
            }}
            aria-label="Delete event"
          >
            <Trash2 className="size-4" />
          </button>
          <button
            type="button"
            className="cursor-pointer rounded p-1 text-[var(--ui-btn-secondary-text)] transition hover:bg-[var(--ui-btn-secondary-bg)]"
            onClick={() => {
              if (!isEventOwner) {
                toast.error("Only the event creator can edit this event");
                return;
              }
              setEditDialogOpen(true);
            }}
            aria-label="Edit event"
          >
            <Pencil className="size-4" />
          </button>
        </div>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm rounded-[22px] space-y-2">
          <DialogHeader>
            <DialogTitle className="!text-[24px] font-medium text-[var(--text-strong)]">
              Delete this event?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--text-muted)]">
            This action cannot be undone.
          </p>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteEventMutation.isPending}
              className="!text-[14px]"
            >
              No
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() =>
                deleteEventMutation.mutate(undefined, {
                  onSuccess: () => {
                    setDeleteDialogOpen(false);
                  },
                })
              }
              className="!text-[14px]"
              disabled={deleteEventMutation.isPending}
            >
              {deleteEventMutation.isPending ? "Deleting..." : "Yes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setEditDatePopupOpen(false);
            setEditTimePopupOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-2xl rounded-[26px] space-y-3">
          <DialogHeader>
            <DialogTitle>Edit event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Title"
              value={editTitle}
              onChange={(eventValue) => setEditTitle(eventValue.target.value)}
            />
            <Input
              placeholder="Location"
              value={editLocation}
              onChange={(eventValue) =>
                setEditLocation(eventValue.target.value)
              }
            />
            <div className="space-y-3">
              <EventRangeField
                kind="date"
                startValue={editStartDate}
                endValue={editEndDate}
                onClick={() => setEditDatePopupOpen(true)}
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                {editIsAllDay ? (
                  <EventSingleField kind="time" label="All day" />
                ) : (
                  <EventRangeField
                    kind="time"
                    startValue={editStartTime}
                    endValue={editEndTime}
                    use24Hour={preferences.use24Hour}
                    collapseSingleValue={editIsSingleDayEvent}
                    onClick={() => setEditTimePopupOpen(true)}
                    disabled={!editHasDateRange}
                    className="max-w-full"
                  />
                )}
                <AllDayTabToggle
                  active={editIsAllDay}
                  onToggle={() => {
                    const next = !editIsAllDay;
                    setEditIsAllDay(next);
                    if (next) {
                      setEditTimePopupOpen(false);
                    }
                  }}
                  className="self-end sm:self-auto"
                />
              </div>
            </div>
            <EventBrickSelector
              bricks={bricks}
              selectedBrickId={editBrickId}
              onSelectBrick={setEditBrickId}
              badgeClassName="!text-[16px]"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={handleEditEvent}
              disabled={updateEventMutation.isPending}
            >
              {updateEventMutation.isPending ? "Updating..." : "Update event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <EventDateRangePopup
        open={editDatePopupOpen}
        onOpenChange={setEditDatePopupOpen}
        startDate={editStartDate}
        endDate={editEndDate}
        onApply={({ startDate: nextStartDate, endDate: nextEndDate }) => {
          setEditStartDate(nextStartDate);
          setEditEndDate(nextEndDate);
        }}
      />
      <EventTimeRangePopup
        open={editTimePopupOpen}
        onOpenChange={setEditTimePopupOpen}
        startTime={editStartTime}
        endTime={editEndTime}
        selectionMode={editIsSingleDayEvent ? "single" : "range"}
        onApply={({
          startTime: nextStartTime,
          endTime: nextEndTime,
          rollsEndToNextDay,
        }) => {
          setEditStartTime(nextStartTime);
          setEditEndTime(nextEndTime);
          if (
            rollsEndToNextDay &&
            editStartDate &&
            editEndDate &&
            editStartDate === editEndDate
          ) {
            setEditEndDate(
              format(
                addDays(new Date(`${editEndDate}T00:00:00`), 1),
                "yyyy-MM-dd",
              ),
            );
            toast.message("End time moved the end date to the next day.");
          }
        }}
      />

      <section className="event-details-shell rounded-[16px] border border-[var(--border)] bg-[var(--surface-1)] p-2">
        <EventSummaryCard
          event={event}
          participants={participants}
          eventStartDateValue={eventStartDateValue}
          eventEndDateValue={eventEndDateValue}
          eventStartTimeValue={eventStartTimeValue}
          eventEndTimeValue={eventEndTimeValue}
          use24Hour={preferences.use24Hour}
          shareDialogOpen={shareDialogOpen}
          onShareDialogOpenChange={setShareDialogOpen}
          isEventOwner={isEventOwner}
          allUsers={allUsers}
          selectedShareUserIds={selectedShareUserIds}
          currentParticipantIds={currentParticipantIds}
          onToggleShareUser={toggleShareUser}
          onSaveParticipants={handleShareWithSelectedUsers}
          isUsersLoading={usersQuery.isLoading}
          isUsersError={usersQuery.isError}
          isParticipantsSaving={updateEventMutation.isPending}
        />

        {jamView === "jam" ? (
          <div className="mt-3 space-y-3">
            <TodoSection
              todos={privateTodos}
              title="New todo"
              inputValue={newTodoText}
              onInputChange={setNewTodoText}
              onAdd={() => addTodoMutation.mutate({ text: newTodoText })}
              onToggle={(todo) =>
                updateTodoMutation.mutate({
                  todoId: todo._id,
                  payload: { isCompleted: !todo.isCompleted },
                })
              }
              onDelete={(todoId) => deleteTodoMutation.mutate(todoId)}
              onAddSubnote={async (todoId, text) => {
                await addTodoSubnoteMutation.mutateAsync({ todoId, text });
              }}
              onUpdateTodo={async (todoId, text) => {
                await updateTodoMutation.mutateAsync({
                  todoId,
                  payload: { text },
                });
              }}
              onUpdateSubnote={async (todoId, subnoteId, text) => {
                await updateTodoSubnoteMutation.mutateAsync({
                  todoId,
                  subnoteId,
                  text,
                });
              }}
            />
            {/* <TodoSection
              todos={sharedTodos}
              title="New shared todo"
              inputValue={newSharedTodoText}
              onInputChange={setNewSharedTodoText}
              onAdd={() => addTodoMutation.mutate({ text: newSharedTodoText, isShared: true })}
              onToggle={(todo) =>
                updateTodoMutation.mutate({
                  todoId: todo._id,
                  payload: { isCompleted: !todo.isCompleted },
                })
              }
              onDelete={(todoId) => deleteTodoMutation.mutate(todoId)}
            /> */}
          </div>
        ) : null}

        <div ref={messagesPanelRef}>
          <Card className="mt-3 rounded-[22px] border border-[var(--border)] bg-[var(--surface-2)] p-3.5 shadow-none">
          {jamView === "media" ? (
            <EventLibraryPanel
              libraryTab={libraryTab}
              onLibraryTabChange={setLibraryTab}
              mediaMessages={mediaMessages}
              fileMessages={fileMessages}
              linkMessages={linkMessages}
              use24Hour={preferences.use24Hour}
              onBackToJam={() => setJamView("jam")}
            />
          ) : (
            <JamPreviewPanel
              viewerId={viewerId}
              messages={jamPreviewMessages}
              isLoading={messagesQuery.isLoading}
              use24Hour={preferences.use24Hour}
              messageText={messageText}
              onMessageChange={setMessageText}
              onFileChange={setSelectedFile}
              selectedFileName={selectedFile?.name}
              onSend={() => sendMessageMutation.mutate()}
              isSending={sendMessageMutation.isPending}
              onOpenMessagesPage={() => router.push(`/events/${id}/messages`)}
              onOpenLibrary={() => {
                setLibraryTab("media");
                setJamView("media");
              }}
            />
          )}
          </Card>
        </div>
      </section>

      {jamView !== "jam" ? (
        <div className="flex items-center justify-center">
          <Button
            variant="ghost"
            className="rounded-full text-[var(--text-muted)]"
            onClick={() => setJamView("jam")}
          >
            <ArrowLeft className="mr-1 size-4" /> Back to JAM
          </Button>
        </div>
      ) : null}
    </div>
  );
}
