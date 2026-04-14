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
        description="Create new profile info, update existing profile info, and manage your profile settings."
        titleClassName="text-[30px] text-[var(--text-strong)]"
      />

      {isLoading ? (
        <div className="grid gap-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      ) : (
        <div className="settings-action-card rounded-3xl border border-[var(--border)] bg-[var(--surface-2)] p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <label
              htmlFor="avatar-upload"
              className="group relative cursor-pointer"
            >
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) =>
                  onAvatarSelect(event.target.files?.[0] || null)
                }
              />

              <Avatar className="size-20 border border-[var(--border)]">
                <AvatarImage
                  src={avatarPreview || undefined}
                  alt={profileName}
                />
                <AvatarFallback>
                  {profileName.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <Upload className="size-5 text-white" />
              </div>
            </label>

            <div className="space-y-1">
              <p className="font-poppins text-[20px] leading-[120%] font-medium text-[var(--text-strong)]">
                {profileName}
              </p>
              <p className="font-poppins text-[16px] leading-[120%] font-normal text-[var(--text-muted)]">
                {profileEmail}
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            <Input
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Name"
            />
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