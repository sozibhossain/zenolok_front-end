"use client";

import type { AxiosRequestConfig } from "axios";
import { apiClient, publicApiClient } from "@/lib/http";

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type AlarmPresetKey = "none" | "preset_1" | "preset_2" | "preset_3" | "custom";

export interface AlarmPresetOption {
  key: AlarmPresetKey;
  label: string;
  description: string;
  editable: boolean;
  offsetsInMinutes: number[];
}

export interface AvatarData {
  public_id: string;
  url: string;
}

export interface UserPreferences {
  alarmPreset: AlarmPresetKey;
  use24HourFormat: boolean;
  alarmPresetOptions: AlarmPresetOption[];
  notificationSettings: {
    anyMessages: boolean;
    taggedMessages: boolean;
    eventsAlarm: boolean;
    todosAlarm: boolean;
  };
}

export interface UserProfile {
  _id: string;
  name?: string;
  email: string;
  username: string;
  role: "user" | "admin";
  weekend?: string[];
  avatar?: AvatarData;
  preferences?: UserPreferences;
}

export interface UserListData {
  users: UserProfile[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface Brick {
  _id: string;
  name: string;
  color: string;
  icon: string;
  participants: string[];
  members?: string[];
  createdBy: string;
}

export interface TodoCategory {
  _id: string;
  name: string;
  color: string;
  participants: string[];
  createdBy?: string;
}

export interface TodoItem {
  _id: string;
  categoryId: string | TodoCategory;
  text: string;
  isCompleted: boolean;
  createdBy: string;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  alarm?: string | null;
  alarmPreset?: AlarmPresetKey | null;
  repeat?: "daily" | "weekly" | "monthly" | "yearly" | null;
  createdAt: string;
  updatedAt: string;
  sectionLabel?: string;
}

export interface EventTodo {
  _id: string;
  eventId: string;
  text: string;
  isCompleted: boolean;
  isShared: boolean;
  createdBy: string;
  participants?: string[];
  subnotes?: EventTodoSubnote[];
  createdAt: string;
  updatedAt: string;
}

export interface EventTodoSubnote {
  _id: string;
  text: string;
  createdBy:
    | string
    | {
        _id: string;
        name?: string;
        username?: string;
        avatar?: AvatarData;
      };
  createdAt: string;
  updatedAt: string;
}

export interface EventData {
  _id: string;
  title: string;
  createdBy: string;
  brick?: Brick;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  location?: string;
  participants: Array<string | UserProfile>;
  reminder?: string;
  recurrence: "once" | "daily" | "weekly" | "monthly" | "yearly";
  todos?: EventTodo[];
  createdAt: string;
  updatedAt: string;
}

export interface JamMessage {
  _id: string;
  eventId: string;
  user: {
    _id: string;
    name?: string;
    username?: string;
    avatar?: AvatarData;
    profilePicture?: string;
  };
  messageType: "text" | "media" | "file" | "link";
  text?: string;
  mediaUrl?: string;
  fileName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackMedia {
  public_id: string;
  url: string;
}

export interface FeedbackUser {
  _id: string;
  name?: string;
  email?: string;
  username?: string;
  avatar?: AvatarData;
}

export interface FeedbackData {
  _id: string;
  user: string | FeedbackUser;
  message: string;
  photos: FeedbackMedia[];
  videos: FeedbackMedia[];
  createdAt: string;
  updatedAt: string;
}

export interface NotificationData {
  _id: string;
  title: string;
  user: string | UserProfile;
  read: boolean;
  type?: string;
  eventId?: string;
  messageId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationCountBucket {
  total: number;
  unread: number;
}

export interface NotificationCounts {
  all: NotificationCountBucket;
  messages: NotificationCountBucket;
  system: NotificationCountBucket;
}

export interface NotificationListData {
  items: NotificationData[];
  counts: NotificationCounts;
}

export type SearchResultType =
  | "event"
  | "eventTodo"
  | "todoItem"
  | "brick"
  | "category";

export interface SearchResultItem {
  type: SearchResultType;
  item: {
    _id?: string;
    eventId?: string;
    title?: string;
    name?: string;
    text?: string;
    location?: string;
    createdAt?: string;
    startTime?: string;
    [key: string]: unknown;
  };
}

export interface SearchResultsPayload {
  items: SearchResultItem[];
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

async function unwrap<T>(promise: Promise<{ data: ApiEnvelope<T> }>) {
  const response = await promise;
  return response.data.data;
}

export function paginateArray<T>(items: T[], page: number, limit: number): PaginatedResult<T> {
  const safePage = Math.max(page, 1);
  const safeLimit = Math.max(limit, 1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const start = (safePage - 1) * safeLimit;

  return {
    items: items.slice(start, start + safeLimit),
    page: safePage,
    limit: safeLimit,
    total,
    totalPages,
  };
}

function withParams(config: AxiosRequestConfig | undefined, params: Record<string, unknown>) {
  return {
    ...(config || {}),
    params,
  };
}

export const authApi = {
  register: (payload: { username: string; email: string; password: string; termsAccepted: boolean }) =>
    unwrap<{ email: string; id: string }>(publicApiClient.post("/auth/register", payload)),
  verifyEmail: (payload: { email: string; otp: string }) =>
    unwrap<null>(publicApiClient.post("/auth/verify-email", payload)),
  resendOtp: (payload: { email: string }) =>
    unwrap<{ email: string }>(publicApiClient.post("/auth/resend-otp", payload)),
  forgetPassword: (payload: { email: string }) =>
    unwrap<null>(publicApiClient.post("/auth/forget-password", payload)),
  verifyResetOtp: (payload: { email: string; otp: string }) =>
    unwrap<null>(publicApiClient.post("/auth/verify-reset-otp", payload)),
  resetPassword: (payload: { email: string; otp: string; newPassword: string }) =>
    unwrap<null>(publicApiClient.post("/auth/reset-password", payload)),
  changePassword: (payload: { oldPassword: string; newPassword: string }) =>
    unwrap<null>(apiClient.post("/auth/change-password", payload)),
  logout: () => unwrap<null>(apiClient.post("/auth/logout")),
};

export const userApi = {
  getProfile: () => unwrap<UserProfile>(apiClient.get("/user/profile")),
  getPreferences: () => unwrap<UserPreferences>(apiClient.get("/user/preferences")),
  getAll: (params?: { page?: number; limit?: number; role?: string; q?: string }) =>
    unwrap<UserListData>(apiClient.get("/user", withParams(undefined, params || {}))),
  updateProfile: (payload: FormData) =>
    unwrap<UserProfile>(apiClient.patch("/user/update-profile", payload, {
      headers: { "Content-Type": "multipart/form-data" },
    })),
  updateAlarmPreset: (payload: { alarmPreset: AlarmPresetKey }) =>
    unwrap<UserPreferences>(apiClient.patch("/user/preferences/alarm-preset", payload)),
  updateAlarmPresetOption: (payload: {
    key: Exclude<AlarmPresetKey, "none">;
    offsetsInMinutes: number[];
  }) => unwrap<UserPreferences>(apiClient.patch("/user/preferences/alarm-preset-option", payload)),
  updateNotificationPreferences: (
    payload: Partial<UserPreferences["notificationSettings"]>,
  ) => unwrap<UserPreferences>(apiClient.patch("/user/preferences/notifications", payload)),
  updateTimeFormatPreference: (payload: { use24HourFormat: boolean }) =>
    unwrap<UserPreferences>(apiClient.patch("/user/preferences/time-format", payload)),
  searchUsers: (query: string) =>
    unwrap<UserProfile[]>(apiClient.get("/user/search", withParams(undefined, { query }))),
};

export const brickApi = {
  getAll: () => unwrap<Brick[]>(apiClient.get("/bricks")),
  getById: (id: string) => unwrap<Brick>(apiClient.get(`/bricks/${id}`)),
  create: (payload: Pick<Brick, "name" | "color" | "icon"> & { members?: string[] }) =>
    unwrap<Brick>(apiClient.post("/bricks", payload)),
  update: (
    id: string,
    payload: Partial<Pick<Brick, "name" | "color" | "icon">> & { members?: string[] },
  ) =>
    unwrap<Brick>(apiClient.patch(`/bricks/${id}`, payload)),
  delete: (id: string) => unwrap<null>(apiClient.delete(`/bricks/${id}`)),
};

export const todoCategoryApi = {
  getAll: () => unwrap<TodoCategory[]>(apiClient.get("/todo-categories")),
  getById: (id: string) => unwrap<TodoCategory>(apiClient.get(`/todo-categories/${id}`)),
  create: (payload: Pick<TodoCategory, "name" | "color">) =>
    unwrap<TodoCategory>(apiClient.post("/todo-categories", payload)),
  update: (id: string, payload: Partial<Pick<TodoCategory, "name" | "color">>) =>
    unwrap<TodoCategory>(apiClient.patch(`/todo-categories/${id}`, payload)),
  delete: (id: string) => unwrap<null>(apiClient.delete(`/todo-categories/${id}`)),
};

export const todoItemApi = {
  create: (payload: {
    text: string;
    categoryId: string;
    scheduledDate?: string | null;
    scheduledTime?: string | null;
    repeat?: TodoItem["repeat"] | null;
    alarm?: string | null;
    alarmPreset?: AlarmPresetKey;
  }) => unwrap<TodoItem>(apiClient.post("/todo-items", payload)),
  getByCategory: (categoryId: string) => unwrap<TodoItem[]>(apiClient.get(`/todo-items/category/${categoryId}`)),
  getScheduled: (params: {
    date?: string;
    startDate?: string;
    endDate?: string;
    status?: "finished" | "unfinished";
    categoryId?: string;
  }) => unwrap<TodoItem[]>(apiClient.get("/todo-items/scheduled", withParams(undefined, params))),
  getCategoriesWithItems: () =>
    unwrap<Array<TodoCategory & { items: TodoItem[] }>>(apiClient.get("/todo-items/categories-with-items")),
  update: (
    id: string,
    payload: {
      text?: string;
      isCompleted?: boolean;
      scheduledDate?: string | null;
      scheduledTime?: string | null;
      alarm?: string | null;
      alarmPreset?: AlarmPresetKey;
      repeat?: TodoItem["repeat"] | null;
    }
  ) => unwrap<TodoItem>(apiClient.patch(`/todo-items/${id}`, payload)),
  delete: (id: string) => unwrap<null>(apiClient.delete(`/todo-items/${id}`)),
};

export const eventApi = {
  create: (payload: {
    title: string;
    brick?: string;
    startTime: string;
    endTime: string;
    isAllDay?: boolean;
    location?: string;
    reminder?: string;
    recurrence?: EventData["recurrence"];
    todos?: Array<{ text: string; isShared?: boolean }>;
  }) => unwrap<{ event: EventData; todos: EventTodo[] }>(apiClient.post("/events", payload)),
  getAll: (params: {
    startDate?: string;
    endDate?: string;
    brickId?: string;
    filter?: "today" | "past" | "all" | "upcoming";
  }) => unwrap<EventData[]>(apiClient.get("/events", withParams(undefined, params))),
  getById: (id: string) => unwrap<EventData>(apiClient.get(`/events/${id}`)),
  update: (
    id: string,
    payload: Partial<Omit<EventData, "_id" | "createdAt" | "updatedAt" | "brick">> & {
      brick?: string;
      todos?: Array<{ _id?: string; text: string; isShared?: boolean }>;
    }
  ) => unwrap<EventData>(apiClient.patch(`/events/${id}`, payload)),
  delete: (id: string) => unwrap<null>(apiClient.delete(`/events/${id}`)),
};

export const eventTodoApi = {
  create: (payload: { text: string; eventId: string; isShared?: boolean }) =>
    unwrap<EventTodo>(apiClient.post("/event-todos", payload)),
  getByEvent: (eventId: string) => unwrap<EventTodo[]>(apiClient.get(`/event-todos/event/${eventId}`)),
  update: (id: string, payload: Partial<Pick<EventTodo, "text" | "isCompleted">>) =>
    unwrap<EventTodo>(apiClient.patch(`/event-todos/${id}`, payload)),
  delete: (eventId: string, id: string) => unwrap<null>(apiClient.delete(`/event-todos/${eventId}/todo/${id}`)),
  addSubnote: (id: string, payload: { text: string }) =>
    unwrap<EventTodoSubnote[]>(apiClient.post(`/event-todos/${id}/subnotes`, payload)),
  getSubnotes: (id: string) =>
    unwrap<EventTodoSubnote[]>(apiClient.get(`/event-todos/${id}/subnotes`)),
  updateSubnote: (id: string, subnoteId: string, payload: { text: string }) =>
    unwrap<EventTodoSubnote[]>(apiClient.patch(`/event-todos/${id}/subnotes/${subnoteId}`, payload)),
  deleteSubnote: (id: string, subnoteId: string) =>
    unwrap<EventTodoSubnote[]>(apiClient.delete(`/event-todos/${id}/subnotes/${subnoteId}`)),
};

export const jamApi = {
  create: (payload: FormData) =>
    unwrap<JamMessage>(apiClient.post("/jam-messages", payload, {
      headers: { "Content-Type": "multipart/form-data" },
    })),
  getByEvent: (eventId: string) => unwrap<JamMessage[]>(apiClient.get(`/jam-messages/event/${eventId}`)),
  delete: (id: string) => unwrap<null>(apiClient.delete(`/jam-messages/${id}`)),
};

export const feedbackApi = {
  create: (payload: FormData) =>
    unwrap<FeedbackData>(apiClient.post("/feedbacks", payload, {
      headers: { "Content-Type": "multipart/form-data" },
    })),
  getAll: () => unwrap<FeedbackData[]>(apiClient.get("/feedbacks")),
};

export const searchApi = {
  search: (q: string) =>
    unwrap<SearchResultsPayload>(
      apiClient.get("/search", withParams(undefined, { q })),
    ),
};

export const notificationApi = {
  getAll: () => unwrap<NotificationListData>(apiClient.get("/notifications")),
  markAsRead: (id: string) =>
    unwrap<{ notification: NotificationData; counts: NotificationCounts }>(
      apiClient.patch(`/notifications/${id}/read`),
    ),
  markEventMessagesRead: (eventId: string) =>
    unwrap<{ modifiedCount: number; counts: NotificationCounts }>(
      apiClient.patch(`/notifications/messages/event/${eventId}/read`),
    ),
  markAllRead: () =>
    unwrap<{ modifiedCount: number; counts: NotificationCounts }>(
      apiClient.patch("/notifications/mark-read"),
    ),
  clearAll: () => unwrap<null>(apiClient.delete("/notifications/clear")),
};
