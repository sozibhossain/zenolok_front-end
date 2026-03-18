"use client";

import { CalendarClock, Plus } from "lucide-react";

import { BrickIcon } from "@/components/shared/brick-icon";
import { Badge } from "@/components/ui/badge";
import type { Brick } from "@/lib/api";

type BrickFilterBarProps = {
  bricks: Brick[];
  selectedBrick: string;
  onSelectBrick: (brickId: string) => void;
  onCreateBrick: () => void;
};

export function BrickFilterBar({
  bricks,
  selectedBrick,
  onSelectBrick,
  onCreateBrick,
}: BrickFilterBarProps) {
  return (
    <section className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1">
      <button
        type="button"
        className="shrink-0"
        onClick={() => onSelectBrick("all")}
      >
        <Badge
          variant="neutral"
          className="rounded-full px-4 py-1 !text-[16px]"
          style={{
            backgroundColor: "white",
            borderColor: selectedBrick === "all" ? "#7D8597" : "#C2C9D6",
            color: "#4C5361",
          }}
        >
          <CalendarClock className="size-4" />
          All
        </Badge>
      </button>
      {bricks.map((brick) => {
        const active = selectedBrick === brick._id;
        return (
          <button
            key={brick._id}
            type="button"
            className="shrink-0"
            onClick={() => onSelectBrick(brick._id)}
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
