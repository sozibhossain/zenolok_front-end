import * as React from "react";

import { cn } from "@/lib/utils";

const DEFAULT_CHECKED_COLOR = "#2CCB62";

type TodoStatusCircleBaseProps = {
  checked: boolean;
  checkedColor?: string;
  uncheckedColor?: string;
};

function getCircleStyle(
  checked: boolean,
  checkedColor: string,
  uncheckedColor?: string,
  style?: React.CSSProperties,
) {
  if (!checked) {
    return uncheckedColor
      ? {
          ...style,
          borderColor: uncheckedColor,
        }
      : style;
  }

  return {
    ...style,
    borderColor: checkedColor,
  };
}

function getCircleClassName(checked: boolean, className?: string) {
  return cn(
    "inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 bg-[var(--ui-checkbox-bg)] p-[2px] transition-colors",
    checked ? null : "border-[var(--ui-checkbox-border)]",
    className,
  );
}

function TodoStatusCircleFill({
  checked,
  checkedColor,
}: TodoStatusCircleBaseProps) {
  if (!checked) {
    return null;
  }

  return (
    <span
      aria-hidden="true"
      className="block rounded-full"
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: checkedColor || DEFAULT_CHECKED_COLOR,
      }}
    />
  );
}

type TodoStatusCircleProps = TodoStatusCircleBaseProps &
  React.HTMLAttributes<HTMLSpanElement>;

export function TodoStatusCircle({
  checked,
  checkedColor = DEFAULT_CHECKED_COLOR,
  uncheckedColor,
  className,
  style,
  ...props
}: TodoStatusCircleProps) {
  return (
    <span
      className={getCircleClassName(checked, className)}
      style={getCircleStyle(checked, checkedColor, uncheckedColor, style)}
      {...props}
    >
      <TodoStatusCircleFill checked={checked} checkedColor={checkedColor} />
    </span>
  );
}

type TodoStatusCircleButtonProps = TodoStatusCircleBaseProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">;

export function TodoStatusCircleButton({
  checked,
  checkedColor = DEFAULT_CHECKED_COLOR,
  uncheckedColor,
  className,
  style,
  type = "button",
  ...props
}: TodoStatusCircleButtonProps) {
  return (
    <button
      type={type}
      className={getCircleClassName(checked, className)}
      style={getCircleStyle(checked, checkedColor, uncheckedColor, style)}
      {...props}
    >
      <TodoStatusCircleFill checked={checked} checkedColor={checkedColor} />
    </button>
  );
}
