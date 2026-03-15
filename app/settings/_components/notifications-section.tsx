import { Switch } from "@/components/ui/switch";

import { SectionHeader } from "./section-header";
import type { NotificationKey } from "./settings-types";

const notificationOptions: Array<{ key: NotificationKey; label: string }> = [
  { key: "anyMessages", label: "Any messages" },
  { key: "taggedMessages", label: "Tagged messages" },
  { key: "eventAlarms", label: "Events alarm" },
  { key: "todoAlarms", label: "Todos alarm" },
];

interface NotificationsSectionProps {
  prefs: Record<NotificationKey, boolean>;
  onToggle: (key: NotificationKey, value: boolean) => void;
}

export function NotificationsSection({ prefs, onToggle }: NotificationsSectionProps) {
  return (
    <section className="space-y-5">
      <SectionHeader
        title="Notifications & Reminders"
        description="Configure which alerts you want to receive."
      />

      <div className="max-w-[760px] rounded-3xl border border-[#DEE3ED] bg-[#bfc2c9] p-4 sm:p-5">
        <div className="space-y-3">
          {notificationOptions.map((item) => (
            <div key={item.key} className="flex items-center justify-between rounded-2xl border border-[#E2E7F0] bg-[#bfc2c9] px-3 py-3">
              <span className="font-poppins text-[20px] leading-[120%] font-medium text-[#2E3648]">{item.label}</span>
              <Switch checked={prefs[item.key]} onCheckedChange={(value) => onToggle(item.key, value)} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

