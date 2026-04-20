"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Mail, Pencil, Plus, Trash2, X } from "lucide-react";
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

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function BricksManagePanel() {
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingBrickId, setEditingBrickId] = React.useState<string | null>(null);
  const [name, setName] = React.useState(defaultBrickForm.name);
  const [color, setColor] = React.useState(defaultBrickForm.color);
  const [icon, setIcon] = React.useState(defaultBrickForm.icon);
  const [inviteEmail, setInviteEmail] = React.useState("");

  const bricksQuery = useQuery({
    queryKey: queryKeys.bricks,
    queryFn: brickApi.getAll,
  });

  const brickDetailQuery = useQuery({
    queryKey: queryKeys.brick(editingBrickId || "new"),
    queryFn: () => brickApi.getById(editingBrickId as string),
    enabled: Boolean(editingBrickId) && dialogOpen,
  });

  const editingBrick: Brick | null = brickDetailQuery.data || null;

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

      if (editingBrickId) {
        return brickApi.update(editingBrickId, payload);
      }

      return brickApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bricks });
      toast.success(editingBrickId ? "Brick updated" : "Brick created");
      closeDialog();
    },
    onError: (error: Error) => toast.error(error.message || "Failed to save brick"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!editingBrickId) {
        throw new Error("No brick selected");
      }

      return brickApi.delete(editingBrickId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bricks });
      toast.success("Brick deleted");
      closeDialog();
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete brick"),
  });

  const refreshBrickDetail = React.useCallback(() => {
    if (editingBrickId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.brick(editingBrickId) });
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.bricks });
  }, [editingBrickId, queryClient]);

  const inviteMutation = useMutation({
    mutationFn: async (email: string) => {
      if (!editingBrickId) {
        throw new Error("Save the Brick first to invite collaborators");
      }
      return brickApi.inviteCollaborator(editingBrickId, email);
    },
    onSuccess: () => {
      toast.success("Invitation sent");
      setInviteEmail("");
      refreshBrickDetail();
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to send invitation"),
  });

  const revokeMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      if (!editingBrickId) {
        throw new Error("No brick selected");
      }
      return brickApi.revokeInvitation(editingBrickId, invitationId);
    },
    onSuccess: () => {
      toast.success("Invitation revoked");
      refreshBrickDetail();
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to revoke invitation"),
  });

  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!editingBrickId) {
        throw new Error("No brick selected");
      }
      return brickApi.removeCollaborator(editingBrickId, userId);
    },
    onSuccess: () => {
      toast.success("Collaborator removed");
      refreshBrickDetail();
    },
    onError: (error: Error) =>
      toast.error(error.message || "Failed to remove collaborator"),
  });

  const bricks = React.useMemo(() => bricksQuery.data || [], [bricksQuery.data]);
  const paged = React.useMemo(() => paginateArray(bricks, page, 12), [bricks, page]);

  React.useEffect(() => {
    setPage(1);
  }, [bricks.length]);

  const closeDialog = React.useCallback(() => {
    setDialogOpen(false);
    setEditingBrickId(null);
    setName(defaultBrickForm.name);
    setColor(defaultBrickForm.color);
    setIcon(defaultBrickForm.icon);
    setInviteEmail("");
  }, []);

  const openCreateDialog = () => {
    setEditingBrickId(null);
    setName(defaultBrickForm.name);
    setColor(defaultBrickForm.color);
    setIcon(defaultBrickForm.icon);
    setInviteEmail("");
    setDialogOpen(true);
  };

  const openEditDialog = (brick: Brick) => {
    setEditingBrickId(brick._id);
    setName(brick.name);
    setColor(brick.color);
    setIcon(brick.icon || "layout-grid");
    setInviteEmail("");
    setDialogOpen(true);
  };

  const handleInvite = () => {
    const trimmed = inviteEmail.trim().toLowerCase();
    if (!emailRegex.test(trimmed)) {
      toast.error("Please enter a valid email address");
      return;
    }
    inviteMutation.mutate(trimmed);
  };

  const previewLabel = name.trim() || "Work";
  const ownerId = editingBrick?.createdBy;
  const participantUsers = editingBrick?.participantUsers || [];
  const pendingInvitations = editingBrick?.pendingInvitations || [];

  return (
    <div>
      <div className="mb-5 flex items-center justify-end">
        <Button
          type="button"
          className="bricks-add-button font-poppins h-11 rounded-2xl bg-[#36A9E1] px-5 text-[20px] leading-[120%] font-medium text-white hover:bg-[#2a98cd]"
          onClick={openCreateDialog}
        >
          <Plus className="size-4" />
          Add
        </Button>
      </div>

      {bricksQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-4">
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
                className="brick-manage-card group flex items-center justify-between rounded-3xl px-4 py-4 text-left text-white shadow-[0_10px_24px_rgba(15,18,28,0.18)] transition hover:translate-y-[-1px]"
                style={{ backgroundColor: brick.color }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <BrickIcon name={brick.icon} className="size-5 shrink-0" />
                  <span className="font-poppins truncate text-[18px] leading-[120%] font-semibold sm:text-[18px]">{brick.name}</span>
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

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
          else setDialogOpen(true);
        }}
      >
        <DialogContent className="brick-manage-dialog flex max-h-[90vh] max-w-4xl flex-col overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--surface-1)] p-4 sm:p-6">
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle className="font-poppins text-[24px] leading-[120%] font-semibold text-[var(--text-strong)]">
              {editingBrickId ? "Edit Brick" : "New Brick"}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <div className="brick-manage-preview inline-flex min-w-[180px] items-center justify-center gap-2 rounded-full px-5 py-2 text-white" style={{ backgroundColor: color }}>
                <BrickIcon name={icon} className="size-5" />
                <span className="font-poppins text-[24px] leading-[120%] font-semibold sm:text-[24px]">{previewLabel}</span>
              </div>
            </div>

            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Brick name"
              className="h-12 rounded-xl bg-[var(--surface-1)] font-poppins text-[20px] leading-[120%] font-medium text-[var(--text-default)]"
            />

            <div className="brick-palette-box rounded-3xl border border-[var(--border)] bg-[var(--surface-2)] p-3 sm:p-4">
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

            <div className="brick-icons-box rounded-3xl border border-[var(--border)] bg-[var(--surface-2)] p-3 sm:p-4">
              <div className="grid grid-cols-8 gap-2 sm:grid-cols-10 sm:gap-2.5">
                {brickIconOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setIcon(option.value)}
                    className={`flex h-9 items-center justify-center rounded-xl border transition sm:h-10 ${
                      icon === option.value
                        ? "border-[#36A9E1] bg-[#DDECFF] text-[#1B5FB8]"
                        : "border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-default)] hover:border-[var(--ring)]"
                    }`}
                    aria-label={option.label}
                    title={option.label}
                  >
                    <option.Icon className="size-4 sm:size-5" />
                  </button>
                ))}
              </div>
            </div>

            {editingBrickId ? (
              <div className="space-y-3">
                <p className="font-poppins text-[16px] leading-[120%] font-medium text-[var(--text-default)]">
                  Collaborators
                </p>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
                    <Input
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleInvite();
                        }
                      }}
                      placeholder="Invite by email"
                      type="email"
                      className="h-10 rounded-xl bg-[var(--surface-2)] pl-9 font-poppins text-[14px]"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleInvite}
                    disabled={inviteMutation.isPending || !inviteEmail.trim()}
                    className="h-10 rounded-xl px-4 font-poppins text-[14px]"
                  >
                    {inviteMutation.isPending ? "Sending..." : "Invite"}
                  </Button>
                </div>

                <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                  <p className="font-poppins text-[12px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                    Current collaborators
                  </p>
                  {brickDetailQuery.isLoading ? (
                    <Skeleton className="h-10 w-full rounded-xl" />
                  ) : participantUsers.length ? (
                    participantUsers.map((user) => {
                      const isOwner = user._id === ownerId;
                      return (
                        <div
                          key={user._id}
                          className="flex items-center justify-between gap-2 rounded-lg bg-[var(--surface-1)] px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[14px] text-[var(--text-default)]">
                              {user.name || user.username || user.email}
                              {isOwner ? (
                                <span className="ml-2 rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                                  Owner
                                </span>
                              ) : null}
                            </p>
                            <p className="truncate text-[12px] text-[var(--text-muted)]">
                              {user.email}
                            </p>
                          </div>
                          {!isOwner ? (
                            <button
                              type="button"
                              aria-label={`Remove ${user.email}`}
                              className="inline-flex size-8 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--surface-3)] hover:text-red-500"
                              onClick={() => removeMutation.mutate(user._id)}
                              disabled={removeMutation.isPending}
                            >
                              <X className="size-4" />
                            </button>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <p className="px-1 py-2 text-[13px] text-[var(--text-muted)]">
                      No collaborators yet.
                    </p>
                  )}
                </div>

                {pendingInvitations.length ? (
                  <div className="space-y-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-3">
                    <p className="font-poppins text-[12px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                      Pending invitations
                    </p>
                    {pendingInvitations.map((invitation) => (
                      <div
                        key={invitation._id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-[var(--surface-1)] px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[14px] text-[var(--text-default)]">
                            {invitation.email}
                          </p>
                          <p className="truncate text-[12px] text-[var(--text-muted)]">
                            Awaiting acceptance
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-label={`Revoke invitation for ${invitation.email}`}
                          className="inline-flex size-8 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--surface-3)] hover:text-red-500"
                          onClick={() => revokeMutation.mutate(invitation._id)}
                          disabled={revokeMutation.isPending}
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-3 text-[13px] text-[var(--text-muted)]">
                Save the Brick first. Once created, you can invite collaborators by email.
              </p>
            )}
          </div>

          <DialogFooter className="mt-3 shrink-0 flex gap-2 border-t border-[var(--border)] pt-3 sm:justify-between">
            {editingBrickId ? (
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
              {saveMutation.isPending ? "Saving..." : editingBrickId ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
