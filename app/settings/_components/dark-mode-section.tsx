import { Switch } from "@/components/ui/switch";

import { SectionHeader } from "./section-header";

interface DarkModeSectionProps {
  darkMode: boolean;
  onToggle: (value: boolean) => void;
}

export function DarkModeSection({ darkMode, onToggle }: DarkModeSectionProps) {
  return (
    <section className="space-y-5">
      <SectionHeader
        title="Dark Mode"
        description="Toggle dark mode preference."
      />

      <div className="max-w-[560px] rounded-3xl border border-[#DEE3ED] bg-[#bfc2c9] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-poppins text-[24px] leading-[120%] font-semibold text-[#202531]">Enable dark mode</p>
            <p className="font-poppins mt-1 text-[16px] leading-[120%] font-normal text-[#727C8E]">{darkMode ? "Enabled" : "Disabled"}</p>
          </div>
          <Switch checked={darkMode} onCheckedChange={onToggle} />
        </div>
      </div>
    </section>
  );
}

