import { Button } from "@/components/ui/button";

import { SectionHeader } from "./section-header";

interface WeekStartDaySectionProps {
  currentWeekStartLabel: string;
  onOpenModal: () => void;
}

export function WeekStartDaySection({ currentWeekStartLabel, onOpenModal }: WeekStartDaySectionProps) {
  return (
    <section className="space-y-5">
      <SectionHeader
        title="Manage weeks start day"
        description="Choose the first day of your week calendar."
      />

      <div className="max-w-[760px] rounded-3xl border border-[#DEE3ED] bg-[#bfc2c9] p-4 sm:p-5">
        <p className="font-poppins text-[20px] leading-[120%] font-medium text-[#2E3648]">
          Current week starts on: {currentWeekStartLabel}
        </p>
        <Button
          type="button"
          className="font-poppins mt-4 h-11 rounded-xl px-5 text-[20px] leading-[120%] font-medium"
          onClick={onOpenModal}
        >
          Choose Week Start Day
        </Button>
      </div>
    </section>
  );
}

