import { Switch } from "@/components/ui/switch";

import { SectionHeader } from "./section-header";

interface TimeFormatSectionProps {
  use24Hour: boolean;
  onToggle: (value: boolean) => void;
}

export function TimeFormatSection({ use24Hour, onToggle }: TimeFormatSectionProps) {
  return (
    <section className="space-y-5">
      <SectionHeader
        title="Switch time format"
        description="Use 24-hour time in all pages."
      />

      <div className="max-w-[560px] rounded-3xl border border-[#DEE3ED] bg-[#bfc2c9] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-poppins text-[20px] leading-[120%] font-medium text-[#2E3648]">24-hour format</p>
            <p className="font-poppins mt-1 text-[16px] leading-[120%] font-normal text-[#727C8E]">{use24Hour ? "Enabled" : "Disabled"}</p>
          </div>
          <Switch checked={use24Hour} onCheckedChange={onToggle} />
        </div>
      </div>
    </section>
  );
}

