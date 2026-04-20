import type {
  NotificationCounts,
  NotificationData,
  NotificationListData,
} from "@/lib/api";

type NotificationEventMatchTarget = {
  _id?: string;
  id?: string;
  title?: string;
};

export function isMessageNotification(notification: Pick<NotificationData, "type">) {
  return /(message|chat)/i.test(notification.type ?? "");
}

export function getNotificationHref(
  notification: Pick<
    NotificationData,
    "type" | "eventId" | "messageId" | "todoId" | "brickId"
  >,
) {
  switch (notification.type) {
    case "message_received":
    case "tagged_message":
      if (notification.eventId && notification.messageId) {
        return `/events/${notification.eventId}/messages?messageId=${notification.messageId}`;
      }

      if (notification.eventId) {
        return `/events/${notification.eventId}/messages`;
      }

      return "/events";

    case "todo_upcoming":
      return notification.todoId
        ? `/todos?todoId=${notification.todoId}`
        : "/todos";

    case "event_upcoming":
    case "participant_added":
      return notification.eventId ? `/events/${notification.eventId}` : "/events";

    case "brick_invitation_received":
      return "/bricks/invitations";

    case "brick_invitation_accepted":
      return "/settings";

    default:
      if (notification.eventId && notification.messageId) {
        return `/events/${notification.eventId}/messages?messageId=${notification.messageId}`;
      }

      if (notification.eventId) {
        return `/events/${notification.eventId}`;
      }

      if (notification.todoId) {
        return `/todos?todoId=${notification.todoId}`;
      }

      if (notification.brickId) {
        return "/settings";
      }

      return null;
  }
}

export function notificationMatchesEvent(
  notification: Pick<NotificationData, "eventId" | "title">,
  event: NotificationEventMatchTarget,
) {
  const eventId = event._id ?? event.id ?? "";
  if (notification.eventId && eventId) {
    return notification.eventId === eventId;
  }

  const eventTitle = (event.title ?? "").trim().toLowerCase();
  if (!eventTitle) {
    return false;
  }

  return notification.title.toLowerCase().includes(eventTitle);
}

export function buildNotificationCounts(items: NotificationData[]): NotificationCounts {
  const messages = items.filter((item) => isMessageNotification(item));
  const system = items.filter((item) => !isMessageNotification(item));
  const unread = items.filter((item) => !item.read);

  return {
    all: {
      total: items.length,
      unread: unread.length,
    },
    messages: {
      total: messages.length,
      unread: messages.filter((item) => !item.read).length,
    },
    system: {
      total: system.length,
      unread: system.filter((item) => !item.read).length,
    },
  };
}

function sortNotificationsByCreatedAt(items: NotificationData[]) {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function upsertNotificationList(
  previous: NotificationListData,
  notification: NotificationData,
) {
  const withoutExisting = previous.items.filter((item) => item._id !== notification._id);
  const items = sortNotificationsByCreatedAt([notification, ...withoutExisting]).slice(0, 200);

  return {
    items,
    counts: buildNotificationCounts(items),
  };
}
