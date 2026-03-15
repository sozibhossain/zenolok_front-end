import { Button } from "@/components/ui/button";

import { SectionHeader } from "./section-header";

interface CalendarSectionProps {
  onCalendarSync: () => void;
  onManageWeekStartDay: () => void;
}

export function CalendarSection({ onCalendarSync, onManageWeekStartDay }: CalendarSectionProps) {
  return (
    <section className="space-y-5">
      <SectionHeader
        title="Calendar"
        description="Manage calendar-related settings."
      />

      <div className="max-w-[760px] rounded-3xl border border-[#DEE3ED] bg-[#bfc2c9] p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            className="font-poppins h-11 rounded-xl px-5 text-[20px] leading-[120%] font-medium"
            onClick={onManageWeekStartDay}
          >
            Manage weeks start day
          </Button>
          <Button
            type="button"
            variant="outline"
            className="font-poppins h-11 rounded-xl px-5 text-[20px] leading-[120%] font-medium"
            onClick={onCalendarSync}
          >
            Calendar sync
          </Button>
        </div>
      </div>
    </section>
  );
}

