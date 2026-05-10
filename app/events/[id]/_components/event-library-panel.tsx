"use client";
/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Link2,
  Paperclip,
  X,
} from "lucide-react";

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
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);

  const markPreviewFailed = React.useCallback((messageId: string) => {
    setFailedPreviewIds((previous) => {
      const next = new Set(previous);
      next.add(messageId);
      return next;
    });
  }, []);

  const closeLightbox = React.useCallback(() => setLightboxIndex(null), []);
  const showPrev = React.useCallback(() => {
    setLightboxIndex((current) =>
      current === null
        ? null
        : (current - 1 + mediaMessages.length) % mediaMessages.length,
    );
  }, [mediaMessages.length]);
  const showNext = React.useCallback(() => {
    setLightboxIndex((current) =>
      current === null ? null : (current + 1) % mediaMessages.length,
    );
  }, [mediaMessages.length]);

  React.useEffect(() => {
    if (lightboxIndex === null) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeLightbox();
      else if (event.key === "ArrowLeft") showPrev();
      else if (event.key === "ArrowRight") showNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxIndex, closeLightbox, showPrev, showNext]);

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
            {mediaMessages.map((message, index) => (
              <MediaLibraryItem
                key={message._id}
                message={message}
                failedPreviewIds={failedPreviewIds}
                onPreviewFailed={markPreviewFailed}
                onOpen={() => setLightboxIndex(index)}
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

      {lightboxIndex !== null && mediaMessages[lightboxIndex] ? (
        <MediaLightbox
          message={mediaMessages[lightboxIndex]}
          index={lightboxIndex}
          total={mediaMessages.length}
          onClose={closeLightbox}
          onPrev={showPrev}
          onNext={showNext}
        />
      ) : null}
    </>
  );
}

function MediaLightbox({
  message,
  index,
  total,
  onClose,
  onPrev,
  onNext,
}: {
  message: JamMessage;
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { attachmentKind, attachmentUrl, previewUrl } =
    useMessagePreviewUrl(message);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const src = previewUrl || attachmentUrl;
  const hasMultiple = total > 1;

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute right-4 top-4 inline-flex size-10 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        aria-label="Close"
      >
        <X className="size-5" />
      </button>
      <button
        type="button"
        className="absolute right-16 top-4 inline-flex size-10 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75"
        onClick={(event) => {
          event.stopPropagation();
          void downloadMessageAttachment(message);
        }}
        aria-label="Download"
      >
        <Download className="size-5" />
      </button>

      {hasMultiple ? (
        <button
          type="button"
          className="absolute left-4 top-1/2 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75"
          onClick={(event) => {
            event.stopPropagation();
            onPrev();
          }}
          aria-label="Previous"
        >
          <ChevronLeft className="size-6" />
        </button>
      ) : null}

      <div
        className="flex max-h-[90vh] max-w-[90vw] items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        {attachmentKind === "video" && attachmentUrl ? (
          <video
            src={attachmentUrl}
            controls
            autoPlay
            className="max-h-[90vh] max-w-[90vw] rounded-md bg-black"
          />
        ) : src ? (
          <img
            src={src}
            alt={message.fileName || "media"}
            className="max-h-[90vh] max-w-[90vw] rounded-md object-contain"
          />
        ) : (
          <div className="rounded-md bg-white/90 p-6 text-sm text-[var(--text-default)]">
            Preview unavailable
          </div>
        )}
      </div>

      {hasMultiple ? (
        <button
          type="button"
          className="absolute right-4 top-1/2 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75"
          onClick={(event) => {
            event.stopPropagation();
            onNext();
          }}
          aria-label="Next"
        >
          <ChevronRight className="size-6" />
        </button>
      ) : null}

      {hasMultiple ? (
        <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs text-white">
          {index + 1} / {total}
        </span>
      ) : null}
    </div>,
    document.body,
  );
}

function MediaLibraryItem({
  message,
  failedPreviewIds,
  onPreviewFailed,
  onOpen,
}: {
  message: JamMessage;
  failedPreviewIds: Set<string>;
  onPreviewFailed: (messageId: string) => void;
  onOpen: () => void;
}) {
  const { attachmentKind, attachmentUrl, isLoadingPreview, previewUrl } =
    useMessagePreviewUrl(message);

  return (
    <div
      className="group relative aspect-square cursor-pointer overflow-hidden rounded-md bg-[var(--surface-1)]"
      onClick={onOpen}
      role="button"
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          void downloadMessageAttachment(message);
        }}
        aria-label="Download"
        className="absolute right-1.5 top-1.5 z-10 inline-flex size-7 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/75"
      >
        <Download className="size-3.5" />
      </button>
      {attachmentUrl &&
      attachmentKind === "video" &&
      !failedPreviewIds.has(message._id) ? (
        <video
          src={attachmentUrl}
          controls
          preload="metadata"
          className="h-full w-full bg-black/20 object-cover"
          onError={() => onPreviewFailed(message._id)}
        />
      ) : attachmentUrl &&
        attachmentKind === "image" &&
        !failedPreviewIds.has(message._id) ? (
        isLoadingPreview ? (
          <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-[var(--text-muted)]">
            Preparing image...
          </div>
        ) : (
          <img
            src={previewUrl}
            alt={message.fileName || "media"}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => onPreviewFailed(message._id)}
          />
        )
      ) : (
        <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-[var(--text-muted)]">
          {getMessageLabel(message)}
        </div>
      )}
    </div>
  );
}
