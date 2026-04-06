"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import {
  ArrowLeft,
  Bell,
  Clock3,
  ImagePlus,
  Link2,
  Locate,
  Maximize2,
  Paperclip,
  Pencil,
  UserPlus,
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
  userApi,
  type EventData,
  type EventTodo,
  type JamMessage,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import {
  formatIsoTimeByPreference,
} from "@/lib/time-format";
import { AllDayTabToggle } from "@/components/shared/all-day-tab-toggle";
import { BrickIcon } from "@/components/shared/brick-icon";
import { DragScrollArea } from "@/components/shared/drag-scroll-area";
import { EmptyState } from "@/components/shared/empty-state";
import {
  EventDateRangePopup,
  EventTimeRangePopup,
} from "@/components/shared/event-date-time-popups";
import { EventRangeField, EventSingleField } from "@/components/shared/event-range-field";
import { SectionLoading } from "@/components/shared/section-loading";
import { MessageComposer } from "./_components/message-composer";
import { TodoSection } from "./_components/todo-section";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function mapParticipants(participants: EventData["participants"]) {
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

function getParticipantDisplayName(participant: {
  name?: string;
  username?: string;
  email?: string;
}) {
  return (
    participant.name || participant.username || participant.email || "User"
  );
}

function isLinkText(value: string) {
  return /^https?:\/\/\S+$/i.test(value.trim());
}

function getDisplayNameFromMessage(message: JamMessage) {
  return message.user.name || message.user.username || "User";
}

function getMessageAvatarUrl(message: JamMessage) {
  return message.user.avatar?.url || message.user.profilePicture;
}

function formatMessageStamp(value: string, use24Hour: boolean) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return formatIsoTimeByPreference(value, use24Hour);
}

