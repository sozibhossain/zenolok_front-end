import { Button } from "@/components/ui/button";

import { SectionHeader } from "./section-header";

interface LogoutSectionProps {
  onLogout: () => void;
}

export function LogoutSection({ onLogout }: LogoutSectionProps) {
  return (
    <section className="space-y-5">
      <SectionHeader
        title="Logout"
        description="End your current session securely."
        titleClassName="text-[30px] text-[#1E2430] sm:text-[36px] lg:text-[40px]"
      />

      <div className="max-w-[560px] rounded-3xl border border-[#DEE3ED] bg-[#bfc2c9] p-4 sm:p-5">
        <p className="font-poppins text-[20px] leading-[120%] font-medium text-[#2E3648]">
          Click the button below to logout from this device.
        </p>
        <Button
          type="button"
          variant="destructive"
          className="font-poppins mt-4 h-11 rounded-xl px-5 text-[20px] leading-[120%] font-medium"
          onClick={onLogout}
        >
          Logout
        </Button>
      </div>
    </section>
  );
}

