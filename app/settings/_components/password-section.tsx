import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";

import { SectionHeader } from "./section-header";

interface PasswordSectionProps {
  confirmPassword: string;
  isPending: boolean;
  newPassword: string;
  oldPassword: string;
  onChangeConfirmPassword: (value: string) => void;
  onChangeNewPassword: (value: string) => void;
  onChangeOldPassword: (value: string) => void;
  onSubmit: () => void;
}

export function PasswordSection({
  confirmPassword,
  isPending,
  newPassword,
  oldPassword,
  onChangeConfirmPassword,
  onChangeNewPassword,
  onChangeOldPassword,
  onSubmit,
}: PasswordSectionProps) {
  return (
    <section className="space-y-5">
      <SectionHeader
        title="Change Password"
        description="Use your current password and set a strong new password."
      />

      <div className="max-w-[560px] rounded-3xl border border-[#DEE3ED] bg-[#bfc2c9] p-4 sm:p-5">
        <div className="space-y-3">
          <PasswordInput value={oldPassword} onChange={(event) => onChangeOldPassword(event.target.value)} placeholder="Old Password" />
          <PasswordInput value={newPassword} onChange={(event) => onChangeNewPassword(event.target.value)} placeholder="New Password" />
          <PasswordInput
            value={confirmPassword}
            onChange={(event) => onChangeConfirmPassword(event.target.value)}
            placeholder="Confirm New Password"
          />
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            className="font-poppins h-11 rounded-xl px-5 text-[20px] leading-[120%] font-medium"
            onClick={onSubmit}
            disabled={isPending}
          >
            {isPending ? "Changing..." : "Change Password"}
          </Button>
        </div>
      </div>
    </section>
  );
}

