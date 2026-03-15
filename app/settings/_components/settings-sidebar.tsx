import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

import { SettingsNavList } from "./settings-nav-list";
import type { SettingsSection, SidebarSection } from "./settings-types";

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  primarySections: SidebarSection[];
  supportSections: SidebarSection[];
  onSectionSelect: (section: SettingsSection) => void;
}

export function SettingsSidebarDesktop({
  activeSection,
  primarySections,
  supportSections,
  onSectionSelect,
}: SettingsSidebarProps) {
  return (
    <aside className="hidden rounded-xl bg-[#bfc2c9] p-4  sm:p-6 xl:sticky xl:top-24 xl:block xl:h-[calc(100vh-130px)] xl:overflow-auto xl:p-8">
      <h1 className="font-poppins mb-3 text-[28px] leading-[120%] font-semibold text-[#202531] sm:mb-4 sm:text-[30px]">Settings</h1>
      <p className="font-poppins text-[16px] leading-[120%] font-normal text-[#7A8598]">Account and preferences</p>

      <SettingsNavList
        activeSection={activeSection}
        sections={primarySections}
        onSelect={onSectionSelect}
        containerClassName="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1"
        labelClassName="font-poppins text-[16px] leading-[120%] font-medium sm:text-[18px]"
      />

      <div className="mt-5 border-t border-[#DFE4EE] pt-4">
        <p className="font-poppins mb-2 text-[20px] leading-[120%] font-semibold text-[#212734]">Support</p>
        <SettingsNavList
          activeSection={activeSection}
          sections={supportSections}
          onSelect={onSectionSelect}
          containerClassName="grid gap-2 sm:grid-cols-2 xl:grid-cols-1"
          labelClassName="font-poppins text-[16px] leading-[120%] font-medium sm:text-[18px]"
        />
      </div>
    </aside>
  );
}

interface SettingsMobileSidebarProps extends SettingsSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsSidebarMobile({
  activeSection,
  open,
  onClose,
  onSectionSelect,
  primarySections,
  supportSections,
}: SettingsMobileSidebarProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 xl:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
        aria-label="Close settings menu overlay"
      />
      <aside className="absolute left-0 top-0 h-full w-[86%] max-w-[340px] overflow-y-auto border-r border-[#E0E5EE] bg-[#bfc2c9] p-5 shadow-[0_16px_44px_rgba(17,24,37,0.20)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-poppins text-[26px] leading-[120%] font-semibold text-[#202531]">Settings</h2>
            <p className="font-poppins text-[14px] leading-[120%] font-normal text-[#7A8598]">Account and preferences</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-10 w-10 rounded-xl p-0"
            onClick={onClose}
            aria-label="Close settings menu"
          >
            <X className="size-5" />
          </Button>
        </div>

        <SettingsNavList activeSection={activeSection} sections={primarySections} onSelect={onSectionSelect} />

        <div className="mt-5 border-t border-[#DFE4EE] pt-4">
          <p className="font-poppins mb-2 text-[18px] leading-[120%] font-semibold text-[#212734]">Support</p>
          <SettingsNavList activeSection={activeSection} sections={supportSections} onSelect={onSectionSelect} />
        </div>
      </aside>
    </div>
  );
}

