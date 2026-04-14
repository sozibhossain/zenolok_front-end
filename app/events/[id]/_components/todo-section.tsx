"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { EventTodo } from "@/lib/api";

const iconButtonClass =
  "flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-muted)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text-strong)]";
const subtleIconButtonClass = `${iconButtonClass} opacity-0 group-hover:opacity-100`;
const dangerIconButtonClass = `${iconButtonClass} opacity-0 group-hover:opacity-100 hover:border-[var(--ui-btn-danger-bg)] hover:bg-[var(--ui-btn-danger-bg)] hover:text-white`;
const activeIconButtonClass = `${iconButtonClass} text-[#34C759] hover:text-[#34C759]`;
const addIconButtonClass = `${iconButtonClass} text-[#FF3B30] hover:text-[#FF3B30] disabled:text-[var(--text-muted)] disabled:opacity-40`;

type TodoSectionProps = {
  todos: EventTodo[];
  title: string;
  inputValue: string;
  onInputChange: (value: string) => void;
  onAdd: () => void;
  onToggle: (todo: EventTodo) => void;
  onDelete: (todoId: string) => void;
  onAddSubnote: (todoId: string, text: string) => Promise<void>;
  onUpdateTodo: (todoId: string, text: string) => Promise<void>;
  onUpdateSubnote: (
    todoId: string,
    subnoteId: string,
    text: string,
  ) => Promise<void>;
};

export function TodoSection({
  todos,
  title,
  inputValue,
  onInputChange,
  onAdd,
  onToggle,
  onDelete,
  onAddSubnote,
  onUpdateTodo,
  onUpdateSubnote,
}: TodoSectionProps) {
  const [expandedTodoId, setExpandedTodoId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [subnoteDrafts, setSubnoteDrafts] = useState<Record<string, string>>({});
  const [submittingNoteTodoId, setSubmittingNoteTodoId] = useState<
    string | null
  >(null);

  const startEditing = (id: string, value: string) => {
    setEditingId(id);
    setEditValue(value);
  };

  const handleAddTodo = () => {
    if (!inputValue.trim()) {
      return;
    }

    onAdd();
  };

  const handleAddSubnote = async (todoId: string) => {
    const text = subnoteDrafts[todoId]?.trim();
    if (!text) {
      return;
    }

    setSubmittingNoteTodoId(todoId);
    try {
      await onAddSubnote(todoId, text);
      setSubnoteDrafts((previous) => ({ ...previous, [todoId]: "" }));
    } finally {
      setSubmittingNoteTodoId(null);
    }
  };

  const handleUpdateTodo = async (todoId: string) => {
    const text = editValue.trim();
    if (!text) {
      return;
    }

    await onUpdateTodo(todoId, text);
    setEditingId(null);
    setEditValue("");
  };

  const handleUpdateSubnote = async (todoId: string, subnoteId: string) => {
    const text = editValue.trim();
    if (!text) {
      return;
    }

    await onUpdateSubnote(todoId, subnoteId, text);
    setEditingId(null);
    setEditValue("");
  };

  return (
    <Card className="w-full overflow-hidden rounded-[22px] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-[var(--text-default)] shadow-none">
      <div className="space-y-3">
        {todos.map((todo) => {
          const expanded = expandedTodoId === todo._id;
          const editingTodo = editingId === todo._id;
          const draft = subnoteDrafts[todo._id] || "";
          const subnotes = todo.subnotes || [];

          return (
            <div key={todo._id} className="space-y-2">
              <div className="group flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onToggle(todo)}
                  className={`size-5 shrink-0 rounded-full border transition ${
                    todo.isCompleted
                      ? "border-[#34C759] bg-[#34C759]"
                      : "border-[#C9CDD4] bg-transparent"
                  }`}
                  aria-label={
                    todo.isCompleted
                      ? `Mark ${todo.text} incomplete`
                      : `Mark ${todo.text} complete`
                  }
                />

                {editingTodo ? (
                  <div className="flex min-w-0 flex-1 items-center gap-2 border-b border-[var(--border)]">
                    <Input
                      autoFocus
                      value={editValue}
                      onChange={(event) => setEditValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleUpdateTodo(todo._id);
                        }
                      }}
                      className="h-7 rounded-none border-none bg-transparent px-0 text-[14px] shadow-none focus-visible:ring-0"
                    />
                    <button
                      type="button"
                      onClick={() => void handleUpdateTodo(todo._id)}
                      className={activeIconButtonClass}
                      aria-label="Save todo"
                    >
                      <Check className="size-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedTodoId((previous) =>
                          previous === todo._id ? null : todo._id,
                        )
                      }
                      className={`min-w-0 flex-1 truncate text-left text-[14px] ${
                        todo.isCompleted
                          ? "text-[var(--text-muted)] line-through"
                          : "text-[var(--text-default)]"
                      }`}
                      aria-expanded={expanded}
                    >
                      {todo.text}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEditing(todo._id, todo.text)}
                      className={subtleIconButtonClass}
                      aria-label="Edit todo"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(todo._id)}
                      className={dangerIconButtonClass}
                      aria-label="Delete todo"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </>
                )}
              </div>

              {expanded ? (
                <div className="ml-8 space-y-2">
                  {subnotes.map((note) => {
                    const editingSubnote = editingId === note._id;

                    return (
                      <div key={note._id} className="group flex items-center gap-2">
                        {editingSubnote ? (
                          <div className="flex min-w-0 flex-1 items-center gap-2 border-b border-[var(--border)]">
                            <Input
                              autoFocus
                              value={editValue}
                              onChange={(event) => setEditValue(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void handleUpdateSubnote(todo._id, note._id);
                                }
                              }}
                              className="h-6 rounded-none border-none bg-transparent px-0 text-[13px] shadow-none focus-visible:ring-0"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                void handleUpdateSubnote(todo._id, note._id)
                              }
                              className={activeIconButtonClass}
                              aria-label="Save note"
                            >
                              <Check className="size-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="min-w-0 flex-1 text-[13px] leading-[140%] text-[var(--text-default)]">
                              {note.text}
                            </p>
                            <button
                              type="button"
                              onClick={() => startEditing(note._id, note.text)}
                              className={subtleIconButtonClass}
                              aria-label="Edit note"
                            >
                              <Pencil className="size-3" />
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}

                  <div className="flex items-center gap-2 border-b border-[var(--border)]">
                    <Input
                      value={draft}
                      onChange={(event) =>
                        setSubnoteDrafts((previous) => ({
                          ...previous,
                          [todo._id]: event.target.value,
                        }))
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleAddSubnote(todo._id);
                        }
                      }}
                      placeholder="New notes"
                      className="h-7 rounded-none border-none bg-transparent px-0 text-[13px] shadow-none placeholder:text-[var(--text-muted)] focus-visible:ring-0"
                    />
                    <button
                      type="button"
                      onClick={() => void handleAddSubnote(todo._id)}
                      disabled={!draft.trim() || submittingNoteTodoId === todo._id}
                      className={addIconButtonClass}
                      aria-label="Add note"
                    >
                      <Plus className="size-4 stroke-[3px]" />
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}

        <div className={todos.length ? "pt-1" : ""}>
          <div className="flex items-center gap-2 border-b border-[var(--border)]">
            <Input
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
              className={addIconButtonClass}
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
