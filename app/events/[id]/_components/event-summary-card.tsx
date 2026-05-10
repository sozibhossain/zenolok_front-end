"use client";

import {
  ArrowUpDown,
  Bell,
  CalendarDays,
  Clock3,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { format, isSameDay } from "date-fns";

import type { EventData, UserProfile } from "@/lib/api";
import { BrickIcon } from "@/components/shared/brick-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { NO_BRICK_EVENT_COLOR } from "@/lib/event-colors";
import { formatTimeByPreference } from "@/lib/time-format";
import { getParticipantDisplayName } from "./event-detail-helpers";
import { ParticipantShareDialog } from "./participant-share-dialog";

/* Date/time metadata is rendered inline via CSS Grid in the card below. */

type EventSummaryCardProps = {
  event: EventData;
  participants: UserProfile[];
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
  onOpenAlarmModal?: () => void;
  onOpenRepeatModal?: () => void;
  onCardClick?: () => void;
};

export function EventSummaryCard({
  event,
  participants,
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
  onOpenAlarmModal,
  onOpenRepeatModal,
  onCardClick,
}: EventSummaryCardProps) {
  const stopPropagation = (
    handler?: (event: React.MouseEvent<HTMLElement>) => void,
  ) => (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    handler?.(event);
  };
  const showParticipants = participants.length > 1;
  const startsAt = new Date(event.startTime);
  const endsAt = new Date(event.endTime);
  const spansMultipleDays =
    !Number.isNaN(startsAt.getTime()) &&
    !Number.isNaN(endsAt.getTime()) &&
    !isSameDay(startsAt, endsAt);
  const hasValidSchedule =
    !Number.isNaN(startsAt.getTime()) && !Number.isNaN(endsAt.getTime());
  const startDateLabel = hasValidSchedule
    ? format(startsAt, "dd MMM yyyy").toUpperCase()
    : "Invalid date";
  const endDateLabel = hasValidSchedule
    ? format(endsAt, "dd MMM yyyy").toUpperCase()
    : "";
  const startDayLabel = hasValidSchedule ? format(startsAt, "EEEE") : "";
  const endDayLabel = hasValidSchedule ? format(endsAt, "EEEE") : "";
  const startTimeLabel = event.isAllDay
    ? "All day"
    : hasValidSchedule
      ? formatTimeByPreference(startsAt, use24Hour)
      : "Invalid time";
  const endTimeLabel =
    !event.isAllDay && hasValidSchedule
      ? formatTimeByPreference(endsAt, use24Hour)
      : "";
  const hasAlarm =
    (event.alarmPreset && event.alarmPreset !== "none") ||
    Boolean(event.reminder);
  const hasRepeat = event.recurrence !== "once";

  return (
    <div
      className="event-details-card rounded-[18px] border border-[var(--border)] bg-[var(--surface-2)] p-4 sm:p-5 cursor-pointer"
      onClick={onCardClick}
      role={onCardClick ? "button" : undefined}
    >
      <div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <span
                className="mt-1 h-8 w-1.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: event.brick?.color || NO_BRICK_EVENT_COLOR,
                }}
              />
              <div className="min-w-0 space-y-3">
                <p className="truncate text-[28px] py-2 font-semibold leading-[1.05] text-[var(--text-strong)] sm:text-[32px]">
                  {event.title}
                </p>
                {event.brick ? (
                  <Badge
                    variant="blue"
                    className="rounded-full px-3 py-1 text-[13px] font-medium shadow-sm"
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

            <div className="flex items-center gap-2" onClick={stopPropagation()}>
              {showParticipants ? (
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
              ) : null}

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

          <div className="space-y-3">
            <div className="flex min-w-0 items-start justify-between gap-4">
              {spansMultipleDays ? (
                /* Multi-day: grid with arrows between date and time */
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-start gap-x-6 gap-y-1.5">
                    <div
                      className="inline-grid items-center gap-x-3 gap-y-0.5"
                      style={{ gridTemplateColumns: "20px auto auto auto" }}
                    >
                      {/* Day labels */}
                      <span />
                      <p className="font-poppins text-[12px] leading-none font-medium text-[var(--text-muted)]">
                        {startDayLabel}
                      </p>
                      <span />
                      <p className="font-poppins text-[12px] leading-none font-medium text-[var(--text-muted)]">
                        {endDayLabel}
                      </p>
                      {/* Dates */}
                      <CalendarDays className="size-5 text-[var(--text-muted)]" />
                      <span className="font-poppins text-[16px] font-semibold leading-[120%] text-[var(--text-default)]">
                        {startDateLabel}
                      </span>
                      <span className="justify-self-center text-[16px] leading-none text-[var(--text-muted)]">
                        —
                      </span>
                      <span className="font-poppins text-[16px] font-semibold leading-[120%] text-[var(--text-default)]">
                        {endDateLabel}
                      </span>
                      {/* Arrows */}
                      <span />
                      <ArrowUpDown className="mx-auto size-3 text-[var(--text-muted)]" />
                      <span />
                      <ArrowUpDown className="mx-auto size-3 text-[var(--text-muted)]" />
                      {/* Times */}
                      <Clock3 className="size-5 text-[var(--text-muted)]" />
                      <span className="font-poppins text-[16px] font-semibold leading-none text-[var(--text-default)]">
                        {startTimeLabel}
                      </span>
                      <span />
                      <span className="font-poppins text-[16px] font-semibold leading-none text-[var(--text-default)]">
                        {endTimeLabel || ""}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Single-day / All-day: simple rows, no arrows */
                <div className="min-w-0 space-y-1">
                  <div className="flex min-w-0 flex-wrap items-start gap-x-6 gap-y-1.5">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-3">
                        <CalendarDays className="size-5 shrink-0 text-[var(--text-muted)]" />
                        {startDayLabel ? (
                          <div>
                            <p className="font-poppins text-[12px] leading-none font-medium text-[var(--text-muted)]">
                              {startDayLabel}
                            </p>
                            <p className="mt-0.5 font-poppins text-[16px] font-semibold leading-[120%] text-[var(--text-default)]">
                              {startDateLabel}
                            </p>
                          </div>
                        ) : (
                          <span className="font-poppins text-[16px] font-semibold leading-[120%] text-[var(--text-default)]">
                            {startDateLabel}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <Clock3 className="size-5 shrink-0 text-[var(--text-muted)]" />
                        <span className="font-poppins text-[16px] font-semibold leading-none text-[var(--text-default)]">
                          {startTimeLabel}
                        </span>
                        {!event.isAllDay && endTimeLabel ? (
                          <>
                            <span className="text-[16px] leading-none text-[var(--text-muted)]">
                              —
                            </span>
                            <span className="font-poppins text-[16px] font-semibold leading-none text-[var(--text-default)]">
                              {endTimeLabel}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={stopPropagation(() => onOpenAlarmModal?.())}
                  className={`flex size-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-1)] transition hover:bg-[var(--surface-3)] ${
                    hasAlarm
                      ? "text-[var(--text-default)]"
                      : "text-[var(--text-muted)] opacity-60"
                  }`}
                  aria-label="Set alarm"
                >
                  <Bell className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={stopPropagation(() => onOpenRepeatModal?.())}
                  className={`flex size-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-1)] transition hover:bg-[var(--surface-3)] ${
                    hasRepeat
                      ? "text-[var(--text-default)]"
                      : "text-[var(--text-muted)] opacity-60"
                  }`}
                  aria-label="Set repeat"
                >
                  <RefreshCw className="size-4" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2 text-[14px] text-[var(--text-default)]">
            <MapPin className="size-5 shrink-0 text-[var(--text-muted)]" />
            <span className="truncate font-poppins">
              {event.location || "No location"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
