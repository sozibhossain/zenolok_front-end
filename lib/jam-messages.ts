import type { JamMessage } from "@/lib/api";

export function sortMessagesByCreatedAt(messages: JamMessage[]) {
  return [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function appendMessageIfMissing(messages: JamMessage[], next: JamMessage) {
  if (messages.some((message) => message._id === next._id)) {
    return messages;
  }

  return sortMessagesByCreatedAt([...messages, next]);
}

export function upsertMessage(messages: JamMessage[], next: JamMessage) {
  const hasMessage = messages.some((message) => message._id === next._id);

  if (!hasMessage) {
    return appendMessageIfMissing(messages, next);
  }

  return sortMessagesByCreatedAt(
    messages.map((message) => (message._id === next._id ? next : message)),
  );
}
