"use client";

import type { AxiosRequestConfig } from "axios";
import { apiClient, publicApiClient } from "@/lib/http";

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

export interface AvatarData {
  public_id: string;
  url: string;
}

export interface UserProfile {
  _id: string;
  name?: string;
  email: string;
  username: string;
  role: "user" | "admin";
  avatar?: AvatarData;
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
  scheduledDate?: string;
  scheduledTime?: string;
  alarm?: string;
  repeat?: "daily" | "weekly" | "monthly" | "yearly";
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

export interface NotificationData {
  _id: string;
  title: string;
  user: string | UserProfile;
  read: boolean;
  type?: string;
  createdAt: string;
  updatedAt: string;
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
  getAll: (params?: { page?: number; limit?: number; role?: string; q?: string }) =>
    unwrap<UserListData>(apiClient.get("/user", withParams(undefined, params || {}))),
  updateProfile: (payload: FormData) =>
    unwrap<UserProfile>(apiClient.patch("/user/update-profile", payload, {
      headers: { "Content-Type": "multipart/form-data" },
    })),
  searchUsers: (query: string) =>
    unwrap<UserProfile[]>(apiClient.get("/user/search", withParams(undefined, { query }))),
};

export const brickApi = {
  getAll: () => unwrap<Brick[]>(apiClient.get("/bricks")),
  getById: (id: string) => unwrap<Brick>(apiClient.get(`/bricks/${id}`)),
  create: (payload: Pick<Brick, "name" | "color" | "icon">) => unwrap<Brick>(apiClient.post("/bricks", payload)),
  update: (id: string, payload: Partial<Pick<Brick, "name" | "color" | "icon">>) =>
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
  update: (id: string, payload: Partial<Omit<EventData, "_id" | "createdAt" | "updatedAt">> & {
    todos?: Array<{ _id?: string; text: string; isShared?: boolean }>;
  }) => unwrap<EventData>(apiClient.patch(`/events/${id}`, payload)),
  delete: (id: string) => unwrap<null>(apiClient.delete(`/events/${id}`)),
};

export const eventTodoApi = {
  create: (payload: { text: string; eventId: string; isShared?: boolean }) =>
    unwrap<EventTodo>(apiClient.post("/event-todos", payload)),
  getByEvent: (eventId: string) => unwrap<EventTodo[]>(apiClient.get(`/event-todos/event/${eventId}`)),
  update: (id: string, payload: Partial<Pick<EventTodo, "text" | "isCompleted">>) =>
    unwrap<EventTodo>(apiClient.patch(`/event-todos/${id}`, payload)),
  delete: (id: string) => unwrap<null>(apiClient.delete(`/event-todos/${id}`)),
};

export const jamApi = {
  create: (payload: FormData) =>
    unwrap<JamMessage>(apiClient.post("/jam-messages", payload, {
      headers: { "Content-Type": "multipart/form-data" },
    })),
  getByEvent: (eventId: string) => unwrap<JamMessage[]>(apiClient.get(`/jam-messages/event/${eventId}`)),
  delete: (id: string) => unwrap<null>(apiClient.delete(`/jam-messages/${id}`)),
};

export const notificationApi = {
  getAll: () => unwrap<NotificationData[]>(apiClient.get("/notifications")),
  markAsRead: (id: string) => unwrap<NotificationData>(apiClient.patch(`/notifications/${id}/read`)),
  clearAll: () => unwrap<null>(apiClient.delete("/notifications/clear")),
};
