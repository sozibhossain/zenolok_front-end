"use client";

import * as React from "react";
import { ImagePlus, Send } from "lucide-react";

type MessageComposerProps = {
  messageText: string;
  onMessageChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  selectedFileName?: string;
  onSend: () => void;
  isSending: boolean;
};

export function MessageComposer({
  messageText,
  onMessageChange,
  onFileChange,
  selectedFileName,
  onSend,
  isSending,
}: MessageComposerProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const resizeTextarea = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";

    const computedStyle = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 22;
    const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(computedStyle.paddingBottom) || 0;
    const singleLineHeight = lineHeight + paddingTop + paddingBottom;
    const fourLineHeight = lineHeight * 4 + paddingTop + paddingBottom;
    const contentHeight = textarea.scrollHeight;
    const hasWrappedBeyondOneLine = contentHeight > singleLineHeight + 1;
    const nextHeight = hasWrappedBeyondOneLine
      ? fourLineHeight
      : singleLineHeight;

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      hasWrappedBeyondOneLine && contentHeight > fourLineHeight
        ? "auto"
        : "hidden";
  }, []);

  React.useEffect(() => {
    resizeTextarea();
  }, [messageText, resizeTextarea]);

  return (
    <div className="space-y-2">
      {selectedFileName ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-xs text-[var(--text-muted)]">
          {selectedFileName}
        </div>
      ) : null}
      <div className="flex items-end gap-2 rounded-[20px] border border-[var(--border)] bg-[var(--surface-1)] px-2.5 py-1.5">
        <label className="inline-flex size-7 cursor-pointer items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text-default)]">
          <ImagePlus className="size-4" />
          <input
            type="file"
            className="hidden"
            onChange={(event) => onFileChange(event.target.files?.[0] || null)}
          />
        </label>
        <textarea
          ref={textareaRef}
          value={messageText}
          onChange={(event) => onMessageChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (messageText.trim() && !isSending) {
                onSend();
              }
            }
          }}
          placeholder="Type here..."
          rows={1}
          className="w-full resize-none overflow-y-hidden rounded border-none bg-transparent px-0 py-2 text-[16px] leading-[22px] text-[var(--text-default)] placeholder:text-[24px] placeholder:text-[var(--text-muted)] focus:outline-none"
        />
        <button
          type="button"
          className="inline-flex size-7 cursor-pointer items-center justify-center rounded-full text-[var(--ui-btn-secondary-text)] transition hover:bg-[var(--ui-btn-secondary-bg)] disabled:cursor-not-allowed disabled:opacity-40"
          onClick={onSend}
          disabled={isSending}
          aria-label="Send message"
        >
          <Send className="size-4" />
        </button>
      </div>
    </div>
  );
}

