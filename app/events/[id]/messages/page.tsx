"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ImagePlus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import {
  eventApi,
  jamApi,
  userApi,
  type EventData,
  type JamMessage,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionLoading } from "@/components/shared/section-loading";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { MessageComposer } from "../_components/message-composer";

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

function getMessageLabel(message: JamMessage) {
  return message.text || message.fileName || (message.messageType === "link" ? "Link" : "Media");
}

function getMessageAvatarUrl(message: JamMessage) {
  return message.user.avatar?.url || message.user.profilePicture;
}

function formatMessageStamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return format(date, "hh:mm a");
}

export default function EventMessagesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id;

  const [messageText, setMessageText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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

  const sendMessageMutation = useMutation({
    mutationFn: () => {
      if (!messageText.trim() && !selectedFile) {
        throw new Error("Write a message or attach a file");
      }

      const nextText = messageText.trim();
      let messageType: "text" | "media" | "file" | "link" = "text";

      if (selectedFile) {
        messageType =
          selectedFile.type.startsWith("image/") || selectedFile.type.startsWith("video/")
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
    onSuccess: () => {
      setMessageText("");
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.jamMessages(id) });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to send message"),
  });

  const event = eventQuery.data;
  const messages = messagesQuery.data || [];
  const participants = useMemo(() => mapParticipants(event?.participants || []), [event?.participants]);
  const viewerId = profileQuery.data?._id;

  if (eventQuery.isLoading || messagesQuery.isLoading) {
    return <SectionLoading rows={8} />;
  }

  if (!event) {
    return <EmptyState title="Event not found" description="The event was removed or you don't have access." />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-[20px] text-[#4D5463]"
        >
          <ArrowLeft className="size-5" />
          Back
        </button>
      </div>

      <section className="rounded-[16px] border border-[#E4E9F1] bg-[#F6F8FB] p-2">
        <div className="rounded-[14px] border border-[#D8DEE8] bg-[#ECEFF4] p-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="block h-6 w-1 rounded-sm bg-[#32ADE6]" />
                <p className="truncate text-[34px] font-medium leading-tight text-[#4D4D4D]">
                  {event.title}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center">
              {participants.slice(0, 4).map((participant, index) => (
                <Avatar
                  key={participant._id}
                  className={`size-7 border-2 border-[#ECEFF4] ${index === 0 ? "" : "-ml-2"}`}
                >
                  <AvatarImage src={participant.avatar?.url} />
                  <AvatarFallback>{getParticipantDisplayName(participant).slice(0, 1)}</AvatarFallback>
                </Avatar>
              ))}
            </div>
          </div>
        </div>

        <Card className="mt-3 rounded-[22px] border border-[#DCE2EB] bg-[#ECEFF4] p-3.5 shadow-none">
          <div className="mb-3 flex items-center justify-between text-[#A9B0BC]">
            <button
              type="button"
              className="rounded-full p-1 transition hover:bg-white"
              onClick={() => router.back()}
              aria-label="Back"
            >
              <ArrowLeft className="size-4" />
            </button>
            <span className="inline-flex items-center gap-1 text-[11px]">
              <ImagePlus className="size-3.5" />
              Media, files, link
            </span>
          </div>

          <div className="max-h-[58vh] space-y-3 overflow-auto rounded-[22px] bg-[#E6E8EC] p-2">
            {messages.length ? (
              messages.map((message) => {
                const rawName = (message.user.name || message.user.username || "").trim();
                const isMe = viewerId ? message.user._id === viewerId : rawName === "Me";
                const displayName = isMe ? "Me" : rawName || "User";

                return (
                  <div
                    key={message._id}
                    className={`flex items-end gap-2 ${isMe ? "justify-end" : ""}`}
                  >
                    {!isMe ? (
                      <Avatar className="size-10 border border-[#D4DAE5]">
                        <AvatarImage src={getMessageAvatarUrl(message)} />
                        <AvatarFallback>{displayName.slice(0, 1)}</AvatarFallback>
                      </Avatar>
                    ) : null}
                    <div className={`min-w-0 max-w-[85%] ${isMe ? "text-right" : ""}`}>
                      <p
                        className={`mb-1 text-[14px] leading-none font-medium ${
                          isMe ? "text-[#31A8E8]" : "text-[#4D4D4D]"
                        }`}
                      >
                        {displayName}
                      </p>
                      <div
                        className={`flex items-end gap-2 ${isMe ? "justify-end" : ""}`}
                      >
                        {isMe ? (
                          <p className="pb-0.5 text-[10px] text-[#B3B9C6]">
                            {formatMessageStamp(message.createdAt)}
                          </p>
                        ) : null}
                        <div
                          className={`max-w-[260px] rounded-[18px] px-3 py-1.5 text-[12px] text-[#4D4D4D] ${
                            isMe ? "bg-[#E9F5FF]" : "bg-white"
                          }`}
                        >
                          {getMessageLabel(message)}
                        </div>
                        {!isMe ? (
                          <p className="pb-0.5 text-[10px] text-[#B3B9C6]">
                            {formatMessageStamp(message.createdAt)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {isMe ? (
                      <Avatar className="size-10 border border-[#D4DAE5]">
                        <AvatarImage src={getMessageAvatarUrl(message)} />
                        <AvatarFallback>{displayName.slice(0, 1)}</AvatarFallback>
                      </Avatar>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <EmptyState title="No messages" description="Start chatting with participants." />
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
