"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, format, startOfDay } from "date-fns";
import {
  Bell,
  CalendarClock,
  Check,
  GripVertical,
  ListFilter,
  Pencil,
  Plus,
  Repeat2,
  SlidersHorizontal,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { SectionLoading } from "@/components/shared/section-loading";
import { TodoStatusCircleButton } from "@/components/shared/todo-status-circle";
import {
  paginateArray,
  todoItemApi,
  todoCategoryApi,
  userApi,
  type AlarmPresetKey,
  type TodoCategory,
  type TodoItem,
} from "@/lib/api";
import {
  getPrimaryAlarmOffset,
  resolveAlarmPresetOptions,
} from "@/lib/alarm-presets";
import {
  toggleAllBrickSelection,
  toggleBrickSelection,
} from "@/lib/brick-filter-selection";
import { queryKeys } from "@/lib/query-keys";
import { formatTimeStringByPreference } from "@/lib/time-format";
import { AddCategoryDialog } from "./_components/add-category-dialog";
import { CategoryDetailDialog } from "./_components/category-detail-dialog";
import { DeleteConfirmDialog } from "./_components/delete-confirm-dialog";
import {
  TodoEditorDialog,
  type TodoAlarmPreset,
  type RepeatValue,
  type TodoEditorMode,
} from "./_components/todo-editor-dialog";

interface CategoryWithItems extends TodoCategory {
  items: TodoItem[];
}

type ScheduledStatusTab = "unfinished" | "finished" | "all";
type CategoryMetaLookup = Record<string, { name: string; color: string }>;
type ScheduledTabOption = {
  value: ScheduledStatusTab;
  label: string;
};

const SCHEDULED_TAB_OPTIONS: ScheduledTabOption[] = [
  { value: "unfinished", label: "Unfinished" },
  { value: "finished", label: "Finished" },
  { value: "all", label: "All" },
];

function toDateInputValue(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function buildTodoAlarmFromPreset({
  alarmPreset,
  alarmPresetOptions,
  dateEnabled,
  scheduledDateInput,
  timeEnabled,
  scheduledTimeInput,
}: {
  alarmPreset: AlarmPresetKey;
  alarmPresetOptions: Parameters<typeof resolveAlarmPresetOptions>[0];
  dateEnabled: boolean;
  scheduledDateInput: string;
  timeEnabled: boolean;
  scheduledTimeInput: string;
}) {
  const presetOffset = getPrimaryAlarmOffset(alarmPreset, alarmPresetOptions);
  if (presetOffset === null) {
    return null;
  }

  if (!dateEnabled || !scheduledDateInput) {
    return null;
  }

  const baseDate = new Date(
    `${scheduledDateInput}T${timeEnabled && scheduledTimeInput ? scheduledTimeInput : "00:00"}:00`,
  );

  if (Number.isNaN(baseDate.getTime())) {
    return null;
  }

  return new Date(baseDate.getTime() - presetOffset * 60 * 1000).toISOString();
}

function hasTodoAlarmConfigured(todo: Pick<TodoItem, "alarm" | "alarmPreset">) {
  if (todo.alarmPreset) {
    return todo.alarmPreset !== "none";
  }

  return Boolean(todo.alarm);
}

function getTodoCategoryMeta(
  todo: TodoItem,
  categoryMetaLookup?: CategoryMetaLookup,
) {
  if (todo.categoryId && typeof todo.categoryId !== "string") {
    return {
      id: todo.categoryId._id,
      name: todo.categoryId.name,
      color: todo.categoryId.color,
    };
  }

  if (
    typeof todo.categoryId === "string" &&
    categoryMetaLookup?.[todo.categoryId]
  ) {
    return {
      id: todo.categoryId,
      name: categoryMetaLookup[todo.categoryId].name,
      color: categoryMetaLookup[todo.categoryId].color,
    };
  }

  return {
    id: typeof todo.categoryId === "string" ? todo.categoryId : "",
    name: "All",
    color: "#38A8E8",
  };
}

function getScheduledOffsetMeta(
  scheduledDate?: string | null,
  scheduledTime?: string | null,
) {
  if (!scheduledDate) {
    return { label: "No date", isOverdue: false, isDateOnlyOverdue: false };
  }

  const target = new Date(scheduledDate);
  if (Number.isNaN(target.getTime())) {
    return { label: "No date", isOverdue: false, isDateOnlyOverdue: false };
  }

  if (!scheduledTime) {
    const dayDelta = differenceInCalendarDays(
      startOfDay(target),
      startOfDay(new Date()),
    );

    if (dayDelta === 0) {
      return { label: "Today", isOverdue: false, isDateOnlyOverdue: false };
    }

    const amount = Math.abs(dayDelta);
    const suffix = amount > 1 ? "s" : "";

    return {
      label:
        dayDelta < 0 ? `-${amount} day${suffix}` : `${amount} day${suffix}`,
      isOverdue: dayDelta < 0,
      isDateOnlyOverdue: dayDelta < 0,
    };
  }

  const [hours, minutes] = scheduledTime.split(":").map(Number);
  const dueAt = new Date(target);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return { label: "No date", isOverdue: false, isDateOnlyOverdue: false };
  }

  dueAt.setHours(hours, minutes, 0, 0);

  const deltaMs = dueAt.getTime() - Date.now();
  const isOverdue = deltaMs < 0;
  const absoluteMs = Math.abs(deltaMs);
  const hourMs = 60 * 60 * 1000;
  const dayMs = 24 * hourMs;
  const amount =
    absoluteMs >= dayMs
      ? Math.max(1, Math.round(absoluteMs / dayMs))
      : Math.max(1, Math.round(absoluteMs / hourMs));
  const unit = absoluteMs >= dayMs ? "day" : "hour";
  const suffix = amount > 1 ? "s" : "";

  return {
    label: isOverdue
      ? `-${amount} ${unit}${suffix}`
      : `${amount} ${unit}${suffix}`,
    isOverdue,
    isDateOnlyOverdue: false,
  };
}

// Kept for potential reuse in detail surfaces; preview cards no longer render it.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getTodoScheduleLine(
  scheduledDate?: string | null,
  scheduledTime?: string | null,
  use24Hour = false,
) {
  const parts: string[] = [];

  if (scheduledDate) {
    const parsedDate = new Date(scheduledDate);

    if (!Number.isNaN(parsedDate.getTime())) {
      parts.push(format(parsedDate, "EEE, dd MMM yyyy"));
    }
  }

  if (scheduledTime) {
    parts.push(formatTimeStringByPreference(scheduledTime, use24Hour));
  }

  return parts.join(" • ");
}

