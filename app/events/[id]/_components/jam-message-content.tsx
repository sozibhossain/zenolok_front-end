"use client";
/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import type { ReactNode } from "react";
import {
  Download,
  ExternalLink,
  File,
  FileImage,
  FileVideo,
  Link2,
} from "lucide-react";

import type { JamMessage } from "@/lib/api";
import {
  downloadMessageAttachment,
  getMessageAttachmentKind,
  getMessageAttachmentUrl,
  getMessageLabel,
  isLinkMessage,
} from "./event-detail-helpers";

type JamMessageContentProps = {
  message: JamMessage;
  isMe: boolean;
};

function MessageActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex size-7 items-center justify-center rounded-full text-[inherit] transition hover:bg-black/5"
    >
      {children}
    </button>
  );
}

export function JamMessageContent({
  message,
  isMe,
}: JamMessageContentProps) {
  const [previewFailed, setPreviewFailed] = React.useState(false);
  const attachmentUrl = getMessageAttachmentUrl(message);
  const attachmentKind = getMessageAttachmentKind(message);
  const linkValue = (message.text || "").trim();
  const bubbleClassName = isMe
    ? "border-[color:color-mix(in_srgb,var(--ui-btn-secondary-text)_20%,var(--border)_80%)] bg-[var(--ui-btn-secondary-bg)] text-[var(--ui-btn-secondary-text)]"
    : "border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-strong)]";
  const secondaryTextClassName = isMe
    ? "text-[color:color-mix(in_srgb,var(--ui-btn-secondary-text)_78%,white_22%)]"
    : "text-[var(--text-muted)]";

  if (isLinkMessage(message) && linkValue) {
    return (
      <a
        href={linkValue}
        target="_blank"
        rel="noreferrer"
        className={`flex max-w-[280px] items-center gap-2 rounded-[18px] border px-3 py-2 text-left text-[12px] ${bubbleClassName}`}
      >
        <Link2 className="size-4 shrink-0" />
        <span className="truncate underline underline-offset-2">
          {linkValue}
        </span>
      </a>
    );
  }

  if (!attachmentUrl || !attachmentKind) {
    return (
      <div
        className={`max-w-[280px] rounded-[18px] border px-3 py-1.5 text-[12px] ${bubbleClassName}`}
      >
        {getMessageLabel(message)}
      </div>
    );
  }

  if (attachmentKind === "image") {
    if (previewFailed) {
      return renderFileCard({
        attachmentUrl,
        bubbleClassName,
        secondaryTextClassName,
        message,
        attachmentKind,
      });
    }

    return (
      <div
        className={`w-[280px] max-w-full rounded-[18px] border p-2 text-[12px] ${bubbleClassName}`}
      >
        <a href={attachmentUrl} target="_blank" rel="noreferrer">
          <img
            src={attachmentUrl}
            alt={message.fileName || "Attachment"}
            className="h-auto max-h-[220px] w-full rounded-[14px] object-cover"
            loading="lazy"
            onError={() => setPreviewFailed(true)}
          />
        </a>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">
              {message.fileName || "Image"}
            </p>
            {message.text ? (
              <p className={`truncate ${secondaryTextClassName}`}>
                {message.text}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            <MessageActionButton
              label="Open attachment"
              onClick={() => window.open(attachmentUrl, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="size-4" />
            </MessageActionButton>
            <MessageActionButton
              label="Download attachment"
              onClick={() => {
                void downloadMessageAttachment(message);
              }}
            >
              <Download className="size-4" />
            </MessageActionButton>
          </div>
        </div>
      </div>
    );
  }

  if (attachmentKind === "video") {
    if (previewFailed) {
      return renderFileCard({
        attachmentUrl,
        bubbleClassName,
        secondaryTextClassName,
        message,
        attachmentKind,
      });
    }

    return (
      <div
        className={`w-[280px] max-w-full rounded-[18px] border p-2 text-[12px] ${bubbleClassName}`}
      >
        <video
          src={attachmentUrl}
          controls
          preload="metadata"
          className="max-h-[220px] w-full rounded-[14px] bg-black/20"
          onError={() => setPreviewFailed(true)}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">
              {message.fileName || "Video"}
            </p>
            {message.text ? (
              <p className={`truncate ${secondaryTextClassName}`}>
                {message.text}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            <MessageActionButton
              label="Open attachment"
              onClick={() => window.open(attachmentUrl, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="size-4" />
            </MessageActionButton>
            <MessageActionButton
              label="Download attachment"
              onClick={() => {
                void downloadMessageAttachment(message);
              }}
            >
              <Download className="size-4" />
            </MessageActionButton>
          </div>
        </div>
      </div>
    );
  }

  return renderFileCard({
    attachmentUrl,
    bubbleClassName,
    secondaryTextClassName,
    message,
    attachmentKind,
  });
}

function renderFileCard({
  attachmentUrl,
  bubbleClassName,
  secondaryTextClassName,
  message,
  attachmentKind,
}: {
  attachmentUrl: string;
  bubbleClassName: string;
  secondaryTextClassName: string;
  message: JamMessage;
  attachmentKind: ReturnType<typeof getMessageAttachmentKind>;
}) {
  const fileIcon =
    attachmentKind === "image" || message.fileMimeType?.startsWith("image/")
    ? FileImage
    : attachmentKind === "video" || message.fileMimeType?.startsWith("video/")
      ? FileVideo
      : File;

  const FileIcon = fileIcon;

  return (
    <div
      className={`flex w-[280px] max-w-full items-start gap-3 rounded-[18px] border px-3 py-2 text-[12px] ${bubbleClassName}`}
    >
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-black/5">
        <FileIcon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{message.fileName || "Attachment"}</p>
        {message.text ? (
          <p className={`mt-0.5 truncate ${secondaryTextClassName}`}>
            {message.text}
          </p>
        ) : null}
        <div className="mt-2 flex items-center gap-1">
          <MessageActionButton
            label="Open attachment"
            onClick={() => window.open(attachmentUrl, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="size-4" />
          </MessageActionButton>
          <MessageActionButton
            label="Download attachment"
            onClick={() => {
              void downloadMessageAttachment(message);
            }}
          >
            <Download className="size-4" />
          </MessageActionButton>
        </div>
      </div>
    </div>
  );
}
