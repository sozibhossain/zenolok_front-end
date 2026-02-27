"use client";

import { CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { weekStartDayOptions, type WeekStartDay } from "@/lib/settings";

export function WeekStartDayPanel({
  selectedDay,
  onSelect,
  className,
}: {
  selectedDay: WeekStartDay;
  onSelect: (day: WeekStartDay) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {weekStartDayOptions.map((day) => {
        const active = selectedDay === day.key;

        return (
          <button
            key={day.key}
            type="button"
            onClick={() => onSelect(day.key)}
            className={`settings-week-item flex w-full items-center justify-between rounded-2xl border px-3 py-3 transition sm:rounded-3xl sm:px-4 sm:py-4 ${
              active ? "border-[#4695FF] bg-[#E8F2FF]" : "border-[#D9DEE8] bg-white hover:border-[#BFC7D8]"
            }`}
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <span
                className={`settings-week-letter font-poppins flex size-10 items-center justify-center rounded-xl text-[20px] leading-[120%] font-medium sm:size-14 sm:rounded-2xl sm:text-[34px] ${
                  active ? "bg-[#D8E9FF] text-[#2A76DF]" : "bg-[#EFF1F5] text-[#2B303A]"
                }`}
              >
                {day.letter}
              </span>
              <span
                className={`settings-week-label font-poppins text-[20px] leading-[120%] sm:text-[30px] ${
                  active ? "font-semibold text-[#2A76DF]" : "font-medium text-[#2E3340]"
                }`}
              >
                {day.label}
              </span>
            </div>

            {active ? <CheckCircle2 className="size-6 text-[#2E7BF0] sm:size-8" /> : null}
          </button>
        );
      })}
    </div>
  );
}
