import { Button } from "@/components/ui/button";

import { SectionHeader } from "./section-header";

interface CalendarSectionProps {
  isCalendarSyncing?: boolean;
  onCalendarSync: () => void;
  onManageWeekStartDay: () => void;
}

export function CalendarSection({
  isCalendarSyncing = false,
  onCalendarSync,
  onManageWeekStartDay,
}: CalendarSectionProps) {
  return (
    <section className="space-y-5">
      <SectionHeader
        title="Calendar"
        description="Manage calendar-related settings."
      />

      <div className="w-full settings-action-card rounded-3xl border border-[var(--border)] bg-[var(--surface-2)] p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            className="font-poppins h-11 rounded-xl px-5 !text-[28px] leading-[120%] font-medium"
            onClick={onManageWeekStartDay}
          >
            Manage Week Start Day
          </Button>
          <Button
            type="button"
            variant="outline"
            className="font-poppins h-11 rounded-xl px-5 !text-[28px] leading-[120%] font-medium"
            onClick={onCalendarSync}
            disabled={isCalendarSyncing}
          >
            {isCalendarSyncing ? "Syncing..." : "Sync Google Calendar"}
          </Button>
        </div>
      </div>
    </section>
  );
}
