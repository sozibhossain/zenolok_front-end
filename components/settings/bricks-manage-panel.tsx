"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { BrickIcon } from "@/components/shared/brick-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { brickApi, paginateArray, type Brick } from "@/lib/api";
import { brickIconOptions } from "@/lib/brick-icons";
import { colorPalette } from "@/lib/presets";
import { queryKeys } from "@/lib/query-keys";

const defaultBrickForm = {
  name: "",
  color: "#F7C700",
  icon: "work",
};

export function BricksManagePanel() {
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingBrick, setEditingBrick] = React.useState<Brick | null>(null);
  const [name, setName] = React.useState(defaultBrickForm.name);
  const [color, setColor] = React.useState(defaultBrickForm.color);
  const [icon, setIcon] = React.useState(defaultBrickForm.icon);

  const bricksQuery = useQuery({
    queryKey: queryKeys.bricks,
    queryFn: brickApi.getAll,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) {
        throw new Error("Brick name is required");
      }

      const payload = {
        name: name.trim(),
        color,
        icon,
      };

      if (editingBrick) {
        return brickApi.update(editingBrick._id, payload);
      }

      return brickApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bricks });
      toast.success(editingBrick ? "Brick updated" : "Brick created");
      setDialogOpen(false);
      setEditingBrick(null);
      setName(defaultBrickForm.name);
      setColor(defaultBrickForm.color);
      setIcon(defaultBrickForm.icon);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to save brick"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!editingBrick) {
        throw new Error("No brick selected");
      }

      return brickApi.delete(editingBrick._id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bricks });
      toast.success("Brick deleted");
      setDialogOpen(false);
      setEditingBrick(null);
      setName(defaultBrickForm.name);
      setColor(defaultBrickForm.color);
      setIcon(defaultBrickForm.icon);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete brick"),
  });

  const bricks = React.useMemo(() => bricksQuery.data || [], [bricksQuery.data]);
  const paged = React.useMemo(() => paginateArray(bricks, page, 12), [bricks, page]);

  React.useEffect(() => {
    setPage(1);
  }, [bricks.length]);

  const openCreateDialog = () => {
    setEditingBrick(null);
    setName(defaultBrickForm.name);
    setColor(defaultBrickForm.color);
    setIcon(defaultBrickForm.icon);
    setDialogOpen(true);
  };

  const openEditDialog = (brick: Brick) => {
    setEditingBrick(brick);
    setName(brick.name);
    setColor(brick.color);
    setIcon(brick.icon || "layout-grid");
    setDialogOpen(true);
  };

  const previewLabel = name.trim() || "Work";

  return (
    <div>
      <div className="mb-5 flex items-center justify-end">
        <Button
          type="button"
          className="bricks-add-button font-poppins h-12 rounded-2xl bg-[#36A9E1] px-5 text-[20px] leading-[120%] font-medium text-white hover:bg-[#2a98cd]"
          onClick={openCreateDialog}
        >
          <Plus className="size-4" />
          Add
        </Button>
      </div>

      {bricksQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-[#DDE2EB] bg-white p-4">
              <Skeleton className="h-9 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : paged.items.length ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {paged.items.map((brick) => (
              <button
                key={brick._id}
                type="button"
                onClick={() => openEditDialog(brick)}
                className="brick-manage-card group flex min-h-[74px] items-center justify-between rounded-3xl px-4 py-3 text-left text-white shadow-[0_10px_24px_rgba(15,18,28,0.18)] transition hover:translate-y-[-1px]"
                style={{ backgroundColor: brick.color }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <BrickIcon name={brick.icon} className="size-7 shrink-0" />
                  <span className="font-poppins truncate text-[24px] leading-[120%] font-semibold sm:text-[32px]">{brick.name}</span>
                </div>
                <Pencil className="size-5 opacity-75 transition group-hover:opacity-100" />
              </button>
            ))}
          </div>
          <PaginationControls page={paged.page} totalPages={paged.totalPages} onPageChange={setPage} />
        </>
      ) : (
        <EmptyState title="No bricks found" description="Create your first brick to organize events and todos." />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="brick-manage-dialog max-w-4xl rounded-[28px] border border-[#DCE2ED] bg-[#F5F7FB] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="font-poppins text-[32px] leading-[120%] font-semibold text-[#2A2E36]">
              {editingBrick ? "Edit Brick" : "New Brick"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <div className="brick-manage-preview inline-flex min-w-[180px] items-center justify-center gap-2 rounded-full px-5 py-2 text-white" style={{ backgroundColor: color }}>
                <BrickIcon name={icon} className="size-5" />
                <span className="font-poppins text-[24px] leading-[120%] font-semibold sm:text-[32px]">{previewLabel}</span>
              </div>
            </div>

            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Brick name"
              className="h-12 rounded-xl bg-white font-poppins text-[20px] leading-[120%] font-medium"
            />

            <div className="brick-palette-box rounded-3xl border border-[#DFE4EE] bg-[#EEF2F8] p-3 sm:p-4">
              <div className="grid grid-cols-10 gap-2 sm:gap-3">
                {colorPalette.map((paletteColor) => (
                  <button
                    key={paletteColor}
                    type="button"
                    onClick={() => setColor(paletteColor)}
                    className={`size-8 rounded-full border-2 transition sm:size-10 ${
                      color === paletteColor ? "border-[#262B34] scale-[1.05]" : "border-transparent"
                    }`}
                    style={{ backgroundColor: paletteColor }}
                    aria-label={`Select ${paletteColor} color`}
                  />
                ))}
              </div>
            </div>

            <div className="brick-icons-box rounded-3xl border border-[#DFE4EE] bg-[#EEF2F8] p-3 sm:p-4">
              <div className="grid grid-cols-8 gap-2 sm:grid-cols-10 sm:gap-2.5">
                {brickIconOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setIcon(option.value)}
                    className={`flex h-9 items-center justify-center rounded-xl border transition sm:h-10 ${
                      icon === option.value
                        ? "border-[#36A9E1] bg-[#DDECFF] text-[#1B5FB8]"
                        : "border-transparent bg-white text-[#5A6070] hover:border-[#C8D0E0]"
                    }`}
                    aria-label={option.label}
                    title={option.label}
                  >
                    <option.Icon className="size-4 sm:size-5" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-2 flex gap-2 sm:justify-between">
            {editingBrick ? (
              <Button
                type="button"
                variant="destructive"
                className="font-poppins h-11 rounded-xl px-5 text-[20px] leading-[120%] font-medium"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="size-4" />
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            ) : (
              <div />
            )}

            <Button
              type="button"
              className="font-poppins h-11 rounded-xl px-6 text-[20px] leading-[120%] font-medium"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              <Check className="size-4" />
              {saveMutation.isPending ? "Saving..." : editingBrick ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
