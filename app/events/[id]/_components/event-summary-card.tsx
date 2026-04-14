"use client";

import { Bell, Clock3, Locate } from "lucide-react";

import type { EventData, UserProfile } from "@/lib/api";
import { BrickIcon } from "@/components/shared/brick-icon";
import { EventRangeField } from "@/components/shared/event-range-field";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getParticipantDisplayName } from "./event-detail-helpers";
import { ParticipantShareDialog } from "./participant-share-dialog";

type EventSummaryCardProps = {
  event: EventData;
  participants: UserProfile[];
  eventStartDateValue: string;
  eventEndDateValue: string;
  eventStartTimeValue: string;
  eventEndTimeValue: string;
  use24Hour: boolean;
  shareDialogOpen: boolean;
  onShareDialogOpenChange: (open: boolean) => void;
  isEventOwner: boolean;
  allUsers: UserProfile[];
  selectedShareUserIds: string[];
  currentParticipantIds: ReadonlySet<string>;
  onToggleShareUser: (userId: string, checked: boolean) => void;
  onSaveParticipants: () => void;
  isUsersLoading: boolean;
  isUsersError: boolean;
  isParticipantsSaving: boolean;
};

export function EventSummaryCard({
  event,
  participants,
  eventStartDateValue,
  eventEndDateValue,
  eventStartTimeValue,
  eventEndTimeValue,
  use24Hour,
  shareDialogOpen,
  onShareDialogOpenChange,
  isEventOwner,
  allUsers,
  selectedShareUserIds,
  currentParticipantIds,
  onToggleShareUser,
  onSaveParticipants,
  isUsersLoading,
  isUsersError,
  isParticipantsSaving,
}: EventSummaryCardProps) {
  return (
    <div className="event-details-card rounded-[18px] border border-[var(--border)] bg-[var(--surface-2)] p-4 sm:p-5">
      <div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <span
                className="mt-1 h-10 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: event.brick?.color || "#F7C700" }}
              />
              <div className="min-w-0 space-y-3">
                <p className="truncate text-[28px] font-semibold leading-[1.05] text-[var(--text-strong)] sm:text-[32px]">
                  {event.title}
                </p>
                {event.brick ? (
                  <Badge
                    variant="blue"
                    className="rounded-full px-3 py-1.5 text-[13px] font-medium shadow-sm"
                    style={{ backgroundColor: event.brick.color }}
                  >
                    <BrickIcon
                      name={event.brick.icon}
                      className="mr-1 size-3.5"
                    />
                    {event.brick.name}
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center">
                {participants.slice(0, 4).map((participant, index) => (
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
                {participants.length > 4 ? (
                  <span className="-ml-2.5 inline-flex h-8 min-w-8 items-center justify-center rounded-full border-2 border-[var(--border)] bg-[var(--surface-1)] px-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                    +{participants.length - 4}
                  </span>
                ) : null}
              </div>

              <ParticipantShareDialog
                open={shareDialogOpen}
                onOpenChange={onShareDialogOpenChange}
                isEventOwner={isEventOwner}
                allUsers={allUsers}
                selectedUserIds={selectedShareUserIds}
                currentParticipantIds={currentParticipantIds}
                onToggleUser={onToggleShareUser}
                onSave={onSaveParticipants}
                isLoading={isUsersLoading}
                isError={isUsersError}
                isSaving={isParticipantsSaving}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div>
                <EventRangeField
                  kind="date"
                  startValue={eventStartDateValue}
                  endValue={eventEndDateValue}
                  interactive={false}
                  className="w-full"
                />
              </div>

              <div className="">
                {event.isAllDay ? (
                  <p className="flex min-h-[58px] items-center gap-2 px-2 py-1 text-[14px] font-medium text-[var(--text-default)]">
                    <Clock3 className="size-4 text-[var(--text-muted)]" />
                    All day
                  </p>
                ) : (
                  <EventRangeField
                    kind="time"
                    startValue={eventStartTimeValue}
                    endValue={eventEndTimeValue}
                    use24Hour={use24Hour}
                    collapseSingleValue={
                      eventStartDateValue === eventEndDateValue
                    }
                    interactive={false}
                    className="w-full"
                  />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:min-w-[220px] xl:flex-col xl:items-end xl:justify-start">
                <div className="flex items-center gap-2 xl:justify-end">
                  <button
                    type="button"
                    className="flex size-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-muted)] transition hover:bg-[var(--surface-3)]"
                    aria-label="Notification"
                  >
                    <Bell className="size-4" />
                  </button>
                </div>
              </div>
              <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface-1)] px-3 py-3">
                <p className="flex items-center gap-2 text-[14px] text-[var(--text-default)]">
                  <Locate className="size-4 shrink-0 text-[var(--text-muted)]" />
                  <span className="truncate">
                    {event.location || "No location"}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
