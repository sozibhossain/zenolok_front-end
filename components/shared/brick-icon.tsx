"use client";

import { getBrickSvg, brickIconMap } from "@/lib/brick-icons";

export function BrickIcon({ name, className }: { name?: string; className?: string }) {
  const key = brickIconMap[name?.toLowerCase() ?? ""] ?? brickIconMap["default"] ?? "grid-2x2";
  const svgInner = getBrickSvg(key);

  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svgInner }}
    />
  );
}
