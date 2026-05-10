"use client";

import * as React from "react";
import { format } from "date-fns";
import { Bell, Plus, Repeat2, SlidersHorizontal, Trash2 } from "lucide-react";

import { useAppState } from "@/components/providers/app-state-provider";
import { TodoStatusCircleButton } from "@/components/shared/todo-status-circle";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import type { TodoItem } from "@/lib/api";
import { formatTimeStringByPreference } from "@/lib/time-format";

type SelectedCategory = {
  _id: string;
  name: string;
  color: string;
} | null;

type CategoryDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCategory: SelectedCategory;
  selectedCategoryItems: TodoItem[];
  pendingDeleteMap: Record<string, true>;
  onToggleTodo: (todoId: string) => void;
  onEditTodo: (todoId: string) => void;
  onDeleteTodo: (todoId: string) => void;
  onQuickAddTodo?: (categoryId: string, text: string) => void;
};

export function CategoryDetailDialog({
  open,
  onOpenChange,
  selectedCategory,
  selectedCategoryItems,
  pendingDeleteMap,
  onToggleTodo,
  onEditTodo,
  onDeleteTodo,
  onQuickAddTodo,
}: CategoryDetailDialogProps) {
  const { preferences } = useAppState();
  const [newTodoText, setNewTodoText] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setNewTodoText("");
    }
  }, [open]);

  const submitNewTodo = () => {
    const trimmed = newTodoText.trim();
    if (!trimmed || !selectedCategory || !onQuickAddTodo) {
      return;
    }
    onQuickAddTodo(selectedCategory._id, trimmed);
    setNewTodoText("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-[820px] flex-col rounded-[30px] p-4 text-[var(--text-default)] sm:p-5">
        <div className="flex min-h-0 flex-1 flex-col space-y-3">
          <p
            className="font-poppins text-[28px] leading-[120%] font-semibold"
            style={{ color: selectedCategory?.color || "#EE8C0D" }}
          >
            {selectedCategory?.name || "Category"}
          </p>

          <div className="flex min-h-0 flex-1 flex-col rounded-[30px] border border-[var(--border)] bg-[var(--surface-2)] p-3 sm:p-4">
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {selectedCategoryItems.map((item) => {
                const isPendingDelete = Boolean(pendingDeleteMap[item._id]);
                const isChecked = item.isCompleted || isPendingDelete;
                const scheduleParts: string[] = [];

                if (item.scheduledDate) {
                  const parsedDate = new Date(item.scheduledDate);

                  if (!Number.isNaN(parsedDate.getTime())) {
                    scheduleParts.push(format(parsedDate, "EEE, dd MMM yyyy"));
                  }
                }

                if (item.scheduledTime) {
                  scheduleParts.push(
                    formatTimeStringByPreference(
                      item.scheduledTime,
                      preferences.use24Hour,
                    ),
                  );
                }

                const scheduleLine = scheduleParts.join(" • ");

                return (
                  <div key={item._id} className="flex items-start gap-2">
                    <TodoStatusCircleButton
                      checked={isChecked}
                      checkedColor={selectedCategory?.color || "#7DC97E"}
                      onClick={() => onToggleTodo(item._id)}
                      aria-label={
                        isPendingDelete ? `Cancel delete for ${item.text}` : `Delete ${item.text} after 3 seconds`
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-[24px] leading-[120%] sm:text-[24px] ${
                          isChecked ? "text-[var(--text-muted)]" : "text-[var(--text-default)]"
                        }`}
                      >
                        {item.text}
                      </span>
                      {scheduleLine ? (
                        <p className="mt-1 truncate text-[12px] leading-none text-[var(--text-muted)]">
                          {scheduleLine.replace(/\s*[^\x20-\x7E]+\s*/g, " | ")}
                        </p>
                      ) : null}
                    </div>
                    {isChecked ? (
                      <button
                        type="button"
                        className="inline-flex items-center justify-center text-[var(--text-muted)]"
                        aria-label={`Delete ${item.text}`}
                        onClick={() => onDeleteTodo(item._id)}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 pt-0.5 text-[var(--text-muted)]">
                        {item.alarm ? <Bell className="size-4" /> : null}
                        {item.repeat ? <Repeat2 className="size-4" /> : null}
                        <button
                          type="button"
                          className="inline-flex items-center justify-center"
                          aria-label={`Edit ${item.text}`}
                          onClick={() => onEditTodo(item._id)}
                        >
                          <SlidersHorizontal className="size-4" />
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center"
                          aria-label={`Delete ${item.text}`}
                          onClick={() => onDeleteTodo(item._id)}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {onQuickAddTodo ? (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    aria-label="Add new todo"
                    onClick={submitNewTodo}
                    className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--border)] text-[var(--text-muted)] transition hover:bg-[var(--surface-1)] hover:text-[var(--text-default)]"
                    style={{ color: selectedCategory?.color || undefined }}
                  >
                    <Plus className="size-3.5" />
                  </button>
                  <input
                    type="text"
                    value={newTodoText}
                    onChange={(event) => setNewTodoText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        submitNewTodo();
                      }
                    }}
                    placeholder="New todo"
                    aria-label={`Add todo to ${selectedCategory?.name ?? "category"}`}
                    className="font-poppins flex-1 border-none bg-transparent text-[18px] text-[var(--text-default)] placeholder:text-[var(--text-muted)] focus:outline-none"
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
