"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { useAppState } from "@/components/providers/app-state-provider";
import {
  eventApi,
  jamApi,
  userApi,
  type EventData,
  type UserProfile,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NO_BRICK_EVENT_COLOR } from "@/lib/event-colors";
import { EventLibraryPanel } from "../_components/event-library-panel";
import { ParticipantShareDialog } from "../_components/participant-share-dialog";
import {
  getParticipantDisplayName,
  isLinkMessage,
} from "../_components/event-detail-helpers";

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

export default function EventGalleryPage() {
  const { preferences } = useAppState();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id;

  const [libraryTab, setLibraryTab] = React.useState<"media" | "files" | "link">(
    "media",
  );
  const [shareDialogOpen, setShareDialogOpen] = React.useState(false);
  const [selectedShareUserIds, setSelectedShareUserIds] = React.useState<
    string[]
  >([]);

  const profileQuery = useQuery({
    queryKey: queryKeys.profile,
    queryFn: userApi.getProfile,
  });

  const eventQuery = useQuery({
    queryKey: queryKeys.event(id),
    queryFn: () => eventApi.getById(id),
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

  const event = eventQuery.data;

  const currentParticipantIds = React.useMemo(() => {
    if (!event) {
      return new Set<string>();
    }
    return new Set(mapParticipantIds(event.participants));
  }, [event]);

  React.useEffect(() => {
    if (!shareDialogOpen || !event) {
      return;
    }
    setSelectedShareUserIds(mapParticipantIds(event.participants));
  }, [shareDialogOpen, event]);

  const updateEventMutation = useMutation({
    mutationFn: (payload: Partial<EventData>) =>
      eventApi.update(id, payload as Parameters<typeof eventApi.update>[1]),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.event(id), updated);
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update event");
    },
  });

  const viewerId = profileQuery.data?._id;
  const isEventOwner = Boolean(
    viewerId && event && viewerId === event.createdBy,
  );

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
    const currentList = Array.from(currentParticipantIds);
    const hasChanges =
      nextParticipantIds.length !== currentList.length ||
      nextParticipantIds.some(
        (participantId) => !currentParticipantIds.has(participantId),
      );

    if (!hasChanges) {
      toast.info("No participant changes");
      return;
    }

    updateEventMutation.mutate(
      { participants: nextParticipantIds } as Partial<EventData>,
      {
        onSuccess: () => {
          setShareDialogOpen(false);
        },
      },
    );
  };

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
  const participants = event ? mapParticipants(event.participants) : [];
  const allUsers = usersQuery.data?.users || [];

  const accentColor = event?.brick?.color || NO_BRICK_EVENT_COLOR;
  const showParticipants = participants.length > 1;

  return (
    <div className="event-gallery-page space-y-4">
      <div className="flex items-center justify-between pt-1">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full p-1 text-[var(--text-muted)] transition hover:bg-[var(--surface-3)]"
            aria-label="Go back"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-6 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
            <p className="truncate font-poppins text-[20px] font-semibold leading-none text-[var(--text-strong)]">
              {event?.title ?? "Gallery"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showParticipants ? (
            <div className="flex items-center">
              {participants.slice(0, 3).map((participant, index) => (
                <Avatar
                  key={participant._id}
                  className={`size-8 border-2 border-[var(--border)] ${
                    index === 0 ? "" : "-ml-2.5"
                  }`}
                >
                  <AvatarImage src={participant.avatar?.url} />
                  <AvatarFallback className="bg-[var(--surface-1)] text-[12px] text-[var(--text-muted)]">
                    {getParticipantDisplayName(participant).slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
          ) : null}
          <ParticipantShareDialog
            open={shareDialogOpen}
            onOpenChange={setShareDialogOpen}
            isEventOwner={isEventOwner}
            allUsers={allUsers}
            selectedUserIds={selectedShareUserIds}
            currentParticipantIds={currentParticipantIds}
            onToggleUser={toggleShareUser}
            onSave={handleShareWithSelectedUsers}
            isLoading={usersQuery.isLoading}
            isError={usersQuery.isError}
            isSaving={updateEventMutation.isPending}
          />
        </div>
      </div>

      <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
        <EventLibraryPanel
          libraryTab={libraryTab}
          onLibraryTabChange={setLibraryTab}
          mediaMessages={mediaMessages}
          fileMessages={fileMessages}
          linkMessages={linkMessages}
          use24Hour={preferences.use24Hour}
          onBackToJam={() => router.push(`/events/${id}`)}
        />
      </div>
    </div>
  );
}
