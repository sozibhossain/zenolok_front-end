"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endOfMonth, format, formatDistanceToNowStrict, startOfMonth } from "date-fns";
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
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { SectionLoading } from "@/components/shared/section-loading";
import {
  paginateArray,
  todoItemApi,
  todoCategoryApi,
  type TodoCategory,
  type TodoItem,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { AddCategoryDialog } from "./_components/add-category-dialog";
import { CategoryDetailDialog } from "./_components/category-detail-dialog";
import { DeleteConfirmDialog } from "./_components/delete-confirm-dialog";
import {
  TodoEditorDialog,
  type RepeatValue,
  type TodoEditorMode,
} from "./_components/todo-editor-dialog";

interface CategoryWithItems extends TodoCategory {
  items: TodoItem[];
}

function toDateInputValue(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function toLocalDateTimeInputValue(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
}

function CategoryCard({
  category,
  onToggle,
  onOpen,
  onCreateTodoRequest,
  onEditTodoRequest,
  onEditCategoryRequest,
  onDeleteCategoryRequest,
}: {
  category: CategoryWithItems;
  onToggle: (payload: { id: string; isCompleted: boolean }) => void;
  onOpen: (categoryId: string) => void;
  onCreateTodoRequest: (categoryId: string) => void;
  onEditTodoRequest: (categoryId: string, todoId: string) => void;
  onEditCategoryRequest: (category: CategoryWithItems) => void;
  onDeleteCategoryRequest: (categoryId: string) => void;
}) {
  const unfinished = (category.items || []).filter((item) => !item.isCompleted);

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
      className="rounded-[26px] border border-[#D7DCE6] bg-[#F7F9FC] p-4 transition hover:border-[#C7CEDD]"
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
        {unfinished.slice(0, 3).map((item) => (
          <div key={item._id} className="flex items-center gap-2 text-[18px] text-[#3D4351]">
            <input
              type="checkbox"
              checked={item.isCompleted}
              onClick={(event) => event.stopPropagation()}
              onChange={() => onToggle({ id: item._id, isCompleted: !item.isCompleted })}
              className="size-4 rounded-full border border-[#A3ABBC]"
            />
            <span className="flex-1 truncate">{item.text}</span>
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
                  {item.scheduledTime}
                </span>
              ) : null}
              {item.alarm ? <Bell className="size-3.5" /> : null}
              {item.repeat ? <Repeat2 className="size-3.5" /> : null}
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
          </div>
        ))}
      </div>

      <button
        type="button"
        className="mt-3 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[13px] text-[#7D8596]"
        onClick={(event) => {
          event.stopPropagation();
          onCreateTodoRequest(category._id);
        }}
      >
        <Plus className="size-3.5" />
        Add todo
      </button>

      {unfinished.length > 3 ? (
        <p className="font-poppins mt-1 text-[14px] leading-[120%] text-[#9AA2B2]">+{unfinished.length - 3}</p>
      ) : null}
    </div>
  );
}

