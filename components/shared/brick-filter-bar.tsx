"use client";

import * as React from "react";
import { Check, LayoutGrid, Plus } from "lucide-react";
import { motion } from "motion/react";

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
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const dragStateRef = React.useRef({
    active: false,
    moved: false,
    startX: 0,
    startScrollLeft: 0,
  });
  const suppressClickRef = React.useRef(false);
  const [isDragging, setIsDragging] = React.useState(false);

  const isAllSelected =
    bricks.length > 0 &&
    bricks.every((brick) => selectedBrickIds.includes(brick._id));

  const handleMouseDown = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }

      const container = containerRef.current;
      if (!container || container.scrollWidth <= container.clientWidth) {
        return;
      }

      suppressClickRef.current = false;
      dragStateRef.current = {
        active: true,
        moved: false,
        startX: event.clientX,
        startScrollLeft: container.scrollLeft,
      };
    },
    [],
  );

  React.useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const container = containerRef.current;
      const dragState = dragStateRef.current;
      if (!container || !dragState.active) {
        return;
      }

      const deltaX = event.clientX - dragState.startX;
      if (!dragState.moved && Math.abs(deltaX) > 4) {
        dragState.moved = true;
        setIsDragging(true);
      }

      if (!dragState.moved) {
        return;
      }

      container.scrollLeft = dragState.startScrollLeft - deltaX;
    };

    const handleMouseUp = () => {
      const wasMoved = dragStateRef.current.moved;
      if (wasMoved) {
        suppressClickRef.current = true;
      }

      dragStateRef.current.active = false;
      dragStateRef.current.moved = false;
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleClickCapture = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!suppressClickRef.current) {
        return;
      }

      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
    [],
  );

  return (
    <motion.section
      className="space-y-2"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <div
        ref={containerRef}
        className={`home-brick-filter drag-scrollbar-hidden overflow-x-auto pb-1 select-none ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        onMouseDown={handleMouseDown}
        onClickCapture={handleClickCapture}
      >
        <div className="flex w-max min-w-full items-center gap-2 whitespace-nowrap py-2">
          <motion.button
            type="button"
            className="shrink-0"
            onClick={onSelectAll}
            aria-pressed={isAllSelected}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
          >
            <Badge
              variant="neutral"
              className="rounded-full px-4 py-1 !text-[16px] shadow-sm transition"
              style={
                isAllSelected
                  ? {
                      backgroundColor: "#CBD7E9",
                      borderColor: "#CBD7E9",
                      color: "white",
                    }
                  : {
                      backgroundColor: "var(--ui-badge-neutral-bg)",
                      borderColor: "var(--ui-badge-neutral-border)",
                      color: "var(--ui-badge-neutral-text)",
                    }
              }
            >
              <LayoutGrid className="size-4" />
              All
              {isAllSelected ? <Check className="size-3.5" /> : null}
            </Badge>
          </motion.button>

          {bricks.map((brick) => {
            const active = selectedBrickIds.includes(brick._id);

            return (
              <motion.button
                key={brick._id}
                type="button"
                className="shrink-0"
                onClick={() => onToggleBrick(brick._id)}
                aria-pressed={active}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                layout
              >
                <Badge
                  variant="neutral"
                  className="rounded-full px-4 py-1 !text-[16px] shadow-sm transition"
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
                >
                  <BrickIcon name={brick.icon} className="size-4" />
                  {brick.name}
                </Badge>
              </motion.button>
            );
          })}

          <motion.button
            type="button"
            className="shrink-0"
            onClick={onCreateBrick}
            aria-label="Create brick"
            whileHover={{ y: -1, rotate: 45 }}
            whileTap={{ scale: 0.94 }}
          >
            <span className="flex size-8 items-center justify-center rounded-full border border-[var(--ui-badge-neutral-border)] bg-[var(--ui-badge-neutral-bg)] text-[var(--ui-badge-neutral-text)]">
              <Plus className="size-4" />
            </span>
          </motion.button>
        </div>
      </div>
    </motion.section>
  );
}
