"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ImagePlus, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { useAppState } from "@/components/providers/app-state-provider";
import {
  eventApi,
  jamApi,
  notificationApi,
  userApi,
  type EventData,
  type JamMessage,
} from "@/lib/api";
import { useEventMessagesSocket } from "@/hooks/use-event-messages-socket";
import { appendMessageIfMissing, upsertMessage } from "@/lib/jam-messages";
import { queryKeys } from "@/lib/query-keys";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionLoading } from "@/components/shared/section-loading";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import {
  formatMessageStamp,
  getMessageAttachmentKind,
  getMessageAvatarUrl,
  isLinkMessage,
} from "../_components/event-detail-helpers";
import { JamMessageContent } from "../_components/jam-message-content";
import { MessageComposer } from "../_components/message-composer";

type MessageFilter = "all" | "media" | "files" | "link";

function mapParticipants(participants: EventData["participants"]) {
  const mapped = participants
    .map((participant) => (typeof participant === "string" ? null : participant))
    .filter((participant): participant is NonNullable<typeof participant> => Boolean(participant));

  const seen = new Set<string>();
  return mapped.filter((participant) => {
    if (seen.has(participant._id)) {
      return false;
    }
    seen.add(participant._id);
    return true;
  });
}

function getParticipantDisplayName(participant: { name?: string; username?: string; email?: string }) {
  return participant.name || participant.username || participant.email || "User";
}

function isLinkText(value: string) {
  return /^https?:\/\/\S+$/i.test(value.trim());
}

function isMediaFile(file: File) {
  if (
    file.type.startsWith("image/") ||
    file.type.startsWith("video/")
  ) {
    return true;
  }

  return /\.(avif|bmp|gif|heic|heif|jpe?g|m4v|mov|mp4|mkv|png|svg|webm|webp)$/i.test(
    file.name,
  );
}