export default function TodosPage() {
  const queryClient = useQueryClient();
  const { monthCursor } = useAppState();

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
  const [alarmEnabled, setAlarmEnabled] = React.useState(false);
  const [repeatEnabled, setRepeatEnabled] = React.useState(false);
  const [scheduledDateInput, setScheduledDateInput] = React.useState("");
  const [scheduledTimeInput, setScheduledTimeInput] = React.useState("");
  const [alarmDateTimeInput, setAlarmDateTimeInput] = React.useState("");
  const [repeatValue, setRepeatValue] = React.useState<RepeatValue>("daily");
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [newCategoryColor, setNewCategoryColor] = React.useState("#F7C700");
  const monthStart = React.useMemo(() => format(startOfMonth(monthCursor), "yyyy-MM-dd"), [monthCursor]);
  const monthEnd = React.useMemo(() => format(endOfMonth(monthCursor), "yyyy-MM-dd"), [monthCursor]);

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categoriesWithItems,
    queryFn: todoItemApi.getCategoriesWithItems,
  });

  const scheduledQuery = useQuery({
    queryKey: queryKeys.scheduledTodos({ status: "unfinished", startDate: monthStart, endDate: monthEnd }),
    queryFn: () => todoItemApi.getScheduled({ status: "unfinished", startDate: monthStart, endDate: monthEnd }),
  });

  const createTodoMutation = useMutation({
    mutationFn: todoItemApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categoriesWithItems });
      queryClient.invalidateQueries({ queryKey: ["scheduled-todos"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to add todo"),
  });

  const toggleTodoMutation = useMutation({
    mutationFn: ({ id, isCompleted }: { id: string; isCompleted: boolean }) =>
      todoItemApi.update(id, { isCompleted }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categoriesWithItems });
      queryClient.invalidateQueries({ queryKey: ["scheduled-todos"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update todo"),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categoriesWithItems });
      queryClient.invalidateQueries({ queryKey: ["scheduled-todos"] });
      toast.success("Todo deleted");
      setDeleteConfirmOpen(false);
      setDeleteTargetTodoId(null);
      setTodoEditorOpen(false);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete todo"),
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

  const categories = React.useMemo(
    () => ((categoriesQuery.data || []) as CategoryWithItems[]),
    [categoriesQuery.data]
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

  React.useEffect(() => {
    setPage(1);
  }, [categories.length]);

  React.useEffect(() => {
    if (!todoEditorOpen) {
      return;
    }

    if (todoEditorMode === "create") {
      setTodoText("");
      setDateEnabled(false);
      setTimeEnabled(false);
      setAlarmEnabled(false);
      setRepeatEnabled(false);
      setScheduledDateInput("");
      setScheduledTimeInput("");
      setAlarmDateTimeInput("");
      setRepeatValue("daily");
      return;
    }

    if (!selectedTodo) {
      return;
    }

    setTodoText(selectedTodo.text || "");
    setDateEnabled(Boolean(selectedTodo.scheduledDate));
    setTimeEnabled(Boolean(selectedTodo.scheduledTime));
    setAlarmEnabled(Boolean(selectedTodo.alarm));
    setRepeatEnabled(Boolean(selectedTodo.repeat));
    setScheduledDateInput(toDateInputValue(selectedTodo.scheduledDate));
    setScheduledTimeInput(selectedTodo.scheduledTime || "");
    setAlarmDateTimeInput(toLocalDateTimeInputValue(selectedTodo.alarm));
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
          alarm:
            alarmEnabled && alarmDateTimeInput
              ? new Date(alarmDateTimeInput).toISOString()
              : null,
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
      alarm: alarmEnabled && alarmDateTimeInput ? new Date(alarmDateTimeInput).toISOString() : null,
      repeat: repeatEnabled ? repeatValue : null,
    };

    updateTodoMutation.mutate({ id: selectedTodoId, payload });
  }, [
    alarmDateTimeInput,
    alarmEnabled,
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
    deleteTodoMutation.mutate(deleteTargetTodoId);
  }, [deleteTargetTodoId, deleteTodoMutation]);
  const handleConfirmDeleteCategory = React.useCallback(() => {
    if (!deleteTargetCategoryId) {
      return;
    }
    deleteCategoryMutation.mutate(deleteTargetCategoryId);
  }, [deleteCategoryMutation, deleteTargetCategoryId]);

  return (
    <div className="space-y-4">
      <section className="rounded-[30px] border border-[#E0E4EC] bg-[#F4F6FA] p-4 sm:p-5">
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

        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-[26px] border border-[#D8DEE8] bg-[#F0F3F8] p-4">
            <h2 className="font-poppins mb-3 flex items-center gap-2 text-[20px] leading-[120%] font-medium text-[#2F3542]">
              <CalendarClock className="size-5" />
              Scheduled
            </h2>

            {scheduledQuery.isLoading ? (
              <SectionLoading rows={4} />
            ) : scheduledQuery.data?.length ? (
              <div className="space-y-2">
                {scheduledQuery.data.slice(0, 4).map((todo) => (
                  <div key={todo._id} className="rounded-xl bg-white px-3 py-2">
                    <p className="font-poppins text-[14px] leading-[120%] text-[#8D95A7]">
                      {todo.scheduledDate
                        ? formatDistanceToNowStrict(new Date(todo.scheduledDate), { addSuffix: true })
                        : "No date"}
                    </p>
                    <p className="font-poppins text-[20px] leading-[120%] font-medium text-[#3D4351]">{todo.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No scheduled" description="Set date from todo settings." />
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
                      onOpen={(categoryId) => {
                        setSelectedCategoryId(categoryId);
                        setCategoryDetailOpen(true);
                      }}
                      onCreateTodoRequest={openCreateTodoEditor}
                      onEditTodoRequest={openEditTodoEditor}
                      onEditCategoryRequest={openEditCategoryDialog}
                      onDeleteCategoryRequest={(categoryId) => {
                        setDeleteTargetCategoryId(categoryId);
                        setDeleteCategoryConfirmOpen(true);
                      }}
                      onToggle={({ id, isCompleted }) =>
                        toggleTodoMutation.mutate({ id, isCompleted })
                      }
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
        onToggleTodo={(todoId, nextCompleted) => {
          toggleTodoMutation.mutate({ id: todoId, isCompleted: nextCompleted });
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
        alarmEnabled={alarmEnabled}
        onAlarmEnabledChange={setAlarmEnabled}
        alarmDateTimeInput={alarmDateTimeInput}
        onAlarmDateTimeChange={setAlarmDateTimeInput}
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
