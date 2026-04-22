"use client";

import * as React from "react";

import type { JamMessage } from "@/lib/api";
import {
  createHeicPreviewObjectUrl,
  getMessageAttachmentKind,
  getMessageAttachmentUrl,
  isHeicLikeMessageAttachment,
} from "./event-detail-helpers";

export function useMessagePreviewUrl(message: JamMessage) {
  const attachmentUrl = getMessageAttachmentUrl(message);
  const attachmentKind = getMessageAttachmentKind(message);
  const [previewUrl, setPreviewUrl] = React.useState(attachmentUrl);
  const [isLoadingPreview, setIsLoadingPreview] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    if (
      !attachmentUrl ||
      attachmentKind !== "image" ||
      !isHeicLikeMessageAttachment(message)
    ) {
      setPreviewUrl(attachmentUrl);
      setIsLoadingPreview(false);
      return;
    }

    setIsLoadingPreview(true);
    setPreviewUrl("");

    void createHeicPreviewObjectUrl(attachmentUrl)
      .then((nextUrl) => {
        if (cancelled) {
          window.URL.revokeObjectURL(nextUrl);
          return;
        }

        objectUrl = nextUrl;
        setPreviewUrl(nextUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewUrl(attachmentUrl);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingPreview(false);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        window.URL.revokeObjectURL(objectUrl);
      }
    };
  }, [
    attachmentKind,
    attachmentUrl,
    message,
  ]);

  return {
    attachmentKind,
    attachmentUrl,
    isLoadingPreview,
    previewUrl: previewUrl || attachmentUrl,
  };
}
