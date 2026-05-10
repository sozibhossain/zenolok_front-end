"use client";

import { ImagePlus } from "lucide-react";

import type { JamMessage } from "@/lib/api";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionLoading } from "@/components/shared/section-loading";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  formatMessageStamp,
  getDisplayNameFromMessage,
  getMessageAvatarUrl,
} from "./event-detail-helpers";
import { JamMessageContent } from "./jam-message-content";
import { MessageComposer } from "./message-composer";

type JamPreviewPanelProps = {
  viewerId?: string;
  messages: JamMessage[];
  isLoading: boolean;
  use24Hour: boolean;
  messageText: string;
  onMessageChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  selectedFileName?: string;
  onSend: () => void;
  isSending: boolean;
  onOpenMessagesPage: () => void;
  onOpenLibrary: () => void;
};

type MessagePreviewItemProps = {
  message: JamMessage;
  viewerId?: string;
  use24Hour: boolean;
};

function MessagePreviewItem({
  message,
  viewerId,
  use24Hour,
}: MessagePreviewItemProps) {
  const rawName = getDisplayNameFromMessage(message).trim();
  const isMe = viewerId ? message.user._id === viewerId : rawName === "Me";
  const displayName = isMe ? "Me" : rawName || "User";

  return (
    <div className={`flex items-end gap-2 ${isMe ? "justify-end" : ""}`}>
      {!isMe ? (
        <Avatar className="size-10 border border-[var(--border)]">
          <AvatarImage src={getMessageAvatarUrl(message)} />
          <AvatarFallback>{displayName.slice(0, 1)}</AvatarFallback>
        </Avatar>
      ) : null}
      <div className={`min-w-0 max-w-[85%] ${isMe ? "text-right" : ""}`}>
        <p
          className={`mb-1 text-[14px] leading-none font-medium ${
            isMe
              ? "text-[var(--ui-btn-secondary-text)]"
              : "text-[var(--text-strong)]"
          }`}
        >
          {displayName}
        </p>
        <div className={`flex items-end gap-2 ${isMe ? "justify-end" : ""}`}>
          {isMe ? (
            <p className="pb-0.5 text-[10px] text-[var(--text-muted)]">
              {formatMessageStamp(message.createdAt, use24Hour)}
            </p>
          ) : null}
          <JamMessageContent message={message} isMe={isMe} />
          {!isMe ? (
            <p className="pb-0.5 text-[10px] text-[var(--text-muted)]">
              {formatMessageStamp(message.createdAt, use24Hour)}
            </p>
          ) : null}
        </div>
      </div>
      {isMe ? (
        <Avatar className="size-10 border border-[var(--border)]">
          <AvatarImage src={getMessageAvatarUrl(message)} />
          <AvatarFallback>{displayName.slice(0, 1)}</AvatarFallback>
        </Avatar>
      ) : null}
    </div>
  );
}

export function JamPreviewPanel({
  viewerId,
  messages,
  isLoading,
  use24Hour,
  messageText,
  onMessageChange,
  onFileChange,
  selectedFileName,
  onSend,
  isSending,
  onOpenMessagesPage,
  onOpenLibrary,
}: JamPreviewPanelProps) {
  const stop = (
    handler?: (event: React.MouseEvent<HTMLElement>) => void,
  ) => (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    handler?.(event);
  };

  return (
    <div
      className="cursor-pointer"
      onClick={onOpenMessagesPage}
      role="button"
    >
      <div className="mb-2 flex items-center justify-end gap-1">
        <button
          type="button"
          className="rounded-full p-1 text-[var(--text-muted)] transition hover:bg-[var(--surface-3)]"
          onClick={stop(() => onOpenLibrary())}
          aria-label="Open media files and links"
        >
          <ImagePlus className="size-4" />
        </button>
      </div>

      <div className="max-h-150 space-y-3 overflow-auto rounded-[22px] bg-[var(--surface-3)] p-2">
        {isLoading ? (
          <SectionLoading rows={3} />
        ) : messages.length ? (
          messages.map((message) => (
            <MessagePreviewItem
              key={message._id}
              message={message}
              viewerId={viewerId}
              use24Hour={use24Hour}
            />
          ))
        ) : (
          <EmptyState
            title="No messages"
            description="Start chatting with participants."
          />
        )}
      </div>

      <div className="mt-3" onClick={stop()}>
        <MessageComposer
          messageText={messageText}
          onMessageChange={onMessageChange}
          onFileChange={onFileChange}
          selectedFileName={selectedFileName}
          onSend={onSend}
          isSending={isSending}
        />
      </div>
    </div>
  );
}
