"use client";
/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import { ArrowLeft, Download, ExternalLink, Link2, Paperclip } from "lucide-react";

import type { JamMessage } from "@/lib/api";
import { EmptyState } from "@/components/shared/empty-state";
import {
  downloadMessageAttachment,
  formatMessageStamp,
  getMessageLabel,
} from "./event-detail-helpers";
import { useMessagePreviewUrl } from "./use-message-preview-url";

type EventLibraryTab = "media" | "files" | "link";

type EventLibraryPanelProps = {
  libraryTab: EventLibraryTab;
  onLibraryTabChange: (tab: EventLibraryTab) => void;
  mediaMessages: JamMessage[];
  fileMessages: JamMessage[];
  linkMessages: JamMessage[];
  use24Hour: boolean;
  onBackToJam: () => void;
};

export function EventLibraryPanel({
  libraryTab,
  onLibraryTabChange,
  mediaMessages,
  fileMessages,
  linkMessages,
  use24Hour,
  onBackToJam,
}: EventLibraryPanelProps) {
  const [failedPreviewIds, setFailedPreviewIds] = React.useState<Set<string>>(
    () => new Set(),
  );

  const markPreviewFailed = React.useCallback((messageId: string) => {
    setFailedPreviewIds((previous) => {
      const next = new Set(previous);
      next.add(messageId);
      return next;
    });
  }, []);

  return (
    <>
      <div className="mb-3 flex items-center gap-2 text-[var(--text-muted)]">
        <button
          type="button"
          className="rounded-full p-1 transition hover:bg-[var(--surface-3)]"
          onClick={onBackToJam}
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
              onClick={() => onLibraryTabChange(tab)}
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
              <MediaLibraryItem
                key={message._id}
                message={message}
                failedPreviewIds={failedPreviewIds}
                onPreviewFailed={markPreviewFailed}
              />
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
                className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-1)] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-[var(--text-strong)]">
                    {message.fileName || getMessageLabel(message)}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {formatMessageStamp(message.createdAt, use24Hour)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1 text-[var(--text-muted)]">
                  <Paperclip className="size-4" />
                  {message.mediaUrl ? (
                    <>
                      <a
                        href={message.mediaUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex size-7 items-center justify-center rounded-full transition hover:bg-[var(--surface-3)]"
                        aria-label="Open file"
                      >
                        <ExternalLink className="size-4" />
                      </a>
                      <button
                        type="button"
                        className="inline-flex size-7 items-center justify-center rounded-full transition hover:bg-[var(--surface-3)]"
                        aria-label="Download file"
                        onClick={() => {
                          void downloadMessageAttachment(message);
                        }}
                      >
                        <Download className="size-4" />
                      </button>
                    </>
                  ) : null}
                </div>
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
                      {formatMessageStamp(message.createdAt, use24Hour)}
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
  );
}

function MediaLibraryItem({
  message,
  failedPreviewIds,
  onPreviewFailed,
}: {
  message: JamMessage;
  failedPreviewIds: Set<string>;
  onPreviewFailed: (messageId: string) => void;
}) {
  const { attachmentKind, attachmentUrl, isLoadingPreview, previewUrl } =
    useMessagePreviewUrl(message);

  return (
    <div className="overflow-hidden rounded-sm bg-[var(--surface-1)]">
      {attachmentUrl &&
      attachmentKind === "video" &&
      !failedPreviewIds.has(message._id) ? (
        <video
          src={attachmentUrl}
          controls
          preload="metadata"
          className="h-[88px] w-full bg-black/20 object-cover"
          onError={() => onPreviewFailed(message._id)}
        />
      ) : attachmentUrl &&
        attachmentKind === "image" &&
        !failedPreviewIds.has(message._id) ? (
        isLoadingPreview ? (
          <div className="flex h-[88px] items-center justify-center px-2 text-center text-xs text-[var(--text-muted)]">
            Preparing image...
          </div>
        ) : (
          <img
            src={previewUrl}
            alt={message.fileName || "media"}
            className="h-[88px] w-full object-cover"
            loading="lazy"
            onError={() => onPreviewFailed(message._id)}
          />
        )
      ) : (
        <div className="flex h-[88px] items-center justify-center px-2 text-center text-xs text-[var(--text-muted)]">
          {getMessageLabel(message)}
        </div>
      )}
    </div>
  );
}
