import { Save, Upload } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

import { SectionHeader } from "./section-header";

interface ProfileSectionProps {
  avatarPreview: string | null;
  isLoading: boolean;
  isUpdating: boolean;
  name: string;
  profileEmail: string;
  profileName: string;
  profileUsername: string;
  onAvatarSelect: (file: File | null) => void;
  onNameChange: (value: string) => void;
  onSubmit: () => void;
}

export function ProfileSection({
  avatarPreview,
  isLoading,
  isUpdating,
  name,
  profileEmail,
  profileName,
  profileUsername,
  onAvatarSelect,
  onNameChange,
  onSubmit,
}: ProfileSectionProps) {
  return (
    <section className="space-y-5">
      <SectionHeader
        title="New Profile"
        description="Create new profile info, update existing profile, and manage avatar."
        titleClassName="text-[30px] text-[#1E2430]"
      />

      {isLoading ? (
        <div className="grid gap-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      ) : (
        <div className="rounded-3xl border border-[#DEE3ED] bg-[#bfc2c9] p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <Avatar className="size-20 border border-[#D8DFEA]">
              <AvatarImage src={avatarPreview || undefined} alt={profileName} />
              <AvatarFallback>{profileName.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <p className="font-poppins text-[20px] leading-[120%] font-medium text-[#212733]">{profileName}</p>
              <p className="font-poppins text-[16px] leading-[120%] font-normal text-[#717B8D]">{profileEmail}</p>
            </div>
            <label className="ml-auto cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => onAvatarSelect(event.target.files?.[0] || null)}
              />
              <span className="font-poppins inline-flex h-10 items-center gap-2 rounded-xl border border-[#CED6E4] bg-[#bfc2c9] px-4 text-[16px] leading-[120%] font-medium text-[#44506B] hover:bg-[#EDF2FC]">
                <Upload className="size-4" />
                Upload Avatar
              </span>
            </label>
          </div>

          <div className="grid gap-3">
            <Input value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="Name" />
            <Input value={profileUsername} disabled placeholder="Username" />
            <Input value={profileEmail} disabled placeholder="Email" />
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              className="font-poppins h-11 rounded-xl px-5 text-[20px] leading-[120%] font-medium"
              onClick={onSubmit}
              disabled={isUpdating}
            >
              <Save className="size-4" />
              {isUpdating ? "Updating..." : "Update Profile"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

