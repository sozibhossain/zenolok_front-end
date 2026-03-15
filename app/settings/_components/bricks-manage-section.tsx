import { Button } from "@/components/ui/button";

import { SectionHeader } from "./section-header";

interface BricksManageSectionProps {
  onOpenModal: () => void;
}

export function BricksManageSection({ onOpenModal }: BricksManageSectionProps) {
  return (
    <section className="space-y-5">
      <SectionHeader
        title="Bricks Manage"
        description="Manage brick name, icon, and color."
      />

      <div className="max-w-[700px] rounded-3xl border border-[#DEE3ED] bg-[#bfc2c9] p-4 sm:p-5">
        <p className="font-poppins text-[20px] leading-[120%] font-medium text-[#2E3648]">Open Bricks Manage in a modal.</p>
        <Button
          type="button"
          className="font-poppins mt-4 h-11 rounded-xl px-5 text-[20px] leading-[120%] font-medium"
          onClick={onOpenModal}
        >
          Open Bricks Manage
        </Button>
      </div>
    </section>
  );
}

