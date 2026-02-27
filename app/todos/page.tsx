"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endOfMonth, format, formatDistanceToNowStrict, startOfMonth } from "date-fns";
import { CalendarClock, Plus } from "lucide-react";
import { toast } from "sonner";

import { useAppState } from "@/components/providers/app-state-provider";
import { BrickIcon } from "@/components/shared/brick-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { SectionLoading } from "@/components/shared/section-loading";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  brickApi,
  paginateArray,
  todoItemApi,
  todoCategoryApi,
  type TodoCategory,
  type TodoItem,
} from "@/lib/api";
import { brickIconOptions } from "@/lib/brick-icons";
import { colorPalette } from "@/lib/presets";
import { queryKeys } from "@/lib/query-keys";

interface CategoryWithItems extends TodoCategory {
  items: TodoItem[];
}

function CategoryCard({
  category,
  onCreateTodo,
  onToggle,
}: {
  category: CategoryWithItems;
  onCreateTodo: (payload: { categoryId: string; text: string }) => void;
  onToggle: (payload: { id: string; isCompleted: boolean }) => void;
}) {
  const [newText, setNewText] = React.useState("");

  const unfinished = (category.items || []).filter((item) => !item.isCompleted);

  return (
    <div className="rounded-[26px] border border-[#D7DCE6] bg-[#F7F9FC] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-poppins text-[32px] leading-[120%] font-semibold" style={{ color: category.color }}>
          {category.name}
        </h3>
        <span
          className="font-poppins inline-flex min-w-[26px] items-center justify-center rounded-full px-1.5 py-0.5 text-[14px] leading-[120%] font-medium text-white"
          style={{ backgroundColor: category.color }}
        >
          {unfinished.length}
        </span>
      </div>

      <div className="space-y-2">
        {unfinished.slice(0, 3).map((item) => (
          <label key={item._id} className="flex items-center gap-2 text-[18px] text-[#3D4351]">
            <input
              type="checkbox"
              checked={item.isCompleted}
              onChange={() => onToggle({ id: item._id, isCompleted: !item.isCompleted })}
              className="size-4 rounded-full border border-[#A3ABBC]"
            />
            <span className="truncate">{item.text}</span>
          </label>
        ))}
      </div>

      <form
        className="mt-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!newText.trim()) {
            return;
          }
          onCreateTodo({ categoryId: category._id, text: newText.trim() });
          setNewText("");
        }}
      >
        <Input
          value={newText}
          onChange={(event) => setNewText(event.target.value)}
          placeholder="New todo"
          className="h-9 rounded-lg border-none bg-transparent px-0 text-[16px] text-[#5C6475] placeholder:text-[#A8AFBE]"
        />
      </form>

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
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [newCategoryColor, setNewCategoryColor] = React.useState("#F7C700");
  const [newCategoryIcon, setNewCategoryIcon] = React.useState("work");
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

  const createCategoryMutation = useMutation({
    mutationFn: async () => {
      if (!newCategoryName.trim()) {
        throw new Error("Category name is required");
      }

      const categoryName = newCategoryName.trim();

      await Promise.all([
        todoCategoryApi.create({
          name: categoryName,
          color: newCategoryColor,
        }),
        brickApi.create({
          name: categoryName,
          color: newCategoryColor,
          icon: newCategoryIcon,
        }),
      ]);
    },
    onSuccess: () => {
      toast.success("Category added");
      setAddOpen(false);
      setNewCategoryName("");
      setNewCategoryColor("#F7C700");
      setNewCategoryIcon("work");
      queryClient.invalidateQueries({ queryKey: queryKeys.categoriesWithItems });
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
      queryClient.invalidateQueries({ queryKey: queryKeys.bricks });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create category"),
  });

  const categories = React.useMemo(
    () => ((categoriesQuery.data || []) as CategoryWithItems[]),
    [categoriesQuery.data]
  );

  const paged = React.useMemo(() => paginateArray(categories, page, 6), [categories, page]);

  React.useEffect(() => {
    setPage(1);
  }, [categories.length]);

  return (
    <div className="space-y-4">
      <section className="rounded-[30px] border border-[#E0E4EC] bg-[#F4F6FA] p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-end">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="flex size-16 items-center justify-center rounded-2xl border-2 border-dashed border-[#BEC6D7] text-[#8C94A6] transition hover:bg-[#ECF1F9]"
                aria-label="Add category"
              >
                <Plus className="size-7" />
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl rounded-[30px] border border-[#DAE0EB] bg-[#F5F7FC] p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle className="text-center text-[40px]">New Category</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="mx-auto inline-flex items-center gap-2 rounded-full px-4 py-2 text-white" style={{ backgroundColor: newCategoryColor }}>
                  <BrickIcon name={newCategoryIcon} className="size-5" />
                  <span className="font-poppins text-[32px] leading-[120%] font-semibold">
                    {newCategoryName.trim() || "Work"}
                  </span>
                </div>

                <Input
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  placeholder="Category name"
                  className="h-12"
                />

                <div className="rounded-3xl border border-[#DEE4EF] bg-[#EEF2F8] p-4">
                  <div className="grid grid-cols-10 gap-2 sm:gap-3">
                    {colorPalette.map((color) => (
                      <button
                        type="button"
                        key={color}
                        onClick={() => setNewCategoryColor(color)}
                        className={`size-8 rounded-full border-2 sm:size-10 ${
                          newCategoryColor === color ? "border-[#283040]" : "border-transparent"
                        }`}
                        style={{ backgroundColor: color }}
                        aria-label={`Select ${color}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-[#DEE4EF] bg-[#EEF2F8] p-4">
                  <div className="grid grid-cols-8 gap-2 sm:grid-cols-10 sm:gap-2.5">
                    {brickIconOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setNewCategoryIcon(option.value)}
                        className={`flex h-9 items-center justify-center rounded-xl border sm:h-10 ${
                          newCategoryIcon === option.value
                            ? "border-[#36A9E1] bg-[#DDEBFF] text-[#1A63BC]"
                            : "border-transparent bg-white text-[#5A6273] hover:border-[#CBD3E3]"
                        }`}
                        title={option.label}
                        aria-label={option.label}
                      >
                        <option.Icon className="size-4 sm:size-5" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter className="mt-2">
                <Button
                  type="button"
                  className="font-poppins h-11 rounded-xl px-6 text-[20px] leading-[120%] font-medium"
                  onClick={() => createCategoryMutation.mutate()}
                  disabled={createCategoryMutation.isPending}
                >
                  {createCategoryMutation.isPending ? "Adding..." : "Add"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
                      onCreateTodo={({ categoryId, text }) =>
                        createTodoMutation.mutate({
                          categoryId,
                          text,
                        })
                      }
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
    </div>
  );
}
