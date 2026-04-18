"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { EventTodo } from "@/lib/api";

type TodoSectionProps = {
  todos: EventTodo[];
  title: string;
  inputValue: string;
  onInputChange: (value: string) => void;
  onAdd: () => void;
  onToggle: (todo: EventTodo) => void;
  onDelete: (todoId: string) => void;
  onReorder: (todoIds: string[]) => Promise<void> | void;
  accentColor?: string;
};

const iconButtonClass =
  "inline-flex size-7 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--surface-1)] hover:text-[var(--text-strong)]";

const sortTodos = (items: EventTodo[]) =>
  [...items].sort((left, right) => {
    const leftOrder = left.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.sortOrder ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return (
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    );
  });

export function TodoSection({
  todos,
  title,
  inputValue,
  onInputChange,
  onAdd,
  onToggle,
  onDelete,
  onReorder,
  accentColor = "#7DC97E",
}: TodoSectionProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const sortedTodos = React.useMemo(() => sortTodos(todos), [todos]);
  const todoLookup = React.useMemo(
    () => new Map(sortedTodos.map((todo) => [todo._id, todo])),
    [sortedTodos],
  );
  const [orderedIds, setOrderedIds] = React.useState<string[]>(() =>
    sortedTodos.map((todo) => todo._id),
  );
  const [draggingTodoId, setDraggingTodoId] = React.useState<string | null>(
    null,
  );

  React.useEffect(() => {
    setOrderedIds(sortedTodos.map((todo) => todo._id));
  }, [sortedTodos]);

  const orderedTodos = React.useMemo(
    () =>
      orderedIds
        .map((todoId) => todoLookup.get(todoId))
        .filter((todo): todo is EventTodo => Boolean(todo)),
    [orderedIds, todoLookup],
  );

  const visibleTodos = orderedTodos.slice(0, 5);
  const hiddenCount = Math.max(0, orderedTodos.length - visibleTodos.length);

  const handleAddTodo = () => {
    if (!inputValue.trim()) {
      inputRef.current?.focus();
      return;
    }

    onAdd();
  };

  const moveTodo = async (targetTodoId: string) => {
    if (!draggingTodoId || draggingTodoId === targetTodoId) {
      return;
    }

    const nextIds = [...orderedIds];
    const draggingIndex = nextIds.indexOf(draggingTodoId);
    const targetIndex = nextIds.indexOf(targetTodoId);

    if (draggingIndex === -1 || targetIndex === -1) {
      return;
    }

    nextIds.splice(draggingIndex, 1);
    nextIds.splice(targetIndex, 0, draggingTodoId);
    setOrderedIds(nextIds);
    await onReorder(nextIds);
  };

  return (
    <Card className="w-full overflow-hidden rounded-[22px] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-[var(--text-default)] shadow-none">
      <div className="space-y-2">
        {visibleTodos.map((todo) => (
          <div
            key={todo._id}
            draggable
            onDragStart={() => setDraggingTodoId(todo._id)}
            onDragEnd={() => setDraggingTodoId(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void moveTodo(todo._id);
            }}
            className={`group flex items-center gap-3 rounded-[12px] px-1 py-1.5 ${
              draggingTodoId === todo._id ? "opacity-60" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => onToggle(todo)}
              className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2 bg-[var(--ui-checkbox-bg)]"
              style={{ borderColor: accentColor }}
              aria-label={
                todo.isCompleted
                  ? `Mark ${todo.text} as unfinished`
                  : `Mark ${todo.text} as finished`
              }
            >
              {todo.isCompleted ? (
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: accentColor }}
                />
              ) : null}
            </button>

            <p
              className={`min-w-0 flex-1 truncate text-[14px] leading-[140%] ${
                todo.isCompleted
                  ? "text-[var(--text-muted)] opacity-60"
                  : "text-[var(--text-default)]"
              }`}
            >
              {todo.text}
            </p>

            <button
              type="button"
              onClick={() => onDelete(todo._id)}
              className={`${iconButtonClass} opacity-0 group-hover:opacity-100`}
              aria-label={`Delete ${todo.text}`}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}

        {hiddenCount > 0 ? (
          <p className="pl-8 text-[13px] leading-none text-[var(--text-muted)]">
            +{hiddenCount}
          </p>
        ) : null}

        <div className={orderedTodos.length ? "pt-1" : ""}>
          <div className="flex items-center gap-2 border-b border-[var(--border)]">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleAddTodo();
                }
              }}
              placeholder={title}
              className="h-8 rounded-none border-none bg-transparent px-0 text-[14px] shadow-none placeholder:text-[var(--text-muted)] focus-visible:ring-0"
            />
            <button
              type="button"
              onClick={handleAddTodo}
              disabled={!inputValue.trim()}
              className={`${iconButtonClass} text-[#FF3B30] disabled:opacity-35`}
              aria-label="Add todo"
            >
              <Plus className="size-4 stroke-[3px]" />
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
