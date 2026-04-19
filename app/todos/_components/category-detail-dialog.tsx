"use client";

import { format } from "date-fns";
import { Bell, CalendarDays, Clock3, Repeat2, SlidersHorizontal, Trash2 } from "lucide-react";

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
}: CategoryDetailDialogProps) {
  const { preferences } = useAppState();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[820px] rounded-[30px] p-4 text-[var(--text-default)] sm:p-5">
        <div className="space-y-3">
          <p
            className="font-poppins text-[28px] leading-[120%] font-semibold"
            style={{ color: selectedCategory?.color || "#EE8C0D" }}
          >
            {selectedCategory?.name || "Category"}
          </p>

          <div className="rounded-[30px] border border-[var(--border)] bg-[var(--surface-2)] p-3 sm:p-4">
            <div className="space-y-2">
              {selectedCategoryItems.map((item) => {
                const isPendingDelete = Boolean(pendingDeleteMap[item._id]);
                const isChecked = item.isCompleted || isPendingDelete;

                return (
                  <div key={item._id} className="flex items-center gap-2">
                    <TodoStatusCircleButton
                      checked={isChecked}
                      checkedColor={selectedCategory?.color || "#7DC97E"}
                      onClick={() => onToggleTodo(item._id)}
                      aria-label={
                        isPendingDelete ? `Cancel delete for ${item.text}` : `Delete ${item.text} after 3 seconds`
                      }
                    />
                    <span
                      className={`flex-1 truncate text-[24px] leading-[120%] sm:text-[24px] ${
                        isChecked ? "text-[var(--text-muted)]" : "text-[var(--text-default)]"
                      }`}
                    >
                      {item.text}
                    </span>
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
                      <div className="flex items-center gap-1 text-[var(--text-muted)]">
                        {item.scheduledDate ? (
                          <span className="inline-flex items-center gap-1 text-[11px] leading-none">
                            <CalendarDays className="size-4" />
                            {format(new Date(item.scheduledDate), "dd MMM")}
                          </span>
                        ) : null}
                        {item.scheduledTime ? (
                          <span className="inline-flex items-center gap-1 text-[11px] leading-none">
                            <Clock3 className="size-4" />
                            {formatTimeStringByPreference(
                              item.scheduledTime,
                              preferences.use24Hour,
                            )}
                          </span>
                        ) : null}
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
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
