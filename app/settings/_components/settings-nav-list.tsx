import type { SidebarSection, SettingsSection } from "./settings-types";

interface SettingsNavListProps {
  activeSection: SettingsSection;
  sections: SidebarSection[];
  onSelect: (section: SettingsSection) => void;
  containerClassName?: string;
  labelClassName?: string;
}

export function SettingsNavList({
  activeSection,
  sections,
  onSelect,
  containerClassName = "grid gap-2",
  labelClassName = "font-poppins text-[16px] leading-[120%] font-medium",
}: SettingsNavListProps) {
  return (
    <div className={containerClassName}>
      {sections.map((section) => {
        const Icon = section.icon;
        const active = activeSection === section.id;

        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelect(section.id)}
            className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
              active ? "bg-[#DCE9FF] text-[#2C5DA9]" : "text-[#4C5668] hover:bg-[#ECF1FA]"
            }`}
          >
            <span className={`flex size-10 items-center justify-center rounded-xl ${active ? "bg-[#BFD7FF]" : "bg-[#E9EEF6]"}`}>
              <Icon className="size-5" />
            </span>
            <span className={labelClassName}>{section.label}</span>
          </button>
        );
      })}
    </div>
  );
}