export default function EventMessagesPage() {
  const { preferences } = useAppState();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id;

  const [messageText, setMessageText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [activeFilter, setActiveFilter] = useState<MessageFilter>("all");
  const hasMarkedMessageNotificationsReadRef = React.useRef(false);

  useEventMessagesSocket(id);

  React.useEffect(() => {
    hasMarkedMessageNotificationsReadRef.current = false;
  }, [id]);

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

  const markEventMessagesReadMutation = useMutation({
    mutationFn: () => notificationApi.markEventMessagesRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
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
    onError: (error: Error) => toast.error(error.message || "Failed to send message"),
  });

  const updateMessageMutation = useMutation({
    mutationFn: ({
      messageId,
      text,
    }: {
      messageId: string;
      text: string;
    }) => jamApi.update(messageId, { text }),
    onSuccess: (message) => {
      setEditingMessageId(null);
      setEditingText("");
      queryClient.setQueryData<JamMessage[]>(
        queryKeys.jamMessages(id),
        (previous = []) => upsertMessage(previous, message),
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update message");
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (messageId: string) => jamApi.delete(messageId),
    onSuccess: (_data, messageId) => {
      if (editingMessageId === messageId) {
        setEditingMessageId(null);
        setEditingText("");
      }

      queryClient.setQueryData<JamMessage[]>(
        queryKeys.jamMessages(id),
        (previous = []) =>
          previous.filter((message) => message._id !== messageId),
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete message");
    },
  });

  const event = eventQuery.data;
  const messages = useMemo(
    () => messagesQuery.data || [],
    [messagesQuery.data],
  );
  const participants = useMemo(() => mapParticipants(event?.participants || []), [event?.participants]);
  const viewerId = profileQuery.data?._id;
  const filteredMessages = useMemo(() => {
    if (activeFilter === "all") {
      return messages;
    }

    return messages.filter((message) => {
      const attachmentKind = getMessageAttachmentKind(message);

      if (activeFilter === "media") {
        return attachmentKind === "image" || attachmentKind === "video";
      }

      if (activeFilter === "files") {
        return attachmentKind === "file";
      }

      return isLinkMessage(message);
    });
  }, [activeFilter, messages]);

  const handleStartEditing = (message: JamMessage) => {
    if (getMessageAttachmentKind(message) === "image") {
      return;
    }

    setEditingMessageId(message._id);
    setEditingText(message.text || "");
  };

  const handleCancelEditing = () => {
    setEditingMessageId(null);
    setEditingText("");
  };

  const handleSaveMessage = (message: JamMessage) => {
    const nextText = editingText.trim();
    const currentText = (message.text || "").trim();

    if (!nextText && !message.mediaUrl) {
      toast.error("Message text is required");
      return;
    }

    if (nextText === currentText) {
      handleCancelEditing();
      return;
    }

    updateMessageMutation.mutate({
      messageId: message._id,
      text: editingText,
    });
  };

  const handleDeleteMessage = (messageId: string) => {
    if (deleteMessageMutation.isPending) {
      return;
    }

    toast("Delete this message?", {
      description: "This will remove it from the event chat.",
      action: {
        label: "Delete",
        onClick: () => deleteMessageMutation.mutate(messageId),
      },
      cancel: {
        label: "Cancel",
        onClick: () => undefined,
      },
      duration: 10000,
    });
  };

  React.useEffect(() => {
    if (!id || !event || hasMarkedMessageNotificationsReadRef.current) {
      return;
    }

    hasMarkedMessageNotificationsReadRef.current = true;
    markEventMessagesReadMutation.mutate();
  }, [event, id, markEventMessagesReadMutation]);

  React.useEffect(() => {
    setEditingMessageId(null);
    setEditingText("");
  }, [activeFilter]);

  if (eventQuery.isLoading || messagesQuery.isLoading) {
    return <SectionLoading rows={8} />;
  }

  if (!event) {
    return <EmptyState title="Event not found" description="The event was removed or you don't have access." />;
  }

  return (
    <div className="event-details-page space-y-3">
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-[20px] text-[var(--text-muted)]"
        >
          <ArrowLeft className="size-5" />
          Back
        </button>
      </div>

      <section className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-1)] p-2">
        <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="block h-6 w-1 rounded-sm bg-[var(--ui-btn-secondary-text)]" />
                <p className="truncate text-[34px] font-medium leading-tight text-[var(--text-strong)]">
                  {event.title}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center">
              {participants.slice(0, 4).map((participant, index) => (
                <Avatar
                  key={participant._id}
                  className={`size-7 border-2 border-[var(--border)] ${index === 0 ? "" : "-ml-2"}`}
                >
                  <AvatarImage src={participant.avatar?.url} />
                  <AvatarFallback>{getParticipantDisplayName(participant).slice(0, 1)}</AvatarFallback>
                </Avatar>
              ))}
            </div>
          </div>
        </div>

        <Card className="mt-3 rounded-[22px] border border-[var(--border)] bg-[var(--surface-2)] p-3.5 text-[var(--text-default)] shadow-none">
          <div className="mb-3 flex items-center justify-between text-[var(--text-muted)]">
            <button
              type="button"
              className="rounded-full p-1 transition hover:bg-[var(--surface-3)]"
              onClick={() => router.back()}
              aria-label="Back"
            >
              <ArrowLeft className="size-4" />
            </button>
            <div className="flex items-center gap-2">
              <ImagePlus className="size-3.5" />
              <div className="grid grid-cols-4 rounded-full bg-[var(--surface-3)] p-1 text-[11px]">
                {(
                  [
                    { key: "all", label: "All" },
                    { key: "media", label: "Media" },
                    { key: "files", label: "Files" },
                    { key: "link", label: "Link" },
                  ] as const
                ).map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    className={`rounded-full px-2.5 py-1 leading-none transition ${
                      activeFilter === filter.key
                        ? "bg-[var(--surface-1)] text-[var(--text-strong)]"
                        : "text-[var(--text-muted)]"
                    }`}
                    onClick={() => setActiveFilter(filter.key)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="max-h-[58vh] space-y-3 overflow-auto rounded-[22px] bg-[var(--surface-3)] p-2">
            {filteredMessages.length ? (
              filteredMessages.map((message) => {
                const rawName = (message.user.name || message.user.username || "").trim();
                const isMe = viewerId ? message.user._id === viewerId : rawName === "Me";
                const displayName = isMe ? "Me" : rawName || "User";
                const canEditMessage =
                  getMessageAttachmentKind(message) !== "image";

                return (
                  <div
                    key={message._id}
                    className={`flex items-end gap-2 ${isMe ? "justify-end" : ""}`}
                  >
                    {!isMe ? (
                      <Avatar className="size-10 border border-[var(--border)]">
                        <AvatarImage src={getMessageAvatarUrl(message)} />
                        <AvatarFallback>{displayName.slice(0, 1)}</AvatarFallback>
                      </Avatar>
                    ) : null}
                    <div className={`min-w-0 max-w-[85%] ${isMe ? "text-right" : ""}`}>
                      <div
                        className={`mb-1 flex items-center gap-1.5 ${
                          isMe ? "justify-end" : ""
                        }`}
                      >
                        {isMe ? (
                          <div className="flex items-center gap-1 text-[var(--text-muted)]">
                            {canEditMessage ? (
                              <button
                                type="button"
                                className="inline-flex size-6 items-center justify-center rounded-full transition hover:bg-[var(--surface-1)]"
                                aria-label={
                                  editingMessageId === message._id
                                    ? "Cancel editing message"
                                    : "Edit message"
                                }
                                onClick={() => {
                                  if (editingMessageId === message._id) {
                                    handleCancelEditing();
                                    return;
                                  }

                                  handleStartEditing(message);
                                }}
                                disabled={
                                  updateMessageMutation.isPending ||
                                  deleteMessageMutation.isPending
                                }
                              >
                                {editingMessageId === message._id ? (
                                  <X className="size-3.5" />
                                ) : (
                                  <Pencil className="size-3.5" />
                                )}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="inline-flex size-6 items-center justify-center rounded-full transition hover:bg-[var(--surface-1)]"
                              aria-label="Delete message"
                              onClick={() => handleDeleteMessage(message._id)}
                              disabled={
                                updateMessageMutation.isPending ||
                                deleteMessageMutation.isPending
                              }
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        ) : null}
                        <p
                          className={`text-[14px] leading-none font-medium ${
                            isMe
                              ? "text-[var(--ui-btn-secondary-text)]"
                              : "text-[var(--text-strong)]"
                          }`}
                        >
                          {displayName}
                        </p>
                      </div>
                      <div
                        className={`flex items-end gap-2 ${isMe ? "justify-end" : ""}`}
                      >
                        {isMe ? (
                          <p className="pb-0.5 text-[10px] text-[var(--text-muted)]">
                            {formatMessageStamp(message.createdAt, preferences.use24Hour)}
                          </p>
                        ) : null}
                        <JamMessageContent message={message} isMe={isMe} />
                        {!isMe ? (
                          <p className="pb-0.5 text-[10px] text-[var(--text-muted)]">
                            {formatMessageStamp(message.createdAt, preferences.use24Hour)}
                          </p>
                        ) : null}
                      </div>
                      {isMe && canEditMessage && editingMessageId === message._id ? (
                        <div className="ml-auto mt-2 w-full max-w-[320px] rounded-[18px] border border-[var(--border)] bg-[var(--surface-1)] p-2 text-left">
                          <textarea
                            value={editingText}
                            onChange={(event) => setEditingText(event.target.value)}
                            rows={4}
                            placeholder={
                              message.mediaUrl ? "Add a caption" : "Edit message"
                            }
                            className="w-full resize-none rounded-[14px] border border-[var(--border)] bg-transparent px-3 py-2 text-[14px] text-[var(--text-default)] focus:outline-none"
                          />
                          <div className="mt-2 flex items-center justify-end gap-2 text-[var(--text-muted)]">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition hover:bg-[var(--surface-3)]"
                              onClick={handleCancelEditing}
                              disabled={updateMessageMutation.isPending}
                            >
                              <X className="size-3.5" />
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-full bg-[var(--ui-btn-secondary-bg)] px-2.5 py-1 text-[var(--ui-btn-secondary-text)] transition hover:opacity-90 disabled:opacity-50"
                              onClick={() => handleSaveMessage(message)}
                              disabled={
                                updateMessageMutation.isPending ||
                                editingText.trim() === (message.text || "").trim()
                              }
                            >
                              <Check className="size-3.5" />
                              {updateMessageMutation.isPending ? "Saving..." : "Save"}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    {isMe ? (
                      <Avatar className="size-10 border border-[var(--border)]">
                        <AvatarImage src={getMessageAvatarUrl(message)} />
                        <AvatarFallback>{displayName.slice(0, 1)}</AvatarFallback>
                      </Avatar>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <EmptyState
                title={
                  activeFilter === "all"
                    ? "No messages"
                    : `No ${activeFilter === "link" ? "links" : activeFilter}`
                }
                description={
                  activeFilter === "all"
                    ? "Start chatting with participants."
                    : `No ${activeFilter === "link" ? "links" : activeFilter} shared yet.`
                }
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
        </Card>
      </section>
    </div>
  );
}

