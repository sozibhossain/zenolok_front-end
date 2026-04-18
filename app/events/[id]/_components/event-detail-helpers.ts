"use client";

import type { JamMessage } from "@/lib/api";
import { formatIsoTimeByPreference } from "@/lib/time-format";

export function getParticipantDisplayName(participant: {
  name?: string;
  username?: string;
  email?: string;
}) {
  return (
    participant.name || participant.username || participant.email || "User"
  );
}

export function getDisplayNameFromMessage(message: JamMessage) {
  return message.user.name || message.user.username || "User";
}

export function getMessageAvatarUrl(message: JamMessage) {
  return message.user.avatar?.url || message.user.profilePicture;
}

export function getMessageLabel(message: JamMessage) {
  return (
    message.text ||
    message.fileName ||
    (message.messageType === "link" ? "Link" : "Media")
  );
}

const imageExtensions = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "svg",
  "avif",
  "heic",
  "heif",
]);

const videoExtensions = new Set([
  "mp4",
  "mov",
  "webm",
  "m4v",
  "avi",
  "mkv",
]);

function getFileExtension(value?: string) {
  if (!value) {
    return "";
  }

  try {
    const normalizedValue = value.startsWith("http")
      ? new URL(value).pathname
      : value;
    const cleanedValue = normalizedValue.split("?")[0];
    const parts = cleanedValue.split(".");
    return parts.length > 1 ? parts.pop()?.toLowerCase() || "" : "";
  } catch {
    const cleanedValue = value.split("?")[0];
    const parts = cleanedValue.split(".");
    return parts.length > 1 ? parts.pop()?.toLowerCase() || "" : "";
  }
}

export function isLinkMessage(message: JamMessage) {
  return (
    message.messageType === "link" ||
    /^https?:\/\/\S+$/i.test((message.text || "").trim())
  );
}

export function getMessageAttachmentUrl(message: JamMessage) {
  return message.mediaUrl || "";
}

export function getMessageAttachmentKind(message: JamMessage) {
  const mimeType = (message.fileMimeType || "").toLowerCase();
  if (mimeType.startsWith("image/")) {
    return "image" as const;
  }
  if (mimeType.startsWith("video/")) {
    return "video" as const;
  }

  const extension =
    getFileExtension(message.fileName) || getFileExtension(message.mediaUrl);

  if (videoExtensions.has(extension)) {
    return "video" as const;
  }

  if (
    imageExtensions.has(extension) ||
    (message.messageType === "media" && Boolean(message.mediaUrl))
  ) {
    return "image" as const;
  }

  if (message.mediaUrl || message.fileName) {
    return "file" as const;
  }

  return null;
}

export async function downloadMessageAttachment(message: JamMessage) {
  const attachmentUrl = getMessageAttachmentUrl(message);

  if (!attachmentUrl || typeof window === "undefined") {
    return;
  }

  const fallbackFileName =
    message.fileName ||
    `attachment-${message._id}.${getFileExtension(attachmentUrl) || "bin"}`;

  try {
    const response = await fetch(attachmentUrl);
    if (!response.ok) {
      throw new Error("Download failed");
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fallbackFileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(attachmentUrl, "_blank", "noopener,noreferrer");
  }
}

export function formatMessageStamp(value: string, use24Hour: boolean) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return formatIsoTimeByPreference(value, use24Hour);
}
