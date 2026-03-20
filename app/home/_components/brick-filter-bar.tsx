"use client";

import { LayoutGrid, Plus } from "lucide-react";

import { BrickIcon } from "@/components/shared/brick-icon";
import { Badge } from "@/components/ui/badge";
import type { Brick } from "@/lib/api";

type BrickFilterBarProps = {
  bricks: Brick[];
  selectedBrickIds: string[];
  onToggleBrick: (brickId: string) => void;
  onSelectAll: () => void;
  onCreateBrick: () => void;
};

export function BrickFilterBar({
  bricks,
  selectedBrickIds,
  onToggleBrick,
  onSelectAll,
  onCreateBrick,
}: BrickFilterBarProps) {
  const isAllSelected = selectedBrickIds.length === 0;

  return (
    <section className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1">
      <button
        type="button"
        className="shrink-0"
        onClick={onSelectAll}
      >
        <Badge
          variant="neutral"
          className="rounded-full px-4 py-1 !text-[16px]"
          style={
            isAllSelected
              ? {
                  backgroundColor: "#CBD7E9",
                  borderColor: "#CBD7E9",
                  color: "white",
                }
              : {
                  backgroundColor: "white",
                  borderColor: "#C2C9D6",
                  color: "#4C5361",
                }
          }
        >
          <LayoutGrid className="size-4"/>
          All
        </Badge>
      </button>
      {bricks.map((brick) => {
        const active = selectedBrickIds.includes(brick._id);
        return (
          <button
            key={brick._id}
            type="button"
            className="shrink-0"
            onClick={() => onToggleBrick(brick._id)}
          >
            <Badge
              variant="neutral"
              className="rounded-full px-4 py-1 !text-[16px]"
              style={
                active
                  ? {
                      color: brick.color,
                      borderColor: brick.color,
                      backgroundColor: "white",
                    }
                  : {
                      backgroundColor: brick.color,
                      color: "white",
                      borderColor: brick.color,
                    }
              }
            >
              <BrickIcon name={brick.icon} className="size-4" />
              {brick.name}
            </Badge>
          </button>
        );
      })}
      <button
        type="button"
        className="shrink-0"
        onClick={onCreateBrick}
        aria-label="Create brick"
      >
        <span className="flex size-8 items-center justify-center rounded-full border border-[#B9BFCA] bg-white text-[#7D8597]">
          <Plus className="size-4" />
        </span>
      </button>
    </section>
  );
}
