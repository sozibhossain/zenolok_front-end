"use client";

import { BrickIcon } from "@/components/shared/brick-icon";
import { DragScrollArea } from "@/components/shared/drag-scroll-area";
import { Badge } from "@/components/ui/badge";
import type { Brick } from "@/lib/api";
import { cn } from "@/lib/utils";

type EventBrickSelectorProps = {
  bricks: Brick[];
  selectedBrickId?: string;
  onSelectBrick: (brickId: string) => void;
  className?: string;
  badgeClassName?: string;
};

export function resolveEventBrickSelection(
  allBrickIds: string[],
  preferredBrickIds: string[],
) {
  return preferredBrickIds.find((brickId) => allBrickIds.includes(brickId)) ?? allBrickIds[0] ?? "";
}

export function EventBrickSelector({
  bricks,
  selectedBrickId = "",
  onSelectBrick,
  className,
  badgeClassName,
}: EventBrickSelectorProps) {
  return (
    <DragScrollArea className={cn("pb-1", className)}>
      {bricks.map((brick) => {
        const active = selectedBrickId === brick._id;

        return (
          <button
            key={brick._id}
            type="button"
            className="shrink-0"
            onClick={() => onSelectBrick(brick._id)}
            aria-pressed={active}
          >
            <Badge
              variant="neutral"
              style={
                active
                  ? {
                      backgroundColor: brick.color,
                      color: "white",
                      borderColor: brick.color,
                    }
                  : {
                      backgroundColor: "var(--ui-badge-neutral-bg)",
                      color: brick.color,
                      borderColor: brick.color,
                      opacity: 0.78,
                    }
              }
              className={cn("rounded-full px-4 py-1 shadow-sm transition", badgeClassName)}
            >
              <BrickIcon name={brick.icon} className="size-4" />
              {brick.name}
            </Badge>
          </button>
        );
      })}
    </DragScrollArea>
  );
}
