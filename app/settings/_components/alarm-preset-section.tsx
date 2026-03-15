import { CheckCircle2 } from "lucide-react";

import { SectionHeader } from "./section-header";
import type { AlarmPreset } from "./settings-types";

const alarmOptions: Array<{ id: AlarmPreset; label: string }> = [
  { id: "none", label: "No alert" },
  { id: "preset1", label: "Preset 1" },
  { id: "preset2", label: "Preset 2" },
  { id: "preset3", label: "Preset 3" },
];

interface AlarmPresetSectionProps {
  value: AlarmPreset;
  onChange: (preset: AlarmPreset) => void;
}

export function AlarmPresetSection({ value, onChange }: AlarmPresetSectionProps) {
  return (
    <section className="space-y-5">
      <SectionHeader
        title="Alarm preset"
        description="Select your default reminder pattern."
      />

      <div className="max-w-[560px] rounded-3xl border border-[#DEE3ED] bg-[#bfc2c9] p-4 sm:p-5">
        <div className="space-y-2">
          {alarmOptions.map((item) => {
            const active = value === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition ${
                  active ? "border-[#31C65B] bg-[#F3FFF6]" : "border-[#D9DEE8] bg-[#bfc2c9] hover:border-[#BFC7D8]"
                }`}
              >
                <span className="font-poppins text-[20px] leading-[120%] font-medium text-[#2E3648]">{item.label}</span>
                {active ? <CheckCircle2 className="size-5 text-[#31C65B]" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

