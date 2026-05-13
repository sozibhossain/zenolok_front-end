"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { addDays, endOfDay, format, startOfDay } from "date-fns";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  editorValueToOffset,
  formatAlarmOffset,
  formatAlarmPresetSummary,
  formatOffsetsSummary,
  offsetToEditorValue,
  resolveAlarmPresetOptions,
  type AlarmOffsetUnit,
} from "@/lib/alarm-presets";
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
  type UserProfile,
} from "@/lib/api";
import { NO_BRICK_EVENT_COLOR } from "@/lib/event-colors";
import { useEventMessagesSocket } from "@/hooks/use-event-messages-socket";
import { appendMessageIfMissing } from "@/lib/jam-messages";
import { queryKeys } from "@/lib/query-keys";
import { AllDayTabToggle } from "@/components/shared/all-day-tab-toggle";
import { EmptyState } from "@/components/shared/empty-state";
import { EventBrickSelector } from "@/components/shared/event-brick-selector";
import {
  EventDateRangePopup,
  EventTimeRangePopup,
} from "@/components/shared/event-date-time-popups";
import { EventDateTimeRangeField } from "@/components/shared/event-range-field";
import { SectionLoading } from "@/components/shared/section-loading";
import { EventSummaryCard } from "./_components/event-summary-card";
import { EventLibraryPanel } from "./_components/event-library-panel";
import { EventNotesPanel } from "./_components/event-notes-panel";
import { JamPreviewPanel } from "./_components/jam-preview-panel";
import { isLinkMessage } from "./_components/event-detail-helpers";
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
function mapParticipants(
  participants: EventData["participants"],
): UserProfile[] {
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

function isMediaFile(file: File) {
  if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
    return true;
  }

  return /\.(avif|bmp|gif|heic|heif|jpe?g|m4v|mov|mp4|mkv|png|svg|webm|webp)$/i.test(
    file.name,
  );
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
  // ISO timestamp of the specific occurrence the user clicked on the calendar.
  // Present only when navigating from a recurring event's instance.
  const occurrenceDateParam = searchParams.get("occurrenceDate");

  // Modal that asks "This and following events" vs "All events" when
  // editing/deleting a recurring event from a non-first occurrence.
  const [scopeDecision, setScopeDecision] = React.useState<
    | null
    | { kind: "repeat"; recurrence: EventData["recurrence"] }
    | { kind: "delete" }
  >(null);

  const [newPrivateTodoText, setNewPrivateTodoText] = useState("");
  const [newSharedTodoText, setNewSharedTodoText] = useState("");
  const [sharedNotesText, setSharedNotesText] = useState("");
  const [personalNotesText, setPersonalNotesText] = useState("");
  const [messageText, setMessageText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jamView, setJamView] = useState<"jam" | "media">("jam");
  const [libraryTab, setLibraryTab] = useState<"media" | "files" | "link">(
    "media",
  );
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

  useEventMessagesSocket(id);

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
  const alarmPresetOptions = React.useMemo(
    () =>
      resolveAlarmPresetOptions(
        profileQuery.data?.preferences?.alarmPresetOptions,
      ),
    [profileQuery.data?.preferences?.alarmPresetOptions],
  );
  const activeAlarmPreset =
    eventQuery.data?.alarmPreset ??
    (eventQuery.data?.reminder ? "preset_1" : "none");
  const [alarmModalOpen, setAlarmModalOpen] = useState(false);
  const [alarmModalView, setAlarmModalView] = useState<"list" | "custom">("list");
  const [customEditorRows, setCustomEditorRows] = useState<Array<{ id: string; amount: string; unit: AlarmOffsetUnit }>>([]);
  const [customEditorError, setCustomEditorError] = useState("");
  const customEditorRowIdRef = React.useRef(0);
  const [repeatModalOpen, setRepeatModalOpen] = useState(false);

  const createCustomEditorRow = React.useCallback((offset?: number | null) => {
    customEditorRowIdRef.current += 1;
    const { amount, unit } = offsetToEditorValue(offset);
    return { id: `custom-row-${customEditorRowIdRef.current}`, amount, unit };
  }, []);

  const openCustomAlarmEditor = React.useCallback(() => {
    const existingOffsets = eventQuery.data?.customAlarmOffsets;
    const rows = existingOffsets?.length
      ? existingOffsets.map((o) => createCustomEditorRow(o))
      : [createCustomEditorRow()];
    setCustomEditorRows(rows);
    setCustomEditorError("");
    setAlarmModalView("custom");
  }, [createCustomEditorRow, eventQuery.data?.customAlarmOffsets]);

  const editHasDateRange = Boolean(editStartDate && editEndDate);
  const editIsSingleDayEvent = Boolean(
    editStartDate && editEndDate && editStartDate === editEndDate,
  );

  const refreshEverything = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.event(id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.eventTodos(id) });
    queryClient.invalidateQueries({ queryKey: ["events"] });
  };

  const deleteEventMutation = useMutation({
    mutationFn: (options?: Parameters<typeof eventApi.delete>[1]) =>
      eventApi.delete(id, options),
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
    onSuccess: (data) => {
      toast.success("Event updated");
      refreshEverything();
      // After "this and following" split, the new tail series has a brand-new id.
      // Navigate to it so the user is now editing the correct (post-split) event.
      const newId = (data as { _id?: string; splitFromEventId?: string })?._id;
      const splitFrom = (data as { splitFromEventId?: string })?.splitFromEventId;
      if (newId && splitFrom && newId !== id) {
        router.replace(`/events/${newId}`);
      }
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update event"),
  });

  // True when the user is viewing a recurring event from a specific occurrence
  // that is NOT the first one — only then does the scope modal make sense.
  const needsScopeDecision = React.useMemo(() => {
    if (!eventQuery.data) return false;
    if (!eventQuery.data.recurrence || eventQuery.data.recurrence === "once") return false;
    if (!occurrenceDateParam) return false;
    const occ = new Date(occurrenceDateParam).getTime();
    const start = new Date(eventQuery.data.startTime).getTime();
    return Number.isFinite(occ) && Math.abs(occ - start) > 1000;
  }, [eventQuery.data, occurrenceDateParam]);

  const applyRepeatChange = React.useCallback(
    (recurrence: EventData["recurrence"], scope: "all" | "this_and_following") => {
      const payload: Parameters<typeof eventApi.update>[1] = { recurrence };
      if (scope === "this_and_following" && occurrenceDateParam) {
        payload.editScope = "this_and_following";
        payload.occurrenceDate = occurrenceDateParam;
      }
      updateEventMutation.mutate(payload);
    },
    [occurrenceDateParam, updateEventMutation],
  );

  const applyDelete = React.useCallback(
    (scope: "all" | "this_and_following") => {
      const options: Parameters<typeof eventApi.delete>[1] = {};
      if (scope === "this_and_following" && occurrenceDateParam) {
        options.editScope = "this_and_following";
        options.occurrenceDate = occurrenceDateParam;
      }
      deleteEventMutation.mutate(options, {
        onSuccess: () => {
          setDeleteDialogOpen(false);
        },
      });
    },
    [occurrenceDateParam, deleteEventMutation],
  );
  const handleCustomAlarmSave = React.useCallback(() => {
    const nextOffsets = Array.from(
      new Set(
        customEditorRows
          .map((row) => editorValueToOffset(row.amount, row.unit))
          .filter((o): o is number => o !== null),
      ),
    ).sort((a, b) => a - b);

    if (!nextOffsets.length) {
      setCustomEditorError("Add at least one valid reminder time.");
      return;
    }

    updateEventMutation.mutate({ alarmPreset: "custom", customAlarmOffsets: nextOffsets });
    setAlarmModalView("list");
  }, [customEditorRows, updateEventMutation]);

  const saveSharedNotesMutation = useMutation({
    mutationFn: (payload: { notes: string }) =>
      eventApi.updateNotes(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.event(id) });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to save shared notes"),
  });

  const savePersonalNotesMutation = useMutation({
    mutationFn: (payload: { notes: string }) =>
      eventApi.updatePersonalNotes(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.event(id) });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to save notes"),
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
    onSuccess: refreshEverything,
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
        messageType = isMediaFile(selectedFile) ? "media" : "file";
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

  const reorderTodosMutation = useMutation({
    mutationFn: async (todoIds: string[]) => {
      await Promise.all(
        todoIds.map((todoId, index) =>
          eventTodoApi.update(todoId, { sortOrder: index }),
        ),
      );
    },
    onSuccess: refreshEverything,
    onError: (error: Error) =>
      toast.error(error.message || "Failed to reorder todos"),
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
  const isCollaborativeEvent = currentParticipantIds.size > 1;

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
    setSharedNotesText(event?.notes || "");
  }, [event?.notes, event?._id]);

  React.useEffect(() => {
    setPersonalNotesText(event?.personalNotes || "");
  }, [event?.personalNotes, event?._id]);

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

  const privateTodos = (eventTodosQuery.data || []).filter(
    (todo) => !todo.isShared,
  );
  const sharedTodos = (eventTodosQuery.data || []).filter(
    (todo) => todo.isShared,
  );
  const messages = messagesQuery.data || [];
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
  const linkMessages = messages.filter((message) => isLinkMessage(message));
  const jamPreviewMessages = messages.slice(-2);
  const eventBrickId = event.brick?._id;
  const fullBrick = eventBrickId
    ? bricks.find((brick) => brick._id === eventBrickId)
    : undefined;
  const brickCollaboratorIds = new Set<string>([
    ...(fullBrick?.createdBy ? [fullBrick.createdBy] : []),
    ...(fullBrick?.participants || []),
    ...(fullBrick?.members || []),
    ...((fullBrick?.participantUsers || []).map((user) => user._id)),
  ]);
  const allUsersRaw = usersQuery.data?.users || [];
  const collaboratorUsersFromBrick: UserProfile[] = (
    fullBrick?.participantUsers || []
  ).map((user) => {
    const matched = allUsersRaw.find((candidate) => candidate._id === user._id);
    if (matched) {
      return matched;
    }
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
    } as UserProfile;
  });
  const allUsers = eventBrickId
    ? collaboratorUsersFromBrick.length
      ? collaboratorUsersFromBrick
      : allUsersRaw.filter((user) => brickCollaboratorIds.has(user._id))
    : [];
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

  const flushSharedNotesSave = async (): Promise<void> => {
    if (!event || sharedNotesText === (event.notes || "")) {
      return;
    }

    await saveSharedNotesMutation.mutateAsync({ notes: sharedNotesText });
  };

  const flushPersonalNotesSave = async (): Promise<void> => {
    if (
      !isCollaborativeEvent ||
      !event ||
      personalNotesText === (event.personalNotes || "")
    ) {
      return;
    }

    await savePersonalNotesMutation.mutateAsync({ notes: personalNotesText });
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
        <DialogContent className="max-w-sm rounded-[22px] space-y-4">
          <DialogHeader>
            <DialogTitle className="font-poppins !text-[28px] leading-7! font-semibold! text-(--text-strong)">
              Delete this event?
            </DialogTitle>
          </DialogHeader>
          <p className="font-poppins !text-[24px] leading-5 text-(--text-muted) text-center">
            This action cannot be undone.
          </p>
          <DialogFooter className="gap-2 sm:justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteEventMutation.isPending}
              className="!text-[24px]"
            >
              No
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (needsScopeDecision) {
                  setDeleteDialogOpen(false);
                  setScopeDecision({ kind: "delete" });
                  return;
                }
                applyDelete("all");
              }}
              className="!text-[24px]"
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
            <EventDateTimeRangeField
              startDate={editStartDate}
              endDate={editEndDate}
              startTime={editStartTime}
              endTime={editEndTime}
              use24Hour={preferences.use24Hour}
              isAllDay={editIsAllDay}
              collapseSingleTimeValue={editIsSingleDayEvent}
              onDateClick={() => setEditDatePopupOpen(true)}
              onTimeClick={() => setEditTimePopupOpen(true)}
              timeDisabled={!editHasDateRange}
              allDayToggle={
                <AllDayTabToggle
                  active={editIsAllDay}
                  onToggle={() => {
                    const next = !editIsAllDay;
                    setEditIsAllDay(next);
                    if (next) {
                      setEditTimePopupOpen(false);
                    }
                  }}
                />
              }
            />
            <EventBrickSelector
              bricks={bricks}
              selectedBrickId={editBrickId}
              onSelectBrick={setEditBrickId}
              badgeClassName="!text-[22px]"
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
        displayDate={editStartDate || undefined}
        displayEndDate={editEndDate || undefined}
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
          onOpenAlarmModal={() => setAlarmModalOpen(true)}
          onOpenRepeatModal={() => setRepeatModalOpen(true)}
          onCardClick={() => router.push(`/events/${id}/messages`)}
        />

        <div className="mt-3 space-y-3">
          <div className="">
            <div className="overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface-2)] ">
              <TodoSection
                todos={privateTodos}
                title="New todo"
                inputValue={newPrivateTodoText}
                onInputChange={setNewPrivateTodoText}
                onAdd={() =>
                  addTodoMutation.mutateAsync({ text: newPrivateTodoText })
                }
                onToggle={(todo) =>
                  updateTodoMutation.mutate({
                    todoId: todo._id,
                    payload: { isCompleted: !todo.isCompleted },
                  })
                }
                onSaveText={(todoId, text) =>
                  updateTodoMutation.mutateAsync({
                    todoId,
                    payload: { text },
                  })
                }
                onDelete={(todoId) => deleteTodoMutation.mutate(todoId)}
                onReorder={(todoIds) =>
                  reorderTodosMutation.mutateAsync(todoIds)
                }
                checkedColor={event.brick?.color || NO_BRICK_EVENT_COLOR}
                bare
              />
              <div className="mx-4 border-t border-[var(--border)]" />

              <EventNotesPanel
                value={
                  isCollaborativeEvent ? personalNotesText : sharedNotesText
                }
                onChange={
                  isCollaborativeEvent
                    ? setPersonalNotesText
                    : setSharedNotesText
                }
                onAutoSave={
                  isCollaborativeEvent
                    ? flushPersonalNotesSave
                    : flushSharedNotesSave
                }
                placeholder="New notes"
                minHeightClassName="min-h-[50px]"
                bare
              />
            </div>
          </div>

          {isCollaborativeEvent ? (
            <div className="">
              <div className="overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface-2)]">
                <TodoSection
                  todos={sharedTodos}
                  title="New shared todo"
                  inputValue={newSharedTodoText}
                  onInputChange={setNewSharedTodoText}
                  onAdd={() =>
                    addTodoMutation.mutateAsync({
                      text: newSharedTodoText,
                      isShared: true,
                    })
                  }
                  onToggle={(todo) =>
                    updateTodoMutation.mutate({
                      todoId: todo._id,
                      payload: { isCompleted: !todo.isCompleted },
                    })
                  }
                  onSaveText={(todoId, text) =>
                    updateTodoMutation.mutateAsync({
                      todoId,
                      payload: { text },
                    })
                  }
                  onDelete={(todoId) => deleteTodoMutation.mutate(todoId)}
                  onReorder={(todoIds) =>
                    reorderTodosMutation.mutateAsync(todoIds)
                  }
                  checkedColor={event.brick?.color || NO_BRICK_EVENT_COLOR}
                  bare
                />
                <div className="mx-4 border-t border-[var(--border)]" />

                <EventNotesPanel
                  value={sharedNotesText}
                  onChange={setSharedNotesText}
                  onAutoSave={flushSharedNotesSave}
                  placeholder="New shared notes"
                  minHeightClassName="min-h-[50px]"
                  bare
                />
              </div>
            </div>
          ) : null}

          <Card className="rounded-[22px] border border-[var(--border)] bg-[var(--surface-2)] p-3.5 shadow-none">
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
                onOpenLibrary={() => router.push(`/events/${id}/gallery`)}
              />
            )}
          </Card>
        </div>
      </section>

      <Dialog
        open={alarmModalOpen}
        onOpenChange={(open) => {
          setAlarmModalOpen(open);
          if (!open) {
            setAlarmModalView("list");
            setCustomEditorRows([]);
            setCustomEditorError("");
          }
        }}
      >
        <DialogContent className="max-w-[380px] rounded-[26px] border-[var(--ui-popover-border)] bg-[var(--ui-popover-bg)] p-4 text-[var(--text-default)]">
          {alarmModalView === "list" ? (
            <div className="space-y-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 text-[var(--text-default)]"
                onClick={() => setAlarmModalOpen(false)}
              >
                <ChevronLeft className="size-4" />
                <span className="text-[24px] leading-[120%]">Select Alarm</span>
              </button>

              <div className="space-y-2 rounded-[22px] bg-[var(--surface-2)] p-3">
                {alarmPresetOptions.map((option) => {
                  const active = activeAlarmPreset === option.key;

                  if (option.key === "custom") {
                    const customOffsets = eventQuery.data?.customAlarmOffsets || [];
                    const customSummary = formatOffsetsSummary(customOffsets);
                    return (
                      <button
                        key="custom"
                        type="button"
                        onClick={openCustomAlarmEditor}
                        className={cn(
                          "flex w-full items-start justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition",
                          active
                            ? "border-[#31C65B] bg-[color:rgba(49,198,91,0.10)]"
                            : "border-transparent bg-[var(--surface-2)] hover:border-[var(--border)]",
                        )}
                      >
                        <div className="min-w-0">
                          <span className="font-poppins text-[20px] leading-[120%] font-medium text-[var(--text-default)]">
                            {option.label}
                          </span>
                          <p className="mt-1 text-[12px] leading-[140%] text-[var(--text-muted)]">
                            Build your own reminder schedule for this event.
                          </p>
                          <p className="mt-2 text-[12px] font-medium text-[var(--text-default)]">
                            {customSummary}
                          </p>
                        </div>
                        {active ? (
                          <CheckCircle2 className="size-5 shrink-0 text-[#31C65B]" />
                        ) : null}
                      </button>
                    );
                  }

                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => {
                        updateEventMutation.mutate({ alarmPreset: option.key });
                      }}
                      className={cn(
                        "flex w-full items-start justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition",
                        active
                          ? "border-[#31C65B] bg-[color:rgba(49,198,91,0.10)]"
                          : "border-transparent bg-[var(--surface-2)] hover:border-[var(--border)]",
                      )}
                    >
                      <div className="min-w-0">
                        <span className="font-poppins text-[20px] leading-[120%] font-medium text-[var(--text-default)]">
                          {option.label}
                        </span>
                        <p className="mt-1 text-[12px] leading-[140%] text-[var(--text-muted)]">
                          {option.description}
                        </p>
                        <p className="mt-2 text-[12px] font-medium text-[var(--text-default)]">
                          {formatAlarmPresetSummary(option.key, alarmPresetOptions)}
                        </p>
                      </div>
                      {active ? (
                        <CheckCircle2 className="size-5 shrink-0 text-[#31C65B]" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 text-[var(--text-default)]"
                onClick={() => { setAlarmModalView("list"); setCustomEditorError(""); }}
              >
                <ChevronLeft className="size-4" />
                <span className="text-[24px] leading-[120%]">Custom settings</span>
              </button>

              <div className="rounded-[22px] bg-[var(--surface-2)] p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-medium tracking-[0.02em] text-[var(--text-muted)] uppercase">
                    Reminder timing
                  </p>
                  <button
                    type="button"
                    onClick={() => setCustomEditorRows((rows) => [...rows, createCustomEditorRow()])}
                    className="inline-flex items-center gap-1 h-8 rounded-full border border-[var(--border)] bg-[var(--surface-1)] px-3 text-[12px] font-medium text-[var(--text-default)] hover:bg-[var(--surface-3)]"
                  >
                    <Plus className="size-3" />
                    Add reminder
                  </button>
                </div>

                <div className="space-y-2">
                  {customEditorRows.map((row) => (
                    <div key={row.id} className="flex items-center gap-2">
                      <Input
                        value={row.amount}
                        onChange={(e) => setCustomEditorRows((rows) => rows.map((r) => r.id === row.id ? { ...r, amount: e.target.value } : r))}
                        inputMode="numeric"
                        className="h-10 rounded-xl border border-[var(--ui-input-border)] bg-[var(--ui-input-bg)] !text-[16px] text-[var(--ui-input-text)]"
                      />
                      <select
                        value={row.unit}
                        onChange={(e) => setCustomEditorRows((rows) => rows.map((r) => r.id === row.id ? { ...r, unit: e.target.value as AlarmOffsetUnit } : r))}
                        className="h-10 rounded-xl border border-[var(--ui-input-border)] bg-[var(--ui-input-bg)] px-2 text-[14px] text-[var(--ui-input-text)]"
                      >
                        <option value="minutes">Minutes</option>
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                        <option value="weeks">Weeks</option>
                        <option value="months">Months</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setCustomEditorRows((rows) => rows.length > 1 ? rows.filter((r) => r.id !== row.id) : rows)}
                        disabled={customEditorRows.length === 1}
                        className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#F2C7CB] bg-[#FFF1F2] text-[#DB5562] hover:bg-[#FFE5E8] disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:bg-[var(--surface-2)] disabled:text-[var(--text-muted)]"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {(() => {
                  const preview = Array.from(
                    new Set(
                      customEditorRows
                        .map((r) => editorValueToOffset(r.amount, r.unit))
                        .filter((o): o is number => o !== null),
                    ),
                  ).sort((a, b) => a - b);
                  return preview.length ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {preview.map((offset) => (
                        <span key={offset} className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-1)] px-2.5 py-1 text-[12px] font-medium text-[var(--text-default)]">
                          <Clock3 className="size-3 text-[var(--text-muted)]" />
                          {formatAlarmOffset(offset)}
                        </span>
                      ))}
                    </div>
                  ) : null;
                })()}

                {customEditorError ? (
                  <p className="text-[12px] text-[#B14E4E]">{customEditorError}</p>
                ) : null}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full px-4 text-[14px]"
                  onClick={() => { setAlarmModalView("list"); setCustomEditorError(""); }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="rounded-full px-4 text-[14px]"
                  onClick={handleCustomAlarmSave}
                  disabled={updateEventMutation.isPending}
                >
                  Save
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={repeatModalOpen} onOpenChange={setRepeatModalOpen}>
        <DialogContent className="max-w-[380px] rounded-[26px] border-[var(--ui-popover-border)] bg-[var(--ui-popover-bg)] p-4 text-[var(--text-default)]">
          <div className="space-y-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 text-[var(--text-default)]"
              onClick={() => setRepeatModalOpen(false)}
            >
              <ChevronLeft className="size-4" />
              <span className="text-[24px] leading-[120%]">Repeat</span>
            </button>

            <div className="space-y-2 rounded-[22px] bg-[var(--surface-2)] p-3">
              {(
                [
                  { value: "once", label: "Does not repeat" },
                  { value: "daily", label: "Daily" },
                  { value: "weekly", label: "Weekly" },
                  { value: "monthly", label: "Monthly" },
                  { value: "yearly", label: "Yearly" },
                ] as const
              ).map((option) => {
                const active = event.recurrence === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      // If editing a recurring event from a non-first occurrence,
                      // ask the user whether the change applies to "this and following"
                      // or "all events". Otherwise apply directly to the whole series.
                      if (needsScopeDecision && option.value !== event.recurrence) {
                        setRepeatModalOpen(false);
                        setScopeDecision({ kind: "repeat", recurrence: option.value });
                        return;
                      }
                      applyRepeatChange(option.value, "all");
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition",
                      active
                        ? "border-[#31C65B] bg-[color:rgba(49,198,91,0.10)]"
                        : "border-transparent bg-[var(--surface-2)] hover:border-[var(--border)]",
                    )}
                  >
                    <span className="font-poppins text-[18px] leading-[120%] font-medium text-[var(--text-default)]">
                      {option.label}
                    </span>
                    {active ? (
                      <CheckCircle2 className="size-5 text-[#31C65B]" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Google Calendar-style "This and following / All events" scope modal.
          Shown only when editing or deleting a recurring event from a specific
          occurrence that is NOT the first occurrence of the series. */}
      <Dialog
        open={scopeDecision !== null}
        onOpenChange={(open) => {
          if (!open) setScopeDecision(null);
        }}
      >
        <DialogContent className="max-w-[360px] rounded-[18px] p-5 space-y-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="!text-[28px] font-medium text-[var(--text-strong)]">
              {scopeDecision?.kind === "delete"
                ? "Delete recurring event"
                : "Change recurring event"}
            </DialogTitle>
            <p className="text-sm text-[var(--text-muted)]">
              {scopeDecision?.kind === "delete"
                ? "Apply this deletion to:"
                : "Apply this change to:"}
            </p>
          </DialogHeader>

          <div className="space-y-2">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-xl border px-3 py-3 text-left text-[15px] hover:bg-[var(--surface-2)]"
              onClick={() => {
                const decision = scopeDecision;
                setScopeDecision(null);
                if (decision?.kind === "repeat") {
                  applyRepeatChange(decision.recurrence, "this_and_following");
                } else if (decision?.kind === "delete") {
                  applyDelete("this_and_following");
                }
              }}
            >
              This and following events
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-xl border px-3 py-3 text-left text-[15px] hover:bg-[var(--surface-2)]"
              onClick={() => {
                const decision = scopeDecision;
                setScopeDecision(null);
                if (decision?.kind === "repeat") {
                  applyRepeatChange(decision.recurrence, "all");
                } else if (decision?.kind === "delete") {
                  applyDelete("all");
                }
              }}
            >
              All events
            </button>
          </div>

          <DialogFooter className="sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setScopeDecision(null)}
              className="!text-[24px]"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