function CategoryCard({
  category,
  pendingDeleteMap,
  onTodoClick,
  onOpen,
  onEditTodoRequest,
  onQuickAddTodo,
  onInlineUpdateTodo,
  onEditCategoryRequest,
  onDeleteCategoryRequest,
  onDragHandleMouseDown,
}: {
  category: CategoryWithItems;
  pendingDeleteMap: Record<string, true>;
  onTodoClick: (todoId: string) => void;
  onOpen: (categoryId: string) => void;
  onEditTodoRequest: (categoryId: string, todoId: string) => void;
  onQuickAddTodo: (categoryId: string, text: string) => void;
  onInlineUpdateTodo: (
    categoryId: string,
    todoId: string,
    text: string,
  ) => void;
  onEditCategoryRequest: (category: CategoryWithItems) => void;
  onDeleteCategoryRequest: (categoryId: string) => void;
  onDragHandleMouseDown: () => void;
}) {
  const items = category.items || [];
  const participantCount = Array.isArray(category?.participants)
    ? category.participants.length
    : 0;
  const collaboratorCount = Math.max(0, participantCount - 1);
  const hasCollaborators = participantCount > 1;
  const [newTodoText, setNewTodoText] = React.useState("");
  const [editingTextMap, setEditingTextMap] = React.useState<
    Record<string, string>
  >({});

  const getEditValue = (item: TodoItem) =>
    editingTextMap[item._id] ?? item.text;
  const isDirty = (item: TodoItem) =>
    (editingTextMap[item._id] ?? item.text) !== item.text;

  const submitNewTodo = () => {
    const trimmed = newTodoText.trim();
    if (!trimmed) {
      return;
    }
    onQuickAddTodo(category._id, trimmed);
    setNewTodoText("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="group mb-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <h3
            className="truncate font-poppins text-[16px] leading-[120%] font-semibold"
            style={{ color: category.color }}
          >
            {category.name}
          </h3>
          {hasCollaborators ? (
            <span
              className="inline-flex size-4 shrink-0 items-center justify-center"
              style={{ color: category.color }}
              title={`${collaboratorCount} collaborator${collaboratorCount === 1 ? "" : "s"}`}
            >
              <Users className="size-3.5" strokeWidth={2} />
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            aria-label="Drag to reorder"
            onMouseDown={(e) => {
              e.stopPropagation();
              onDragHandleMouseDown();
            }}
            className="inline-flex size-5 cursor-grab items-center justify-center text-(--todo-action-icon)"
          >
            <GripVertical className="size-3.5" strokeWidth={2} />
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label={`Edit ${category.name}`}
              className="inline-flex size-5 items-center justify-center text-(--todo-action-icon) transition hover:text-[var(--text-default)]"
              onClick={(event) => {
                event.stopPropagation();
                onEditCategoryRequest(category);
              }}
            >
              <Pencil className="size-3.5" strokeWidth={2} />
            </button>
            <button
              type="button"
              aria-label={`Delete ${category.name}`}
              className="inline-flex size-5 items-center justify-center text-(--todo-action-icon) transition hover:text-red-500"
              onClick={(event) => {
                event.stopPropagation();
                onDeleteCategoryRequest(category._id);
              }}
            >
              <Trash2 className="size-3.5" strokeWidth={2} />
            </button>
            {hasCollaborators ? (
              <span
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold leading-none text-white"
                style={{ backgroundColor: category.color }}
                title={`${collaboratorCount} collaborator${collaboratorCount === 1 ? "" : "s"}`}
              >
                {collaboratorCount}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(category._id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen(category._id);
          }
        }}
        className="todo-category-card flex h-full min-h-[180px] flex-col rounded-[18px] bg-[var(--todo-card-bg)] p-3 transition hover:bg-[var(--todo-card-hover-bg)]"
      >
        <div className="space-y-2">
          {items.slice(0, 5).map((item) => {
            const isPendingDelete = Boolean(pendingDeleteMap[item._id]);
            const isChecked = item.isCompleted || isPendingDelete;
            const { isDateOnlyOverdue } = getScheduledOffsetMeta(
              item.scheduledDate,
              item.scheduledTime,
            );
            const hasSchedule = Boolean(
              item.scheduledDate || item.scheduledTime,
            );
            const hasAlarm = hasTodoAlarmConfigured(item);
            const hasRepeat = Boolean(item.repeat);

            return (
              <div
                key={item._id}
                className="flex items-center gap-2 text-[14px]"
              >
                <TodoStatusCircleButton
                  checked={isChecked}
                  checkedColor={category.color || "#38A8E8"}
                  uncheckedColor="var(--todo-circle-unchecked)"
                  className="size-5"
                  onClick={(event) => {
                    event.stopPropagation();
                    onTodoClick(item._id);
                  }}
                  aria-label={
                    isPendingDelete
                      ? `Cancel delete for ${item.text}`
                      : `Delete ${item.text} after 3 seconds`
                  }
                />
                <div className="min-w-0 flex-1">
                  <input
                    type="text"
                    value={getEditValue(item)}
                    onChange={(event) => {
                      event.stopPropagation();
                      setEditingTextMap((prev) => ({
                        ...prev,
                        [item._id]: event.target.value,
                      }));
                    }}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === "Enter" && isDirty(item)) {
                        onInlineUpdateTodo(
                          category._id,
                          item._id,
                          getEditValue(item),
                        );
                      }
                      if (event.key === "Escape") {
                        setEditingTextMap((prev) => {
                          const next = { ...prev };
                          delete next[item._id];
                          return next;
                        });
                      }
                    }}
                    aria-label={`Edit text for ${item.text}`}
                    className={`w-full min-w-0 truncate font-poppins border-none bg-transparent focus:outline-none ${
                      isChecked
                        ? "text-[var(--text-muted)] line-through"
                        : isDateOnlyOverdue
                          ? "font-medium text-red-500"
                          : "text-[var(--text-default)]"
                    }`}
                  />
                </div>
                <div className="flex shrink-0 items-center gap-1.5 text-[var(--todo-muted-icon)]">
                  {isDirty(item) ? (
                    <button
                      type="button"
                      aria-label={`Save ${item.text}`}
                      className="inline-flex items-center justify-center text-green-500 transition hover:text-green-600"
                      onClick={(event) => {
                        event.stopPropagation();
                        onInlineUpdateTodo(
                          category._id,
                          item._id,
                          getEditValue(item),
                        );
                      }}
                    >
                      <Check className="size-4" strokeWidth={2.5} />
                    </button>
                  ) : (
                    <>
                      {hasSchedule ? (
                        <CalendarClock className="size-4" strokeWidth={1.8} />
                      ) : null}
                      {hasAlarm ? (
                        <Bell className="size-4" strokeWidth={1.8} />
                      ) : null}
                      {hasRepeat ? (
                        <Repeat2 className="size-4" strokeWidth={1.8} />
                      ) : null}
                      <button
                        type="button"
                        aria-label={`Edit ${item.text}`}
                        className="inline-flex items-center justify-center"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEditTodoRequest(category._id, item._id);
                        }}
                      >
                        <SlidersHorizontal
                          className="size-4"
                          strokeWidth={1.8}
                        />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          <div
            className="flex items-center gap-2"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="inline-flex size-5 shrink-0" aria-hidden="true" />
            <input
              type="text"
              value={newTodoText}
              onChange={(event) => setNewTodoText(event.target.value)}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitNewTodo();
                }
              }}
              onClick={(event) => event.stopPropagation()}
              placeholder="New todo"
              aria-label={`Add todo to ${category.name}`}
              className="font-poppins flex-1 border-none bg-transparent text-[14px] text-[var(--text-default)] placeholder:text-[var(--todo-muted-icon)] focus:outline-none"
            />
          </div>
        </div>

        {items.length > 5 ? (
          <p className="font-poppins mt-2 pl-7 text-[12px] leading-none text-[var(--todo-muted-text)]">
            +{items.length - 5}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function TodosPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const targetTodoId = searchParams.get("todoId");

  const [page, setPage] = React.useState(1);
  const [addOpen, setAddOpen] = React.useState(false);
  const [categoryDetailOpen, setCategoryDetailOpen] = React.useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<
    string | null
  >(null);
  const [todoEditorOpen, setTodoEditorOpen] = React.useState(false);
  const [todoEditorMode, setTodoEditorMode] =
    React.useState<TodoEditorMode>("edit");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [deleteTargetTodoId, setDeleteTargetTodoId] = React.useState<
    string | null
  >(null);
  const [editCategoryOpen, setEditCategoryOpen] = React.useState(false);
  const [editCategoryId, setEditCategoryId] = React.useState<string | null>(
    null,
  );
  const [editCategoryName, setEditCategoryName] = React.useState("");
  const [editCategoryColor, setEditCategoryColor] = React.useState("#F7C700");
  const [deleteCategoryConfirmOpen, setDeleteCategoryConfirmOpen] =
    React.useState(false);
  const [deleteTargetCategoryId, setDeleteTargetCategoryId] = React.useState<
    string | null
  >(null);
  const [selectedTodoId, setSelectedTodoId] = React.useState<string | null>(
    null,
  );
  const [todoText, setTodoText] = React.useState("");
  const [dateEnabled, setDateEnabled] = React.useState(false);
  const [timeEnabled, setTimeEnabled] = React.useState(false);
  const [alarmPreset, setAlarmPreset] = React.useState<TodoAlarmPreset>("none");
  const [repeatEnabled, setRepeatEnabled] = React.useState(false);
  const [scheduledDateInput, setScheduledDateInput] = React.useState("");
  const [scheduledTimeInput, setScheduledTimeInput] = React.useState("");
  const [repeatValue, setRepeatValue] = React.useState<RepeatValue>("daily");
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [newCategoryColor, setNewCategoryColor] = React.useState("#F7C700");
  const [newCategoryParticipantIds, setNewCategoryParticipantIds] =
    React.useState<string[]>([]);
  const [editCategoryParticipantIds, setEditCategoryParticipantIds] =
    React.useState<string[]>([]);
  const [scheduledStatusTab, setScheduledStatusTab] =
    React.useState<ScheduledStatusTab>("unfinished");
  const [selectedScheduledCategoryIds, setSelectedScheduledCategoryIds] =
    React.useState<string[] | null>(null);
  const [scheduledAutoDeleteMap, setScheduledAutoDeleteMap] = React.useState<
    Record<string, true>
  >({});
  const [scheduledAutoDeleteHiddenMap, setScheduledAutoDeleteHiddenMap] =
    React.useState<Record<string, true>>({});
  const scheduledAutoDeleteTimersRef = React.useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});
  const scheduledCategoryScrollerRef = React.useRef<HTMLDivElement | null>(
    null,
  );
  const scheduledCategoryDragRef = React.useRef({
    active: false,
    moved: false,
    startX: 0,
    startScrollLeft: 0,
  });
  const scheduledCategorySuppressClickRef = React.useRef(false);
  const handledNotificationTodoIdRef = React.useRef<string | null>(null);
  const [isScheduledCategoryDragging, setIsScheduledCategoryDragging] =
    React.useState(false);

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categoriesWithItems,
    queryFn: todoItemApi.getCategoriesWithItems,
  });
  const profileQuery = useQuery({
    queryKey: queryKeys.profile,
    queryFn: userApi.getProfile,
  });
  const usersQuery = useQuery({
    queryKey: ["users-for-category-share"],
    queryFn: async () => {
      const firstPage = await userApi.getAll({ page: 1, limit: 200 });
      const totalUsers = firstPage.meta.total;

      if (totalUsers > firstPage.users.length) {
        return userApi.getAll({ page: 1, limit: totalUsers });
      }

      return firstPage;
    },
    enabled: addOpen || editCategoryOpen,
  });
  const alarmPresetOptions = React.useMemo(
    () =>
      resolveAlarmPresetOptions(
        profileQuery.data?.preferences?.alarmPresetOptions,
      ),
    [profileQuery.data?.preferences?.alarmPresetOptions],
  );
  const defaultAlarmPreset =
    profileQuery.data?.preferences?.alarmPreset ?? "none";

  const createTodoMutation = useMutation({
    mutationFn: todoItemApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.categoriesWithItems,
      });
      queryClient.invalidateQueries({ queryKey: ["scheduled-todos"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to add todo"),
  });

  const updateTodoMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof todoItemApi.update>[1];
    }) => todoItemApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.categoriesWithItems,
      });
      queryClient.invalidateQueries({ queryKey: ["scheduled-todos"] });
      toast.success("Todo updated");
      setTodoEditorOpen(false);
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update todo"),
  });
  const deleteTodoMutation = useMutation({
    mutationFn: (id: string) => todoItemApi.delete(id),
    onSuccess: (_data, deletedTodoId) => {
      const timer = scheduledAutoDeleteTimersRef.current[deletedTodoId];
      if (timer) {
        clearTimeout(timer);
        delete scheduledAutoDeleteTimersRef.current[deletedTodoId];
      }
      setScheduledAutoDeleteMap((prev) => {
        if (!prev[deletedTodoId]) {
          return prev;
        }
        const next = { ...prev };
        delete next[deletedTodoId];
        return next;
      });
      setScheduledAutoDeleteHiddenMap((prev) => {
        if (!prev[deletedTodoId]) {
          return prev;
        }
        const next = { ...prev };
        delete next[deletedTodoId];
        return next;
      });

      queryClient.invalidateQueries({
        queryKey: queryKeys.categoriesWithItems,
      });
      queryClient.invalidateQueries({ queryKey: ["scheduled-todos"] });
      toast.success("Todo deleted");
      setDeleteConfirmOpen(false);
      setDeleteTargetTodoId(null);
      if (selectedTodoId === deletedTodoId) {
        setTodoEditorOpen(false);
        setSelectedTodoId(null);
      }
    },
    onError: (error: Error, todoId) => {
      clearScheduledAutoDelete(todoId);
      toast.error(error.message || "Failed to delete todo");
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async () => {
      if (!newCategoryName.trim()) {
        throw new Error("Category name is required");
      }

      const categoryName = newCategoryName.trim();

      await todoCategoryApi.create({
        name: categoryName,
        color: newCategoryColor,
        participants: newCategoryParticipantIds,
      });
    },
    onSuccess: () => {
      toast.success("Category added");
      setAddOpen(false);
      setNewCategoryName("");
      setNewCategoryColor("#F7C700");
      setNewCategoryParticipantIds(
        profileQuery.data?._id ? [profileQuery.data._id] : [],
      );
      queryClient.invalidateQueries({
        queryKey: queryKeys.categoriesWithItems,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to create category"),
  });
  const updateCategoryMutation = useMutation({
    mutationFn: async () => {
      if (!editCategoryId) {
        throw new Error("Category is required");
      }

      const categoryName = editCategoryName.trim();
      if (!categoryName) {
        throw new Error("Category name is required");
      }

      await todoCategoryApi.update(editCategoryId, {
        name: categoryName,
        color: editCategoryColor,
        participants: editCategoryParticipantIds,
      });
    },
    onSuccess: () => {
      toast.success("Category updated");
      setEditCategoryOpen(false);
      setEditCategoryId(null);
      setEditCategoryParticipantIds([]);
      queryClient.invalidateQueries({
        queryKey: queryKeys.categoriesWithItems,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to update category"),
  });
  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => todoCategoryApi.delete(id),
    onSuccess: (_data, categoryId) => {
      toast.success("Category deleted");
      setDeleteCategoryConfirmOpen(false);
      setDeleteTargetCategoryId(null);
      if (selectedCategoryId === categoryId) {
        setCategoryDetailOpen(false);
        setSelectedCategoryId(null);
        setSelectedTodoId(null);
        setTodoEditorOpen(false);
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.categoriesWithItems,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to delete category"),
  });

  const [localCategoryOrder, setLocalCategoryOrder] = React.useState<
    string[] | null
  >(null);
  const [dragFromIndex, setDragFromIndex] = React.useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);
  const dragHandleActiveIndexRef = React.useRef<number | null>(null);

  const reorderCategoriesMutation = useMutation({
    mutationFn: (orders: { id: string; sortOrder: number }[]) =>
      todoCategoryApi.reorder(orders),
    onSuccess: () => {
      setLocalCategoryOrder(null);
      queryClient.invalidateQueries({
        queryKey: queryKeys.categoriesWithItems,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    },
    onError: () => {
      setLocalCategoryOrder(null);
      toast.error("Failed to reorder categories");
    },
  });

  const categories = React.useMemo(() => {
    const source = (categoriesQuery.data || []) as CategoryWithItems[];
    const filtered = Object.keys(scheduledAutoDeleteHiddenMap).length
      ? source.map((category) => ({
          ...category,
          items: (category.items || []).filter(
            (item) => !scheduledAutoDeleteHiddenMap[item._id],
          ),
        }))
      : source;

    if (!localCategoryOrder) return filtered;

    const orderMap = new Map(localCategoryOrder.map((id, idx) => [id, idx]));
    return [...filtered].sort((a, b) => {
      const ai = orderMap.has(a._id)
        ? orderMap.get(a._id)!
        : Number.MAX_SAFE_INTEGER;
      const bi = orderMap.has(b._id)
        ? orderMap.get(b._id)!
        : Number.MAX_SAFE_INTEGER;
      return ai - bi;
    });
  }, [categoriesQuery.data, scheduledAutoDeleteHiddenMap, localCategoryOrder]);
  const categoryMetaLookup = React.useMemo(
    () =>
      categories.reduce((acc, category) => {
        acc[category._id] = {
          name: category.name,
          color: category.color,
        };
        return acc;
      }, {} as CategoryMetaLookup),
    [categories],
  );
  const selectedCategory = React.useMemo(
    () => categories.find((item) => item._id === selectedCategoryId) || null,
    [categories, selectedCategoryId],
  );
  const editingCategory = React.useMemo(
    () => categories.find((item) => item._id === editCategoryId) || null,
    [categories, editCategoryId],
  );
  const selectedCategoryItems = React.useMemo(() => {
    if (!selectedCategory) {
      return [];
    }
    return selectedCategory.items || [];
  }, [selectedCategory]);
  const selectedTodo = React.useMemo(() => {
    if (!selectedCategory || !selectedTodoId) {
      return null;
    }
    return (
      (selectedCategory.items || []).find(
        (item) => item._id === selectedTodoId,
      ) || null
    );
  }, [selectedCategory, selectedTodoId]);
  const allUsers = usersQuery.data?.users || [];
  const currentEditCategoryParticipantIds = React.useMemo(
    () =>
      new Set((editingCategory?.participants || []).map((id) => id.toString())),
    [editingCategory?.participants],
  );

  const toggleNewCategoryParticipant = React.useCallback(
    (userId: string, checked: boolean) => {
      setNewCategoryParticipantIds((previous) => {
        if (checked) {
          return previous.includes(userId) ? previous : [...previous, userId];
        }
        return previous.filter((idValue) => idValue !== userId);
      });
    },
    [],
  );

  const toggleEditCategoryParticipant = React.useCallback(
    (userId: string, checked: boolean) => {
      setEditCategoryParticipantIds((previous) => {
        if (checked) {
          return previous.includes(userId) ? previous : [...previous, userId];
        }
        return previous.filter((idValue) => idValue !== userId);
      });
    },
    [],
  );

  React.useEffect(() => {
    if (!addOpen) {
      return;
    }

    setNewCategoryParticipantIds((previous) => {
      if (previous.length || !profileQuery.data?._id) {
        return previous;
      }
      return [profileQuery.data._id];
    });
  }, [addOpen, profileQuery.data?._id]);

  React.useEffect(() => {
    if (!targetTodoId) {
      handledNotificationTodoIdRef.current = null;
      return;
    }

    if (handledNotificationTodoIdRef.current === targetTodoId) {
      return;
    }

    const matchedCategory = categories.find((category) =>
      (category.items || []).some((item) => item._id === targetTodoId),
    );

    if (!matchedCategory) {
      return;
    }

    handledNotificationTodoIdRef.current = targetTodoId;
    setSelectedCategoryId(matchedCategory._id);
    setSelectedTodoId(targetTodoId);
    setTodoEditorMode("edit");
    setTodoEditorOpen(true);
    setCategoryDetailOpen(false);
    router.replace("/todos", { scroll: false });
  }, [categories, router, targetTodoId]);

  const paged = React.useMemo(
    () => paginateArray(categories, page, 6),
    [categories, page],
  );

  const scheduledItems = React.useMemo(() => {
    const allTodos = categories.flatMap((category) =>
      (category.items || []).map((todo) => ({
        ...todo,
        categoryId: todo.categoryId || category._id,
      })),
    );

    return allTodos
      .filter((todo) => {
        if (!todo.scheduledDate) {
          return false;
        }

        const scheduledAt = new Date(todo.scheduledDate);
        return !Number.isNaN(scheduledAt.getTime());
      })
      .sort((a, b) => {
        const aTime = a.scheduledDate
          ? new Date(a.scheduledDate).getTime()
          : Number.MAX_SAFE_INTEGER;
        const bTime = b.scheduledDate
          ? new Date(b.scheduledDate).getTime()
          : Number.MAX_SAFE_INTEGER;

        const safeATime = Number.isNaN(aTime) ? Number.MAX_SAFE_INTEGER : aTime;
        const safeBTime = Number.isNaN(bTime) ? Number.MAX_SAFE_INTEGER : bTime;
        return safeATime - safeBTime;
      });
  }, [categories]);

  const scheduledCategoryOptions = React.useMemo(() => {
    return categories.map((category) => ({
      id: category._id,
      name: category.name,
      color: category.color,
    }));
  }, [categories]);
  const scheduledCategoryIds = React.useMemo(
    () => scheduledCategoryOptions.map((category) => category.id),
    [scheduledCategoryOptions],
  );
  const effectiveScheduledCategoryIds = React.useMemo(() => {
    if (selectedScheduledCategoryIds === null) {
      return scheduledCategoryIds;
    }

    return selectedScheduledCategoryIds;
  }, [scheduledCategoryIds, selectedScheduledCategoryIds]);
  const allScheduledCategoriesSelected = React.useMemo(() => {
    if (!scheduledCategoryIds.length) {
      return false;
    }

    return scheduledCategoryIds.every((categoryId) =>
      effectiveScheduledCategoryIds.includes(categoryId),
    );
  }, [effectiveScheduledCategoryIds, scheduledCategoryIds]);

  const visibleScheduledItems = React.useMemo(() => {
    return scheduledItems.filter((todo) => {
      const isPendingAutoDelete = Boolean(scheduledAutoDeleteMap[todo._id]);

      if (
        scheduledStatusTab === "unfinished" &&
        todo.isCompleted &&
        !isPendingAutoDelete
      ) {
        return false;
      }
      if (
        scheduledStatusTab === "finished" &&
        !todo.isCompleted &&
        !isPendingAutoDelete
      ) {
        return false;
      }

      if (!effectiveScheduledCategoryIds.length) {
        return false;
      }

      if (!allScheduledCategoriesSelected) {
        const category = getTodoCategoryMeta(todo, categoryMetaLookup);
        if (!effectiveScheduledCategoryIds.includes(category.id)) {
          return false;
        }
      }

      return true;
    });
  }, [
    allScheduledCategoriesSelected,
    categoryMetaLookup,
    effectiveScheduledCategoryIds,
    scheduledItems,
    scheduledStatusTab,
    scheduledAutoDeleteMap,
  ]);

  const clearScheduledAutoDelete = React.useCallback((todoId: string) => {
    const timer = scheduledAutoDeleteTimersRef.current[todoId];
    if (timer) {
      clearTimeout(timer);
      delete scheduledAutoDeleteTimersRef.current[todoId];
    }

    setScheduledAutoDeleteMap((prev) => {
      if (!prev[todoId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[todoId];
      return next;
    });
    setScheduledAutoDeleteHiddenMap((prev) => {
      if (!prev[todoId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[todoId];
      return next;
    });
  }, []);

  const scheduleScheduledAutoDelete = React.useCallback(
    (todoId: string) => {
      clearScheduledAutoDelete(todoId);

      setScheduledAutoDeleteMap((prev) => ({ ...prev, [todoId]: true }));
      scheduledAutoDeleteTimersRef.current[todoId] = setTimeout(() => {
        delete scheduledAutoDeleteTimersRef.current[todoId];
        setScheduledAutoDeleteMap((prev) => {
          if (!prev[todoId]) {
            return prev;
          }
          const next = { ...prev };
          delete next[todoId];
          return next;
        });
        setScheduledAutoDeleteHiddenMap((prev) => ({
          ...prev,
          [todoId]: true,
        }));
        deleteTodoMutation.mutate(todoId);
      }, 3000);
    },
    [clearScheduledAutoDelete, deleteTodoMutation],
  );

  const handleTodoClickDelete = React.useCallback(
    (todoId: string) => {
      if (scheduledAutoDeleteTimersRef.current[todoId]) {
        clearScheduledAutoDelete(todoId);
        return;
      }
      scheduleScheduledAutoDelete(todoId);
    },
    [clearScheduledAutoDelete, scheduleScheduledAutoDelete],
  );

  React.useEffect(() => {
    setPage(1);
  }, [categories.length]);

  React.useEffect(() => {
    setSelectedScheduledCategoryIds((previous) => {
      if (previous === null) {
        return null;
      }

      const filtered = previous.filter((categoryId) =>
        scheduledCategoryIds.includes(categoryId),
      );

      if (filtered.length === scheduledCategoryIds.length) {
        return null;
      }

      return filtered.length === previous.length ? previous : filtered;
    });
  }, [scheduledCategoryIds]);

  const handleScheduledCategoryMouseDown = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }

      const container = scheduledCategoryScrollerRef.current;
      if (!container || container.scrollWidth <= container.clientWidth) {
        return;
      }

      scheduledCategorySuppressClickRef.current = false;
      scheduledCategoryDragRef.current = {
        active: true,
        moved: false,
        startX: event.clientX,
        startScrollLeft: container.scrollLeft,
      };
    },
    [],
  );

  React.useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const container = scheduledCategoryScrollerRef.current;
      const dragState = scheduledCategoryDragRef.current;
      if (!container || !dragState.active) {
        return;
      }

      const deltaX = event.clientX - dragState.startX;
      if (!dragState.moved && Math.abs(deltaX) > 4) {
        dragState.moved = true;
        setIsScheduledCategoryDragging(true);
      }

      if (!dragState.moved) {
        return;
      }

      container.scrollLeft = dragState.startScrollLeft - deltaX;
    };

    const handleMouseUp = () => {
      const wasMoved = scheduledCategoryDragRef.current.moved;
      if (wasMoved) {
        scheduledCategorySuppressClickRef.current = true;
      }

      scheduledCategoryDragRef.current.active = false;
      scheduledCategoryDragRef.current.moved = false;
      setIsScheduledCategoryDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleScheduledCategoryClickCapture = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!scheduledCategorySuppressClickRef.current) {
        return;
      }

      scheduledCategorySuppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
    [],
  );

  React.useEffect(() => {
    const scheduledIds = new Set(scheduledItems.map((todo) => todo._id));
    Object.keys(scheduledAutoDeleteTimersRef.current).forEach((todoId) => {
      if (!scheduledIds.has(todoId)) {
        clearScheduledAutoDelete(todoId);
      }
    });
  }, [clearScheduledAutoDelete, scheduledItems]);

  React.useEffect(() => {
    return () => {
      Object.values(scheduledAutoDeleteTimersRef.current).forEach((timer) =>
        clearTimeout(timer),
      );
      scheduledAutoDeleteTimersRef.current = {};
    };
  }, []);

  React.useEffect(() => {
    if (!todoEditorOpen) {
      return;
    }

    if (todoEditorMode === "create") {
      setTodoText("");
      setDateEnabled(false);
      setTimeEnabled(false);
      setAlarmPreset(defaultAlarmPreset);
      setRepeatEnabled(false);
      setScheduledDateInput("");
      setScheduledTimeInput("");
      setRepeatValue("daily");
      return;
    }

    if (!selectedTodo) {
      return;
    }

    setTodoText(selectedTodo.text || "");
    setDateEnabled(Boolean(selectedTodo.scheduledDate));
    setTimeEnabled(Boolean(selectedTodo.scheduledTime));
    setAlarmPreset(
      selectedTodo.alarmPreset ?? (selectedTodo.alarm ? "preset_1" : "none"),
    );
    setRepeatEnabled(Boolean(selectedTodo.repeat));
    setScheduledDateInput(toDateInputValue(selectedTodo.scheduledDate));
    setScheduledTimeInput(selectedTodo.scheduledTime || "");
    setRepeatValue((selectedTodo.repeat || "daily") as RepeatValue);
  }, [defaultAlarmPreset, todoEditorMode, todoEditorOpen, selectedTodo]);

  const openCreateTodoEditor = React.useCallback((categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setSelectedTodoId(null);
    setTodoEditorMode("create");
    setTodoEditorOpen(true);
  }, []);

  const handleQuickAddTodo = React.useCallback(
    (categoryId: string, text: string) => {
      createTodoMutation.mutate({
        categoryId,
        text,
        scheduledDate: null,
        scheduledTime: null,
        alarm: null,
        alarmPreset: "none",
        repeat: null,
      });
    },
    [createTodoMutation],
  );

  const openEditTodoEditor = React.useCallback(
    (categoryId: string, todoId: string) => {
      setSelectedCategoryId(categoryId);
      setSelectedTodoId(todoId);
      setTodoEditorMode("edit");
      setTodoEditorOpen(true);
    },
    [],
  );
  const handleInlineUpdateTodo = React.useCallback(
    (_categoryId: string, todoId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      updateTodoMutation.mutate({ id: todoId, payload: { text: trimmed } });
    },
    [updateTodoMutation],
  );

  const handleCategoryReorder = React.useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      const reordered = [...categories];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      setLocalCategoryOrder(reordered.map((c) => c._id));
      reorderCategoriesMutation.mutate(
        reordered.map((c, idx) => ({ id: c._id, sortOrder: idx })),
      );
    },
    [categories, reorderCategoriesMutation],
  );

  const openEditCategoryDialog = React.useCallback(
    (category: CategoryWithItems) => {
      setEditCategoryId(category._id);
      setEditCategoryName(category.name || "");
      setEditCategoryColor(category.color || "#F7C700");
      setEditCategoryParticipantIds(
        (category.participants || []).map((participantId) =>
          participantId.toString(),
        ),
      );
      setEditCategoryOpen(true);
    },
    [],
  );

  const handleSubmitTodoEditor = React.useCallback(() => {
    const trimmedText = todoText.trim();
    if (!trimmedText || !selectedCategoryId) {
      toast.error("Todo text is required");
      return;
    }

    const alarmValue = buildTodoAlarmFromPreset({
      alarmPreset,
      alarmPresetOptions,
      dateEnabled,
      scheduledDateInput,
      timeEnabled,
      scheduledTimeInput,
    });

    if (todoEditorMode === "create") {
      createTodoMutation.mutate(
        {
          categoryId: selectedCategoryId,
          text: trimmedText,
          scheduledDate:
            dateEnabled && scheduledDateInput
              ? new Date(`${scheduledDateInput}T00:00:00`).toISOString()
              : null,
          scheduledTime:
            timeEnabled && scheduledTimeInput ? scheduledTimeInput : null,
          alarm: alarmValue,
          alarmPreset,
          repeat: repeatEnabled ? repeatValue : null,
        },
        {
          onSuccess: () => {
            toast.success("Todo added");
            setTodoEditorOpen(false);
          },
        },
      );
      return;
    }

    if (!selectedTodoId) {
      return;
    }

    const payload: Parameters<typeof todoItemApi.update>[1] = {
      text: trimmedText || selectedTodo?.text || "",
      scheduledDate:
        dateEnabled && scheduledDateInput
          ? new Date(`${scheduledDateInput}T00:00:00`).toISOString()
          : null,
      scheduledTime:
        timeEnabled && scheduledTimeInput ? scheduledTimeInput : null,
      alarm: alarmValue,
      alarmPreset,
      repeat: repeatEnabled ? repeatValue : null,
    };

    updateTodoMutation.mutate({ id: selectedTodoId, payload });
  }, [
    alarmPreset,
    alarmPresetOptions,
    createTodoMutation,
    dateEnabled,
    repeatEnabled,
    repeatValue,
    scheduledDateInput,
    scheduledTimeInput,
    selectedCategoryId,
    selectedTodo?.text,
    selectedTodoId,
    timeEnabled,
    todoEditorMode,
    todoText,
    updateTodoMutation,
  ]);

  const handleConfirmDeleteTodo = React.useCallback(() => {
    if (!deleteTargetTodoId) {
      return;
    }
    clearScheduledAutoDelete(deleteTargetTodoId);
    deleteTodoMutation.mutate(deleteTargetTodoId);
  }, [clearScheduledAutoDelete, deleteTargetTodoId, deleteTodoMutation]);
  const handleConfirmDeleteCategory = React.useCallback(() => {
    if (!deleteTargetCategoryId) {
      return;
    }
    deleteCategoryMutation.mutate(deleteTargetCategoryId);
  }, [deleteCategoryMutation, deleteTargetCategoryId]);

  return (
    <div className="todos-page space-y-4">
      <section className="todos-shell rounded-[30px] border border-[var(--border)] bg-[var(--surface-1)] p-4 sm:p-5">
        <AddCategoryDialog
          open={editCategoryOpen}
          onOpenChange={(open) => {
            setEditCategoryOpen(open);
            if (!open) {
              setEditCategoryId(null);
              setEditCategoryParticipantIds([]);
            }
          }}
          newCategoryName={editCategoryName}
          onNewCategoryNameChange={setEditCategoryName}
          newCategoryColor={editCategoryColor}
          onNewCategoryColorChange={setEditCategoryColor}
          onCreate={() => updateCategoryMutation.mutate()}
          isCreating={updateCategoryMutation.isPending}
          title="Edit Category"
          submitLabel="Save"
          pendingLabel="Saving..."
          showDefaultTrigger={false}
          allUsers={allUsers}
          selectedParticipantIds={editCategoryParticipantIds}
          currentParticipantIds={currentEditCategoryParticipantIds}
          onToggleParticipant={toggleEditCategoryParticipant}
          isUsersLoading={usersQuery.isLoading}
          isUsersError={usersQuery.isError}
        />

        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-poppins flex items-center gap-2 text-[20px] leading-[120%] font-medium text-[var(--text-strong)]">
                <CalendarClock className="size-5" />
                Scheduled
              </h2>
              {visibleScheduledItems.length ? (
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-[var(--todo-action-icon)] text-[14px] font-semibold leading-none text-white">
                  {visibleScheduledItems.length}
                </span>
              ) : null}
            </div>

            {categoriesQuery.isLoading ? (
              <SectionLoading rows={4} />
            ) : scheduledItems.length ? (
              <div className="todos-scheduled-panel rounded-[20px] bg-[var(--todo-panel-bg)] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-5 text-[15px]">
                    {SCHEDULED_TAB_OPTIONS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setScheduledStatusTab(value)}
                        className={`font-poppins relative pb-1 transition ${
                          scheduledStatusTab === value
                            ? "font-semibold text-[var(--text-default)] after:absolute after:inset-x-0 after:-bottom-0.5 after:h-[2px] after:rounded-full after:bg-[var(--text-default)]"
                            : "font-medium text-[var(--todo-muted-icon)]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    aria-label="Sort scheduled todos"
                    className="inline-flex size-8 items-center justify-center text-[var(--todo-action-icon)] transition hover:bg-[var(--surface-1)]"
                  >
                    <ListFilter className="size-4" strokeWidth={1.8} />
                  </button>
                </div>

                <div
                  ref={scheduledCategoryScrollerRef}
                  className={`drag-scrollbar-hidden mb-3 overflow-x-auto pb-1 select-none ${
                    isScheduledCategoryDragging
                      ? "cursor-grabbing"
                      : "cursor-grab"
                  }`}
                  onMouseDown={handleScheduledCategoryMouseDown}
                  onClickCapture={handleScheduledCategoryClickCapture}
                >
                  <div className="flex w-max min-w-full items-center gap-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedScheduledCategoryIds((previous) =>
                          toggleAllBrickSelection(
                            previous,
                            scheduledCategoryIds,
                          ),
                        )
                      }
                      aria-pressed={allScheduledCategoriesSelected}
                      className="shrink-0 rounded-full border px-4 py-1 text-[14px] font-medium transition"
                      style={
                        allScheduledCategoriesSelected
                          ? {
                              backgroundColor: "var(--ui-badge-neutral-bg)",
                              borderColor: "var(--ui-badge-neutral-border)",
                              color: "var(--ui-badge-neutral-text)",
                            }
                          : {
                              backgroundColor: "var(--todo-filter-inactive-bg)",
                              borderColor: "var(--todo-filter-inactive-bg)",
                              color: "var(--todo-filter-inactive-text)",
                            }
                      }
                    >
                      All
                    </button>
                    {scheduledCategoryOptions.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() =>
                          setSelectedScheduledCategoryIds((previous) =>
                            toggleBrickSelection(
                              previous,
                              category.id,
                              scheduledCategoryIds,
                            ),
                          )
                        }
                        aria-pressed={effectiveScheduledCategoryIds.includes(
                          category.id,
                        )}
                        className="shrink-0 rounded-full border px-4 py-1 text-[14px] font-medium transition"
                        style={
                          effectiveScheduledCategoryIds.includes(category.id)
                            ? {
                                backgroundColor: category.color,
                                borderColor: category.color,
                                color: "white",
                              }
                            : {
                                backgroundColor: "var(--ui-badge-neutral-bg)",
                                borderColor: category.color,
                                color: category.color,
                              }
                        }
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  {visibleScheduledItems.length ? (
                    visibleScheduledItems.slice(0, 5).map((todo) => {
                      const category = getTodoCategoryMeta(
                        todo,
                        categoryMetaLookup,
                      );
                      const {
                        label: offsetLabel,
                        isOverdue,
                        isDateOnlyOverdue,
                      } = getScheduledOffsetMeta(
                        todo.scheduledDate,
                        todo.scheduledTime,
                      );
                      const isAutoDeleting = Boolean(
                        scheduledAutoDeleteMap[todo._id],
                      );
                      const isChecked = todo.isCompleted || isAutoDeleting;

                      return (
                        <div key={todo._id} className="flex items-center gap-2">
                          <p
                            className={`w-[56px] shrink-0 text-right text-[12px] ${
                              isOverdue ? "font-medium" : ""
                            }`}
                            style={{
                              color: isOverdue
                                ? "#FF3B30"
                                : "var(--text-muted)",
                            }}
                          >
                            {offsetLabel}
                          </p>

                          <TodoStatusCircleButton
                            checked={isChecked}
                            checkedColor={category.color || "#38A8E8"}
                            uncheckedColor={category.color || "#38A8E8"}
                            onClick={() => handleTodoClickDelete(todo._id)}
                            aria-label={
                              isAutoDeleting
                                ? `Cancel delete for ${todo.text}`
                                : `Delete ${todo.text} after 3 seconds`
                            }
                          />

                          <p
                            className={`font-poppins min-w-0 flex-1 truncate text-[18px] leading-[120%] ${
                              isChecked
                                ? "text-[var(--text-muted)]"
                                : isDateOnlyOverdue
                                  ? "font-medium text-red-500"
                                  : "text-[var(--text-default)]"
                            }`}
                          >
                            {todo.text}
                          </p>

                          {isChecked ? (
                            <button
                              type="button"
                              className="inline-flex shrink-0 items-center justify-center text-[var(--text-muted)]"
                              aria-label={`Delete ${todo.text}`}
                              onClick={() => {
                                setDeleteTargetTodoId(todo._id);
                                setDeleteConfirmOpen(true);
                              }}
                            >
                              <Trash2 className="size-4" />
                            </button>
                          ) : (
                            <div className="flex shrink-0 items-center gap-2 text-[var(--todo-muted-icon)]">
                              {hasTodoAlarmConfigured(todo) ? (
                                <Bell
                                  className="size-[18px]"
                                  strokeWidth={1.8}
                                />
                              ) : null}
                              {todo.repeat ? (
                                <Repeat2
                                  className="size-[18px]"
                                  strokeWidth={1.8}
                                />
                              ) : null}
                              <button
                                type="button"
                                aria-label={`Edit ${todo.text}`}
                                className="inline-flex items-center justify-center"
                                onClick={() => {
                                  const catId =
                                    typeof todo.categoryId === "string"
                                      ? todo.categoryId
                                      : todo.categoryId?._id;
                                  if (catId) {
                                    openEditTodoEditor(catId, todo._id);
                                  }
                                }}
                              >
                                <SlidersHorizontal
                                  className="size-[18px]"
                                  strokeWidth={1.8}
                                />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="font-poppins py-2 text-center text-[13px] text-[var(--text-muted)]">
                      No todo found for this filter.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <EmptyState
                title="No todo"
                description="Create todo from a category to see it here."
              />
            )}
          </aside>

          <div className="space-y-4">
            {categoriesQuery.isLoading ? (
              <SectionLoading rows={8} />
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {paged.items.map((category, pagedIdx) => {
                    const globalIdx = (page - 1) * 6 + pagedIdx;
                    const isDragging = dragFromIndex === globalIdx;
                    const isDropTarget =
                      dragOverIndex === globalIdx &&
                      dragFromIndex !== null &&
                      dragFromIndex !== globalIdx;

                    return (
                      <div
                        key={category._id}
                        draggable
                        onDragStart={(e) => {
                          if (dragHandleActiveIndexRef.current !== globalIdx) {
                            e.preventDefault();
                            return;
                          }
                          setDragFromIndex(globalIdx);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData(
                            "text/plain",
                            String(globalIdx),
                          );
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (dragOverIndex !== globalIdx) {
                            setDragOverIndex(globalIdx);
                          }
                        }}
                        onDragLeave={(e) => {
                          if (
                            !e.currentTarget.contains(e.relatedTarget as Node)
                          ) {
                            setDragOverIndex((prev) =>
                              prev === globalIdx ? null : prev,
                            );
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (
                            dragFromIndex !== null &&
                            dragFromIndex !== globalIdx
                          ) {
                            handleCategoryReorder(dragFromIndex, globalIdx);
                          }
                          setDragFromIndex(null);
                          setDragOverIndex(null);
                          dragHandleActiveIndexRef.current = null;
                        }}
                        onDragEnd={() => {
                          setDragFromIndex(null);
                          setDragOverIndex(null);
                          dragHandleActiveIndexRef.current = null;
                        }}
                        className={[
                          "transition-all duration-150",
                          isDragging ? "opacity-40 scale-[0.97]" : "",
                          isDropTarget
                            ? "ring-2 ring-(--text-default) ring-offset-2 rounded-[20px]"
                            : "",
                        ].join(" ")}
                      >
                        <CategoryCard
                          category={category}
                          pendingDeleteMap={scheduledAutoDeleteMap}
                          onOpen={(categoryId) => {
                            setSelectedCategoryId(categoryId);
                            setCategoryDetailOpen(true);
                          }}
                          onEditTodoRequest={openEditTodoEditor}
                          onQuickAddTodo={handleQuickAddTodo}
                          onInlineUpdateTodo={handleInlineUpdateTodo}
                          onTodoClick={handleTodoClickDelete}
                          onEditCategoryRequest={openEditCategoryDialog}
                          onDeleteCategoryRequest={(categoryId) => {
                            setDeleteTargetCategoryId(categoryId);
                            setDeleteCategoryConfirmOpen(true);
                          }}
                          onDragHandleMouseDown={() => {
                            dragHandleActiveIndexRef.current = globalIdx;
                          }}
                        />
                      </div>
                    );
                  })}

                  <div className="flex h-full flex-col">
                    <h3 className="mb-1.5 text-[16px] leading-[120%] opacity-0">
                      Add
                    </h3>
                    <AddCategoryDialog
                      open={addOpen}
                      onOpenChange={(open) => {
                        setAddOpen(open);
                        if (!open) {
                          setNewCategoryName("");
                          setNewCategoryColor("#F7C700");
                          setNewCategoryParticipantIds(
                            profileQuery.data?._id
                              ? [profileQuery.data._id]
                              : [],
                          );
                        }
                      }}
                      newCategoryName={newCategoryName}
                      onNewCategoryNameChange={setNewCategoryName}
                      newCategoryColor={newCategoryColor}
                      onNewCategoryColorChange={setNewCategoryColor}
                      onCreate={() => createCategoryMutation.mutate()}
                      isCreating={createCategoryMutation.isPending}
                      allUsers={allUsers}
                      selectedParticipantIds={newCategoryParticipantIds}
                      currentParticipantIds={new Set()}
                      onToggleParticipant={toggleNewCategoryParticipant}
                      isUsersLoading={usersQuery.isLoading}
                      isUsersError={usersQuery.isError}
                      trigger={
                        <button
                          type="button"
                          aria-label="Add category"
                          className="todo-add-category-card flex h-full min-h-[180px] w-full items-center justify-center rounded-[18px] border-2 border-dashed border-[var(--todo-add-border)] text-[var(--todo-muted-text)] transition hover:border-[var(--todo-add-hover-border)] hover:bg-[var(--todo-card-bg)]"
                        >
                          <Plus className="size-6" strokeWidth={1.8} />
                        </button>
                      }
                    />
                  </div>
                </div>
                {paged.totalPages > 1 ? (
                  <PaginationControls
                    page={paged.page}
                    totalPages={paged.totalPages}
                    onPageChange={setPage}
                  />
                ) : null}
              </>
            )}
          </div>
        </div>
      </section>

      <CategoryDetailDialog
        open={categoryDetailOpen}
        onOpenChange={setCategoryDetailOpen}
        selectedCategory={selectedCategory}
        selectedCategoryItems={selectedCategoryItems}
        pendingDeleteMap={scheduledAutoDeleteMap}
        onToggleTodo={(todoId) => {
          handleTodoClickDelete(todoId);
        }}
        onEditTodo={(todoId) => {
          if (!selectedCategory) {
            return;
          }
          openEditTodoEditor(selectedCategory._id, todoId);
        }}
        onDeleteTodo={(todoId) => {
          setDeleteTargetTodoId(todoId);
          setDeleteConfirmOpen(true);
        }}
      />

      <TodoEditorDialog
        open={todoEditorOpen}
        onOpenChange={setTodoEditorOpen}
        mode={todoEditorMode}
        todoText={todoText}
        onTodoTextChange={setTodoText}
        onSubmit={handleSubmitTodoEditor}
        canSubmit={Boolean(todoText.trim())}
        isCreating={createTodoMutation.isPending}
        isUpdating={updateTodoMutation.isPending}
        onDelete={() => {
          if (!selectedTodoId) {
            return;
          }
          setDeleteTargetTodoId(selectedTodoId);
          setDeleteConfirmOpen(true);
        }}
        isDeleting={deleteTodoMutation.isPending}
        dateEnabled={dateEnabled}
        onDateEnabledChange={setDateEnabled}
        scheduledDateInput={scheduledDateInput}
        onScheduledDateChange={setScheduledDateInput}
        timeEnabled={timeEnabled}
        onTimeEnabledChange={setTimeEnabled}
        scheduledTimeInput={scheduledTimeInput}
        onScheduledTimeChange={setScheduledTimeInput}
        alarmPreset={alarmPreset}
        alarmPresetOptions={alarmPresetOptions}
        onAlarmPresetChange={setAlarmPreset}
        repeatEnabled={repeatEnabled}
        onRepeatEnabledChange={setRepeatEnabled}
        repeatValue={repeatValue}
        onRepeatValueChange={setRepeatValue}
      />

      <DeleteConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          setDeleteConfirmOpen(open);
          if (!open) {
            setDeleteTargetTodoId(null);
          }
        }}
        onConfirm={handleConfirmDeleteTodo}
        isDeleting={deleteTodoMutation.isPending}
      />
      <DeleteConfirmDialog
        open={deleteCategoryConfirmOpen}
        onOpenChange={(open) => {
          setDeleteCategoryConfirmOpen(open);
          if (!open) {
            setDeleteTargetCategoryId(null);
          }
        }}
        onConfirm={handleConfirmDeleteCategory}
        isDeleting={deleteCategoryMutation.isPending}
        title="Delete Category?"
      />
    </div>
  );
}

export default function TodosPage() {
  return (
    <React.Suspense fallback={<SectionLoading rows={8} />}>
      <TodosPageContent />
    </React.Suspense>
  );
}
