"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, format, startOfDay } from "date-fns";
import {
  Bell,
  CalendarClock,
  CalendarDays,
  Clock3,
  Pencil,
  Plus,
  Repeat2,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { useAppState } from "@/components/providers/app-state-provider";
import { DragScrollArea } from "@/components/shared/drag-scroll-area";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { SectionLoading } from "@/components/shared/section-loading";
import {
  paginateArray,
  todoItemApi,
  todoCategoryApi,
  type AlarmPresetKey,
  type TodoCategory,
  type TodoItem,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { AddCategoryDialog } from "./_components/add-category-dialog";
import { CategoryDetailDialog } from "./_components/category-detail-dialog";
import { DeleteConfirmDialog } from "./_components/delete-confirm-dialog";
import {
  TodoEditorDialog,
  type TodoAlarmPreset,
  type RepeatValue,
  type TodoEditorMode,
} from "./_components/todo-editor-dialog";
import { formatTimeStringByPreference } from "@/lib/time-format";

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

const TODO_ALARM_PRESET_OFFSET_MINUTES: Record<TodoAlarmPreset, number | null> = {
  none: null,
  preset_1: 10,
  preset_2: 30,
  preset_3: 1440,
};

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
  dateEnabled,
  scheduledDateInput,
  timeEnabled,
  scheduledTimeInput,
}: {
  alarmPreset: AlarmPresetKey;
  dateEnabled: boolean;
  scheduledDateInput: string;
  timeEnabled: boolean;
  scheduledTimeInput: string;
}) {
  const presetOffset = TODO_ALARM_PRESET_OFFSET_MINUTES[alarmPreset];
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

function getTodoCategoryMeta(todo: TodoItem, categoryMetaLookup?: CategoryMetaLookup) {
  if (todo.categoryId && typeof todo.categoryId !== "string") {
    return {
      id: todo.categoryId._id,
      name: todo.categoryId.name,
      color: todo.categoryId.color,
    };
  }

  if (typeof todo.categoryId === "string" && categoryMetaLookup?.[todo.categoryId]) {
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

function getScheduledOffsetMeta(scheduledDate?: string | null, scheduledTime?: string | null) {
  if (!scheduledDate) {
    return { label: "No date", isOverdue: false, isDateOnlyOverdue: false };
  }

  const target = new Date(scheduledDate);
  if (Number.isNaN(target.getTime())) {
    return { label: "No date", isOverdue: false, isDateOnlyOverdue: false };
  }

  if (!scheduledTime) {
    const dayDelta = differenceInCalendarDays(startOfDay(target), startOfDay(new Date()));

    if (dayDelta === 0) {
      return { label: "Today", isOverdue: false, isDateOnlyOverdue: false };
    }

    const amount = Math.abs(dayDelta);
    const suffix = amount > 1 ? "s" : "";

    return {
      label: dayDelta < 0 ? `-${amount} day${suffix}` : `${amount} day${suffix}`,
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
    label: isOverdue ? `-${amount} ${unit}${suffix}` : `${amount} ${unit}${suffix}`,
    isOverdue,
    isDateOnlyOverdue: false,
  };
}

function CategoryCard({
  category,
  pendingDeleteMap,
  onTodoClick,
  onOpen,
  onCreateTodoRequest,
  onEditTodoRequest,
  onDeleteTodoRequest,
  onEditCategoryRequest,
  onDeleteCategoryRequest,
  use24Hour,
}: {
  category: CategoryWithItems;
  pendingDeleteMap: Record<string, true>;
  onTodoClick: (todoId: string) => void;
  onOpen: (categoryId: string) => void;
  onCreateTodoRequest: (categoryId: string) => void;
  onEditTodoRequest: (categoryId: string, todoId: string) => void;
  onDeleteTodoRequest: (todoId: string) => void;
  onEditCategoryRequest: (category: CategoryWithItems) => void;
  onDeleteCategoryRequest: (categoryId: string) => void;
  use24Hour: boolean;
}) {
  const items = category.items || [];
  const unfinished = items.filter((item) => !item.isCompleted);

  return (
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
      className="todo-category-card rounded-[12px] border border-[#D8DEE8] bg-[#F0F3F8] p-4 transition hover:border-[#C7CEDD]"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-poppins text-[24px] leading-[120%] font-semibold" style={{ color: category.color }}>
          {category.name}
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`Edit ${category.name}`}
            className="inline-flex items-center justify-center text-[#7D8596]"
            onClick={(event) => {
              event.stopPropagation();
              onEditCategoryRequest(category);
            }}
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            aria-label={`Delete ${category.name}`}
            className="inline-flex items-center justify-center text-[#7D8596]"
            onClick={(event) => {
              event.stopPropagation();
              onDeleteCategoryRequest(category._id);
            }}
          >
            <Trash2 className="size-4" />
          </button>
          <span
            className="font-poppins inline-flex min-w-[26px] items-center justify-center rounded-full px-1.5 py-0.5 text-[14px] leading-[120%] font-medium text-white"
            style={{ backgroundColor: category.color }}
          >
            {unfinished.length}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {items.slice(0, 3).map((item) => {
          const isPendingDelete = Boolean(pendingDeleteMap[item._id]);
          const isChecked = item.isCompleted || isPendingDelete;
          const { isDateOnlyOverdue } = getScheduledOffsetMeta(item.scheduledDate, item.scheduledTime);

          return (
            <div key={item._id} className="flex items-center gap-2 text-[18px] text-[#3F4552]">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onTodoClick(item._id);
                }}
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2 bg-white"
                style={{ borderColor: category.color || "#38A8E8" }}
                aria-label={isPendingDelete ? `Cancel delete for ${item.text}` : `Delete ${item.text} after 3 seconds`}
              >
                {isChecked ? (
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: category.color || "#38A8E8" }}
                  />
                ) : null}
              </button>
              <span
                className={`flex-1 truncate ${
                  isChecked
                    ? "text-[#A4ACBA] line-through"
                    : isDateOnlyOverdue
                      ? "font-medium text-red-500"
                      : "text-[#3F4552]"
                }`}
              >
                {item.text}
              </span>
              {isChecked ? (
                <button
                  type="button"
                  aria-label={`Delete ${item.text}`}
                  className="inline-flex items-center justify-center text-[#B5BBC8]"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteTodoRequest(item._id);
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              ) : (
                <div className="flex items-center gap-1 text-[#B5BBC8]">
                  {item.scheduledDate ? (
                    <span className="inline-flex items-center gap-1 text-[11px] leading-none">
                      <CalendarDays className="size-3.5" />
                      {format(new Date(item.scheduledDate), "dd MMM")}
                    </span>
                  ) : null}
                  {item.scheduledTime ? (
                    <span className="inline-flex items-center gap-1 text-[11px] leading-none">
                      <Clock3 className="size-3.5" />
                      {formatTimeStringByPreference(item.scheduledTime, use24Hour)}
                    </span>
                  ) : null}
                  {hasTodoAlarmConfigured(item) ? <Bell className="size-3.5 cursor-pointer" /> : null}
                  {item.repeat ? <Repeat2 className="size-3.5 cursor-pointer" /> : null}
                  <button
                    type="button"
                    aria-label={`Edit ${item.text}`}
                    className="inline-flex items-center justify-center"
                    onClick={(event) => {
                      event.stopPropagation();
                      onEditTodoRequest(category._id, item._id);
                    }}
                  >
                    <SlidersHorizontal className="size-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className="mt-3 inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-1)] px-3 py-1 text-[13px] text-[var(--text-muted)]"
        onClick={(event) => {
          event.stopPropagation();
          onCreateTodoRequest(category._id);
        }}
      >
        <Plus className="size-3.5" />
        Add todo
      </button>

      {items.length > 3 ? (
        <p className="font-poppins mt-1 text-[14px] leading-[120%] text-[#9AA2B2]">+{items.length - 3}</p>
      ) : null}
    </div>
  );
}

export default function TodosPage() {
  const { preferences } = useAppState();
  const queryClient = useQueryClient();

  const [page, setPage] = React.useState(1);
  const [addOpen, setAddOpen] = React.useState(false);
  const [categoryDetailOpen, setCategoryDetailOpen] = React.useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string | null>(null);
  const [todoEditorOpen, setTodoEditorOpen] = React.useState(false);
  const [todoEditorMode, setTodoEditorMode] = React.useState<TodoEditorMode>("edit");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [deleteTargetTodoId, setDeleteTargetTodoId] = React.useState<string | null>(null);
  const [editCategoryOpen, setEditCategoryOpen] = React.useState(false);
  const [editCategoryId, setEditCategoryId] = React.useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = React.useState("");
  const [editCategoryColor, setEditCategoryColor] = React.useState("#F7C700");
  const [deleteCategoryConfirmOpen, setDeleteCategoryConfirmOpen] = React.useState(false);
  const [deleteTargetCategoryId, setDeleteTargetCategoryId] = React.useState<string | null>(null);
  const [selectedTodoId, setSelectedTodoId] = React.useState<string | null>(null);
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
  const [scheduledStatusTab, setScheduledStatusTab] = React.useState<ScheduledStatusTab>("unfinished");
  const [scheduledCategoryFilter, setScheduledCategoryFilter] = React.useState("all");
  const [scheduledAutoDeleteMap, setScheduledAutoDeleteMap] = React.useState<Record<string, true>>({});
  const [scheduledAutoDeleteHiddenMap, setScheduledAutoDeleteHiddenMap] = React.useState<Record<string, true>>({});
  const scheduledAutoDeleteTimersRef = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categoriesWithItems,
    queryFn: todoItemApi.getCategoriesWithItems,
  });

  const createTodoMutation = useMutation({
    mutationFn: todoItemApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categoriesWithItems });
      queryClient.invalidateQueries({ queryKey: ["scheduled-todos"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to add todo"),
  });

  const updateTodoMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof todoItemApi.update>[1] }) =>
      todoItemApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categoriesWithItems });
      queryClient.invalidateQueries({ queryKey: ["scheduled-todos"] });
      toast.success("Todo updated");
      setTodoEditorOpen(false);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update todo"),
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

      queryClient.invalidateQueries({ queryKey: queryKeys.categoriesWithItems });
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
      });
    },
    onSuccess: () => {
      toast.success("Category added");
      setAddOpen(false);
      setNewCategoryName("");
      setNewCategoryColor("#F7C700");
      queryClient.invalidateQueries({ queryKey: queryKeys.categoriesWithItems });
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create category"),
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
      });
    },
    onSuccess: () => {
      toast.success("Category updated");
      setEditCategoryOpen(false);
      setEditCategoryId(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.categoriesWithItems });
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update category"),
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
      queryClient.invalidateQueries({ queryKey: queryKeys.categoriesWithItems });
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete category"),
  });

  const categories = React.useMemo(() => {
    const source = (categoriesQuery.data || []) as CategoryWithItems[];
    if (!Object.keys(scheduledAutoDeleteHiddenMap).length) {
      return source;
    }
    return source.map((category) => ({
      ...category,
      items: (category.items || []).filter((item) => !scheduledAutoDeleteHiddenMap[item._id]),
    }));
  }, [categoriesQuery.data, scheduledAutoDeleteHiddenMap]);
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
    [categories, selectedCategoryId]
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
    return (selectedCategory.items || []).find((item) => item._id === selectedTodoId) || null;
  }, [selectedCategory, selectedTodoId]);

  const paged = React.useMemo(() => paginateArray(categories, page, 6), [categories, page]);

  const scheduledItems = React.useMemo(() => {
    const allTodos = categories.flatMap((category) =>
      (category.items || []).map((todo) => ({
        ...todo,
        categoryId: todo.categoryId || category._id,
      })),
    );

    return allTodos.sort((a, b) => {
      const aTime = a.scheduledDate ? new Date(a.scheduledDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.scheduledDate ? new Date(b.scheduledDate).getTime() : Number.MAX_SAFE_INTEGER;

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

  const visibleScheduledItems = React.useMemo(() => {
    return scheduledItems.filter((todo) => {
      const isPendingAutoDelete = Boolean(scheduledAutoDeleteMap[todo._id]);

      if (scheduledStatusTab === "unfinished" && todo.isCompleted && !isPendingAutoDelete) {
        return false;
      }
      if (scheduledStatusTab === "finished" && !todo.isCompleted && !isPendingAutoDelete) {
        return false;
      }

      if (scheduledCategoryFilter !== "all") {
        const category = getTodoCategoryMeta(todo, categoryMetaLookup);
        if (category.id !== scheduledCategoryFilter) {
          return false;
        }
      }

      return true;
    });
  }, [categoryMetaLookup, scheduledItems, scheduledStatusTab, scheduledCategoryFilter, scheduledAutoDeleteMap]);

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
        setScheduledAutoDeleteHiddenMap((prev) => ({ ...prev, [todoId]: true }));
        deleteTodoMutation.mutate(todoId);
      }, 3000);
    },
    [clearScheduledAutoDelete, deleteTodoMutation],
  );

  const handleTodoClickDelete = React.useCallback((todoId: string) => {
    if (scheduledAutoDeleteTimersRef.current[todoId]) {
      clearScheduledAutoDelete(todoId);
      return;
    }
    scheduleScheduledAutoDelete(todoId);
  }, [clearScheduledAutoDelete, scheduleScheduledAutoDelete]);

  React.useEffect(() => {
    setPage(1);
  }, [categories.length]);

  React.useEffect(() => {
    if (scheduledCategoryFilter === "all") {
      return;
    }
    if (!scheduledCategoryOptions.some((category) => category.id === scheduledCategoryFilter)) {
      setScheduledCategoryFilter("all");
    }
  }, [scheduledCategoryFilter, scheduledCategoryOptions]);

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
      Object.values(scheduledAutoDeleteTimersRef.current).forEach((timer) => clearTimeout(timer));
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
      setAlarmPreset("none");
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
    setAlarmPreset(selectedTodo.alarmPreset ?? (selectedTodo.alarm ? "preset_1" : "none"));
    setRepeatEnabled(Boolean(selectedTodo.repeat));
    setScheduledDateInput(toDateInputValue(selectedTodo.scheduledDate));
    setScheduledTimeInput(selectedTodo.scheduledTime || "");
    setRepeatValue((selectedTodo.repeat || "daily") as RepeatValue);
  }, [todoEditorMode, todoEditorOpen, selectedTodo]);

  const openCreateTodoEditor = React.useCallback((categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setSelectedTodoId(null);
    setTodoEditorMode("create");
    setTodoEditorOpen(true);
  }, []);

  const openEditTodoEditor = React.useCallback((categoryId: string, todoId: string) => {
    setSelectedCategoryId(categoryId);
    setSelectedTodoId(todoId);
    setTodoEditorMode("edit");
    setTodoEditorOpen(true);
  }, []);
  const openEditCategoryDialog = React.useCallback((category: CategoryWithItems) => {
    setEditCategoryId(category._id);
    setEditCategoryName(category.name || "");
    setEditCategoryColor(category.color || "#F7C700");
    setEditCategoryOpen(true);
  }, []);

  const handleSubmitTodoEditor = React.useCallback(() => {
    const trimmedText = todoText.trim();
    if (!trimmedText || !selectedCategoryId) {
      toast.error("Todo text is required");
      return;
    }

    const alarmValue = buildTodoAlarmFromPreset({
      alarmPreset,
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
          scheduledTime: timeEnabled && scheduledTimeInput ? scheduledTimeInput : null,
          alarm: alarmValue,
          alarmPreset,
          repeat: repeatEnabled ? repeatValue : null,
        },
        {
          onSuccess: () => {
            toast.success("Todo added");
            setTodoEditorOpen(false);
          },
        }
      );
      return;
    }

    if (!selectedTodoId) {
      return;
    }

    const payload: Parameters<typeof todoItemApi.update>[1] = {
      text: trimmedText || selectedTodo?.text || "",
      scheduledDate: dateEnabled && scheduledDateInput ? new Date(`${scheduledDateInput}T00:00:00`).toISOString() : null,
      scheduledTime: timeEnabled && scheduledTimeInput ? scheduledTimeInput : null,
      alarm: alarmValue,
      alarmPreset,
      repeat: repeatEnabled ? repeatValue : null,
    };

    updateTodoMutation.mutate({ id: selectedTodoId, payload });
  }, [
    alarmPreset,
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
      <section className="todos-shell rounded-[30px] border border-[#E0E4EC] bg-[#F4F6FA] p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-end">
          <AddCategoryDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            newCategoryName={newCategoryName}
            onNewCategoryNameChange={setNewCategoryName}
            newCategoryColor={newCategoryColor}
            onNewCategoryColorChange={setNewCategoryColor}
            onCreate={() => createCategoryMutation.mutate()}
            isCreating={createCategoryMutation.isPending}
          />
          <AddCategoryDialog
            open={editCategoryOpen}
            onOpenChange={(open) => {
              setEditCategoryOpen(open);
              if (!open) {
                setEditCategoryId(null);
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
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="">
            <h2 className="font-poppins mb-3 flex items-center gap-2 text-[20px] leading-[120%] font-medium text-[var(--text-strong)]">
              <CalendarClock className="size-5" />
              Scheduled
            </h2>

            {categoriesQuery.isLoading ? (
              <SectionLoading rows={4} />
            ) : scheduledItems.length ? (
              <div className="todos-scheduled-panel rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <div
                  className="mb-3 grid grid-cols-3 rounded-full border border-[var(--border)] bg-[var(--ui-tabs-list-bg)] p-1 text-[14px]"
                  style={{ boxShadow: "0px 4px 4px 0px rgba(0, 0, 0, 0)" }}
                >
                  {SCHEDULED_TAB_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setScheduledStatusTab(value)}
                      className={`rounded-full px-2 py-1 capitalize transition ${
                        scheduledStatusTab === value
                          ? "bg-[var(--ui-tabs-trigger-active-bg)] font-medium text-[var(--ui-tabs-trigger-active-text)]"
                          : "text-[var(--ui-tabs-trigger-text)]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <DragScrollArea className="mb-3 pb-1">
                  <button
                    type="button"
                    onClick={() => setScheduledCategoryFilter("all")}
                    aria-pressed={scheduledCategoryFilter === "all"}
                    className="shrink-0 rounded-full border px-4 py-1 text-[14px] font-medium transition"
                    style={
                      scheduledCategoryFilter === "all"
                        ? {
                            backgroundColor: "var(--ui-badge-neutral-bg)",
                            borderColor: "var(--ui-badge-neutral-border)",
                            color: "var(--ui-badge-neutral-text)",
                          }
                        : {
                            backgroundColor: "#CBD7E9",
                            borderColor: "#CBD7E9",
                            color: "white",
                          }
                    }
                  >
                    All
                  </button>
                  {scheduledCategoryOptions.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setScheduledCategoryFilter(category.id)}
                      aria-pressed={scheduledCategoryFilter === category.id}
                      className="shrink-0 rounded-full border px-4 py-1 text-[14px] font-medium transition"
                      style={
                        scheduledCategoryFilter === category.id
                          ? {
                              backgroundColor: "var(--ui-badge-neutral-bg)",
                              borderColor: category.color,
                              color: category.color,
                            }
                          : {
                              backgroundColor: category.color,
                              borderColor: category.color,
                              color: "white",
                            }
                      }
                      >
                        {category.name}
                      </button>
                    ))}
                </DragScrollArea>

                <div className="space-y-2">
                  {visibleScheduledItems.length ? (
                    visibleScheduledItems.map((todo) => {
                      const category = getTodoCategoryMeta(todo, categoryMetaLookup);
                      const { label: offsetLabel, isOverdue, isDateOnlyOverdue } = getScheduledOffsetMeta(
                        todo.scheduledDate,
                        todo.scheduledTime,
                      );
                      const isAutoDeleting = Boolean(scheduledAutoDeleteMap[todo._id]);
                      const isChecked = todo.isCompleted || isAutoDeleting;

                      return (
                        <div key={todo._id} className="flex items-center gap-2">
                          <p
                            className={`w-[56px] shrink-0 text-right text-[12px] ${
                              isOverdue ? "font-medium" : ""
                            }`}
                            style={{ color: isOverdue ? "#FF3B30" : "var(--text-muted)" }}
                          >
                            {offsetLabel}
                          </p>

                          <button
                            type="button"
                            onClick={() => handleTodoClickDelete(todo._id)}
                            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2 bg-[var(--ui-checkbox-bg)]"
                            style={{ borderColor: category.color || "#38A8E8" }}
                            aria-label={
                              isAutoDeleting ? `Cancel delete for ${todo.text}` : `Delete ${todo.text} after 3 seconds`
                            }
                          >
                            {isChecked ? (
                              <span
                                className="size-2.5 rounded-full"
                                style={{ backgroundColor: category.color || "#38A8E8" }}
                              />
                            ) : null}
                          </button>

                          <p
                            className={`font-poppins min-w-0 flex-1 truncate text-[18px] leading-[120%] ${
                              isChecked
                                ? "text-[var(--text-muted)] line-through"
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
                            <div className="flex shrink-0 items-center gap-1 text-[var(--text-muted)]">
                              <span className="inline-flex items-center justify-center rounded-full border-[1.1px] border-[var(--border)] p-[2px]">
                                <Bell
                                  className={`size-4 cursor-pointer ${
                                    hasTodoAlarmConfigured(todo) ? "opacity-100" : "opacity-35"
                                  }`}
                                />
                              </span>
                              <span className="inline-flex items-center justify-center rounded-full border-[1.1px] border-[var(--border)] p-[2px]">
                                <Repeat2 className={`size-4 cursor-pointer ${todo.repeat ? "opacity-100" : "opacity-35"}`} />
                              </span>
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
              <EmptyState title="No todo" description="Create todo from a category to see it here." />
            )}
          </aside>

          <div className="space-y-4">
            {categoriesQuery.isLoading ? (
              <SectionLoading rows={8} />
            ) : paged.items.length ? (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {paged.items.map((category) => (
                    <CategoryCard
                      key={category._id}
                      category={category}
                      pendingDeleteMap={scheduledAutoDeleteMap}
                      use24Hour={preferences.use24Hour}
                      onOpen={(categoryId) => {
                        setSelectedCategoryId(categoryId);
                        setCategoryDetailOpen(true);
                      }}
                      onCreateTodoRequest={openCreateTodoEditor}
                      onEditTodoRequest={openEditTodoEditor}
                      onDeleteTodoRequest={(todoId) => {
                        setDeleteTargetTodoId(todoId);
                        setDeleteConfirmOpen(true);
                      }}
                      onEditCategoryRequest={openEditCategoryDialog}
                      onDeleteCategoryRequest={(categoryId) => {
                        setDeleteTargetCategoryId(categoryId);
                        setDeleteCategoryConfirmOpen(true);
                      }}
                      onTodoClick={handleTodoClickDelete}
                    />
                  ))}
                </div>
                <PaginationControls page={paged.page} totalPages={paged.totalPages} onPageChange={setPage} />
              </>
            ) : (
              <EmptyState title="No categories" description="Click + to create your first category." />
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