function getMessageLabel(message: JamMessage) {
  return (
    message.text ||
    message.fileName ||
    (message.messageType === "link" ? "Link" : "Media")
  );
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
  const editHasDateRange = Boolean(editStartDate && editEndDate);
  const editIsSingleDayEvent = Boolean(
    editStartDate && editEndDate && editStartDate === editEndDate,
  );

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
  const eventStartTimeValue = hasValidSchedule ? format(startDate, "HH:mm") : "";
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

    const nextStart = new Date(`${editStartDate}T${(editStartTime || "00:00")}:00`);
    const nextEnd = new Date(`${editEndDate}T${(resolvedEndTime || "00:00")}:00`);

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
              onChange={(eventValue) => setEditLocation(eventValue.target.value)}
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
            <DragScrollArea className="pb-1">
              {bricks.map((brick) => (
                <button
                  key={brick._id}
                  type="button"
                  className="shrink-0"
                  onClick={() => setEditBrickId(brick._id)}
                >
                  <Badge
                    variant={editBrickId === brick._id ? "blue" : "neutral"}
                    style={
                      editBrickId === brick._id
                        ? { backgroundColor: brick.color }
                        : { color: brick.color, borderColor: brick.color }
                    }
                    className="rounded-full px-4 py-1 !text-[16px]"
                  >
                    <BrickIcon name={brick.icon} className="size-4" />{" "}
                    {brick.name}
                  </Badge>
                </button>
              ))}
            </DragScrollArea>
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
          onApply={({ startTime: nextStartTime, endTime: nextEndTime, rollsEndToNextDay }) => {
            setEditStartTime(nextStartTime);
            setEditEndTime(nextEndTime);
            if (
              rollsEndToNextDay &&
              editStartDate &&
              editEndDate &&
              editStartDate === editEndDate
            ) {
              setEditEndDate(
                format(addDays(new Date(`${editEndDate}T00:00:00`), 1), "yyyy-MM-dd"),
              );
              toast.message("End time moved the end date to the next day.");
            }
          }}
        />

      <section className="event-details-shell rounded-[16px] border border-[var(--border)] bg-[var(--surface-1)] p-2">
        <div className="event-details-card rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-start gap-2">
                <span className="mt-1 h-8 w-1.5 rounded-full" style={{ backgroundColor: event.brick?.color || "#F7C700" }} />
                <p className="truncate text-[25px] font-medium leading-tight text-[var(--text-strong)]">
                  {event.title}
                </p>
              </div>
              <div className="mt-1.5 pl-3">
                {event.brick ? (
                  <Badge
                    variant="blue"
                    className="rounded-full px-2.5 py-0 text-[11px]"
                    style={{ backgroundColor: event.brick.color }}
                  >
                    <BrickIcon name={event.brick.icon} className="size-3.5" />{" "}
                    {event.brick.name}
                  </Badge>
                ) : null}
              </div>
            </div>
            <div className="mt-1 flex shrink-0 items-center gap-2">
              <div className="flex items-center">
                {participants.slice(0, 4).map((participant, index) => (
                  <Avatar
                    key={participant._id}
                    className={`size-6 border-2 border-[var(--border)] ${
                      index === 0 ? "" : "-ml-2"
                    }`}
                  >
                    <AvatarImage src={participant.avatar?.url} />
                    <AvatarFallback className="text-[14px] bg-gray-300 text-gray-400">
                      {getParticipantDisplayName(participant).slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {participants.length > 4 ? (
                  <span className="-ml-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-[var(--border)] bg-[var(--surface-3)] px-1 text-[10px] font-medium text-[var(--text-muted)]">
                    +{participants.length - 4}
                  </span>
                ) : null}
              </div>

              <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="rounded-full p-1 text-[var(--text-muted)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Add participants"
                    disabled={!isEventOwner}
                  >
                    <UserPlus className="size-[16px]" />
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-lg rounded-[26px] space-y-4">
                  <DialogHeader>
                    <DialogTitle className="text-[24px]">
                      Add participants
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-2">
                        {usersQuery.isLoading ? (
                          <SectionLoading rows={3} />
                        ) : usersQuery.isError ? (
                          <p className="px-2 py-3 text-center text-xs text-[var(--text-muted)]">
                            Failed to load users
                          </p>
                        ) : allUsers.length ? (
                          allUsers.map((user) => {
                            const checked = selectedShareUserIds.includes(
                              user._id,
                            );
                            const alreadyAdded = currentParticipantIds.has(
                              user._id,
                            );

                            return (
                              <label
                                key={user._id}
                                className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--surface-3)]"
                              >
                                <div className="flex min-w-0 items-center gap-2">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(next) =>
                                      toggleShareUser(user._id, Boolean(next))
                                    }
                                  />
                                  <Avatar className="size-7 border border-[var(--border)]">
                                    <AvatarImage src={user.avatar?.url} />
                                    <AvatarFallback>
                                      {getParticipantDisplayName(user).slice(
                                        0,
                                        1,
                                      )}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm text-[var(--text-default)]">
                                      {getParticipantDisplayName(user)}
                                    </p>
                                    <p className="truncate text-[11px] text-[var(--text-muted)]">
                                      {user.email}
                                    </p>
                                  </div>
                                </div>
                                {alreadyAdded ? (
                                  <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
                                    Added
                                  </span>
                                ) : null}
                              </label>
                            );
                          })
                        ) : (
                          <p className="px-2 py-3 text-center text-xs text-[var(--text-muted)]">
                            No users found
                          </p>
                        )}
                      </div>
                      <Button
                        className="h-10 w-full rounded-xl text-[20px] font-medium"
                        onClick={handleShareWithSelectedUsers}
                        disabled={
                          usersQuery.isLoading || updateEventMutation.isPending
                        }
                      >
                        {updateEventMutation.isPending
                          ? "Saving..."
                          : "Save participants"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="mt-4 flex items-start justify-between gap-3 text-[var(--text-strong)]">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-end gap-x-5 gap-y-1.5 sm:gap-x-7">
                <EventRangeField
                  kind="date"
                  startValue={eventStartDateValue}
                  endValue={eventEndDateValue}
                  interactive={false}
                  className="-ml-1"
                />
                {event.isAllDay ? (
                  <p className="flex items-center gap-2 px-1 py-1 text-[13px] font-medium text-[var(--text-default)]">
                    <Clock3 className="size-4 text-[var(--text-muted)]" />
                    All day
                  </p>
                ) : (
                  <EventRangeField
                    kind="time"
                    startValue={eventStartTimeValue}
                    endValue={eventEndTimeValue}
                    use24Hour={preferences.use24Hour}
                    collapseSingleValue={eventStartDateValue === eventEndDateValue}
                    interactive={false}
                    className="-ml-1"
                  />
                )}
              </div>
              <p className="flex items-center gap-2 px-1 text-[13px] text-[var(--text-default)]">
                <Locate className="size-4 text-[var(--text-muted)]" />
                {event.location || "No location"}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                type="button"
                className="rounded-full p-1 text-[var(--text-muted)] transition hover:bg-[var(--surface-3)]"
                aria-label="Notification"
              >
                <Bell className="size-4" />
              </button>
              <Badge
                variant="neutral"
                className="rounded-full border border-[var(--border)] bg-transparent px-2.5 py-1 !text-[14px] text-[var(--text-strong)]"
              >
                {event.isAllDay ? "All day" : "Scheduled"}
              </Badge>
            </div>
          </div>
        </div>

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

        <Card className="mt-3 rounded-[22px] border border-[var(--border)] bg-[var(--surface-2)] p-3.5 shadow-none">
          {jamView === "jam" ? (
            <div className="mb-2 flex items-center justify-end gap-1">
              <button
                type="button"
                className="rounded-full p-1 text-[var(--text-muted)] transition hover:bg-[var(--surface-3)]"
                onClick={() => router.push(`/events/${id}/messages`)}
                aria-label="Open messages page"
              >
                <Maximize2 className="size-4" />
              </button>
              <button
                type="button"
                className="rounded-full p-1 text-[var(--text-muted)] transition hover:bg-[var(--surface-3)]"
                onClick={() => {
                  setLibraryTab("media");
                  setJamView("media");
                }}
                aria-label="Open media files and links"
              >
                <ImagePlus className="size-4" />
              </button>
            </div>
          ) : null}

          {jamView === "media" ? (
            <>
              <div className="mb-3 flex items-center gap-2 text-[var(--text-muted)]">
                <button
                  type="button"
                  className="rounded-full p-1 transition hover:bg-[var(--surface-3)]"
                  onClick={() => setJamView("jam")}
                  aria-label="Back to JAM"
                >
                  <ArrowLeft className="size-5" />
                </button>
                <div className="grid flex-1 grid-cols-3 rounded-full bg-[var(--surface-3)] p-1 text-sm">
                  {(["media", "files", "link"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={`rounded-full px-2 py-1 capitalize transition ${
                        tab === libraryTab
                          ? "bg-[var(--surface-1)] text-[var(--text-strong)]"
                          : "text-[var(--text-muted)]"
                      }`}
                      onClick={() => setLibraryTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {libraryTab === "media" ? (
                mediaMessages.length ? (
                  <div className="grid max-h-[460px] grid-cols-4 gap-1 overflow-auto">
                    {mediaMessages.map((message) => (
                      <div
                        key={message._id}
                        className="overflow-hidden rounded-sm bg-[var(--surface-1)]"
                      >
                        {message.mediaUrl ? (
                          <Image
                            src={message.mediaUrl}
                            alt={message.fileName || "media"}
                            width={120}
                            height={90}
                            className="h-[88px] w-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-[88px] items-center justify-center px-2 text-center text-xs text-[var(--text-muted)]">
                            {getMessageLabel(message)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No media"
                    description="Attach photos in chat and they will show here."
                  />
                )
              ) : null}

              {libraryTab === "files" ? (
                fileMessages.length ? (
                  <div className="max-h-[460px] space-y-2 overflow-auto">
                    {fileMessages.map((message) => (
                      <div
                        key={message._id}
                        className="flex items-center justify-between rounded-xl bg-[var(--surface-1)] px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-[var(--text-strong)]">
                            {message.fileName || getMessageLabel(message)}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {formatMessageStamp(message.createdAt, preferences.use24Hour)}
                          </p>
                        </div>
                        <Paperclip className="size-4 text-[var(--text-muted)]" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No files"
                    description="Uploaded files from chat will appear here."
                  />
                )
              ) : null}

              {libraryTab === "link" ? (
                linkMessages.length ? (
                  <div className="max-h-[460px] space-y-2 overflow-auto">
                    {linkMessages.map((message) => {
                      const linkValue = (message.text || "").trim();
                      return (
                        <a
                          key={message._id}
                          href={linkValue}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between rounded-xl bg-[var(--surface-1)] px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm text-[var(--text-strong)]">
                              {linkValue || "Link"}
                            </p>
                            <p className="text-xs text-[var(--text-muted)]">
                              {formatMessageStamp(message.createdAt, preferences.use24Hour)}
                            </p>
                          </div>
                          <Link2 className="size-4 text-[var(--text-muted)]" />
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    title="No links"
                    description="Links shared in messages will appear here."
                  />
                )
              ) : null}
            </>
          ) : null}

          {jamView === "jam" ? (
            <>
              <div className="max-h-[300px] space-y-3 overflow-auto rounded-[22px] bg-[var(--surface-3)] p-2">
                {messagesQuery.isLoading ? (
                  <SectionLoading rows={3} />
                ) : jamPreviewMessages.length ? (
                  jamPreviewMessages.map((message) => {
                    const rawName = getDisplayNameFromMessage(message).trim();
                    const isMe = viewerId
                      ? message.user._id === viewerId
                      : rawName === "Me";
                    const displayName = isMe ? "Me" : rawName || "User";

                    return (
                      <div
                        key={message._id}
                        className={`flex items-end gap-2 ${
                          isMe ? "justify-end" : ""
                        }`}
                      >
                        {!isMe ? (
                          <Avatar className="size-10 border border-[var(--border)]">
                            <AvatarImage src={getMessageAvatarUrl(message)} />
                            <AvatarFallback>
                              {displayName.slice(0, 1)}
                            </AvatarFallback>
                          </Avatar>
                        ) : null}
                        <div
                          className={`min-w-0 max-w-[85%] ${
                            isMe ? "text-right" : ""
                          }`}
                        >
                          <p
                            className={`mb-1 text-[14px] leading-none font-medium ${
                              isMe
                                ? "text-[var(--ui-btn-secondary-text)]"
                                : "text-[var(--text-strong)]"
                            }`}
                          >
                            {displayName}
                          </p>
                          <div
                            className={`flex items-end gap-2 ${
                              isMe ? "justify-end" : ""
                            }`}
                          >
                            {isMe ? (
                              <p className="pb-0.5 text-[10px] text-[var(--text-muted)]">
                                {formatMessageStamp(message.createdAt, preferences.use24Hour)}
                              </p>
                            ) : null}
                            <div
                              className={`max-w-[260px] rounded-[18px] border px-3 py-1.5 text-[12px] ${
                                isMe
                                  ? "border-[color:color-mix(in_srgb,var(--ui-btn-secondary-text)_20%,var(--border)_80%)] bg-[var(--ui-btn-secondary-bg)] text-[var(--ui-btn-secondary-text)]"
                                  : "border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-strong)]"
                              }`}
                            >
                              {getMessageLabel(message)}
                            </div>
                            {!isMe ? (
                              <p className="pb-0.5 text-[10px] text-[var(--text-muted)]">
                                {formatMessageStamp(message.createdAt, preferences.use24Hour)}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        {isMe ? (
                          <Avatar className="size-10 border border-[var(--border)]">
                            <AvatarImage src={getMessageAvatarUrl(message)} />
                            <AvatarFallback>
                              {displayName.slice(0, 1)}
                            </AvatarFallback>
                          </Avatar>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <EmptyState
                    title="No messages"
                    description="Start chatting with participants."
                  />
                )}
              </div>

              <div className="mt-3">
                <MessageComposer
                  messageText={messageText}
                  onMessageChange={setMessageText}
                  onFileChange={setSelectedFile}
                  selectedFileName={selectedFile?.name}
                  onSend={() => sendMessageMutation.mutate()}
                  isSending={sendMessageMutation.isPending}
                />
              </div>
            </>
          ) : null}

        </Card>
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
