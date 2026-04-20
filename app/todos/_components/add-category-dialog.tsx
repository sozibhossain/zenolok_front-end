"use client";

import type { ReactNode } from "react";
import { Plus } from "lucide-react";

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
import { colorPalette } from "@/lib/presets";

type AddCategoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newCategoryName: string;
  onNewCategoryNameChange: (value: string) => void;
  newCategoryColor: string;
  onNewCategoryColorChange: (value: string) => void;
  onCreate: () => void;
  isCreating: boolean;
  title?: string;
  submitLabel?: string;
  pendingLabel?: string;
  trigger?: ReactNode;
  showDefaultTrigger?: boolean;
};

export function AddCategoryDialog({
  open,
  onOpenChange,
  newCategoryName,
  onNewCategoryNameChange,
  newCategoryColor,
  onNewCategoryColorChange,
  onCreate,
  isCreating,
  title = "New Category",
  submitLabel = "Add",
  pendingLabel = "Adding...",
  trigger,
  showDefaultTrigger = true,
}: AddCategoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : showDefaultTrigger ? (
        <DialogTrigger asChild>
          <button
            type="button"
            className="flex size-16 items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] text-[var(--text-muted)] transition hover:bg-[var(--surface-3)]"
            aria-label="Add category"
          >
            <Plus className="size-7" />
          </button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-w-5xl rounded-[30px] border border-[var(--border)] bg-[var(--surface-1)] p-4 sm:p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-center text-[24px] text-[var(--text-strong)]">{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Input
              value={newCategoryName}
              onChange={(event) => onNewCategoryNameChange(event.target.value)}
              placeholder="Category name"
              className="h-12"
              style={{ color: newCategoryColor }}
            />
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(2rem,1fr))] justify-items-center gap-2 sm:grid-cols-10 sm:gap-3">
              {colorPalette.map((color) => (
                <button
                  type="button"
                  key={color}
                  onClick={() => onNewCategoryColorChange(color)}
                  className={`size-8 rounded-full border-2 sm:size-8 ${
                    newCategoryColor === color
                      ? "border-[var(--text-strong)]"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Select ${color}`}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button
            type="button"
            className="font-poppins h-11 rounded-xl px-6 text-[20px] leading-[120%] font-medium"
            onClick={onCreate}
            disabled={isCreating}
          >
            {isCreating ? pendingLabel : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
