"use client";

import * as React from "react";
import { signOut } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Bell,
  BellPlus,
  CalendarDays,
  CheckCircle2,
  CircleUserRound,
  Clock3,
  LockKeyhole,
  LogOut,
  MessageSquare,
  Moon,
  Save,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PasswordInput } from "@/components/auth/password-input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAppState } from "@/components/providers/app-state-provider";
import { BricksManagePanel } from "@/components/settings/bricks-manage-panel";
import { WeekStartDayPanel } from "@/components/settings/week-start-day-panel";
import { authApi, userApi } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { weekStartDayOptions } from "@/lib/settings";

type SettingsSection =
  | "profile"
  | "password"
  | "bricksManage"
  | "weekStartDay"
  | "switchTimeFormat"
  | "alarmPreset"
  | "darkMode"
  | "notificationsReminders"
  | "calendar"
  | "feedback"
  | "logout";

type AlarmPreset = "none" | "preset1" | "preset2" | "preset3";
type NotificationKey = "anyMessages" | "taggedMessages" | "eventAlarms" | "todoAlarms";

interface SidebarSection {
  id: SettingsSection;
  label: string;
  icon: LucideIcon;
  support?: boolean;
}

const sections: SidebarSection[] = [
  { id: "profile", label: "New Profile", icon: CircleUserRound },
  { id: "password", label: "Change Password", icon: LockKeyhole },
  { id: "bricksManage", label: "Bricks Manage", icon: BadgeCheck },
  { id: "weekStartDay", label: "Manage weeks start day", icon: Bell },
  { id: "switchTimeFormat", label: "Switch time format", icon: Clock3 },
  { id: "alarmPreset", label: "Alarm preset", icon: Bell },
  { id: "darkMode", label: "Dark Mode", icon: Moon },
  { id: "notificationsReminders", label: "Notifications & Reminders", icon: BellPlus },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "feedback", label: "Feedback", icon: MessageSquare, support: true },
  { id: "logout", label: "Logout", icon: LogOut, support: true },
];

function isSettingsSection(value: string): value is SettingsSection {
  return sections.some((section) => section.id === value);
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { preferences, updatePreferences } = useAppState();
  const initialParamsHandled = React.useRef(false);

  const [activeSection, setActiveSection] = React.useState<SettingsSection>("profile");

  const [name, setName] = React.useState("");
  const [selectedAvatar, setSelectedAvatar] = React.useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null);

  const [oldPassword, setOldPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const [alarmPreset, setAlarmPreset] = React.useState<AlarmPreset>("none");
  const [feedbackMessage, setFeedbackMessage] = React.useState("");
  const [logoutModalOpen, setLogoutModalOpen] = React.useState(false);
  const [bricksManageModalOpen, setBricksManageModalOpen] = React.useState(false);
  const [weekStartModalOpen, setWeekStartModalOpen] = React.useState(false);
  const [notificationPrefs, setNotificationPrefs] = React.useState<Record<NotificationKey, boolean>>({
    anyMessages: true,
    taggedMessages: true,
    eventAlarms: true,
    todoAlarms: true,
  });

  const profileQuery = useQuery({
    queryKey: queryKeys.profile,
    queryFn: userApi.getProfile,
  });

  React.useEffect(() => {
    if (!profileQuery.data) {
      return;
    }

    setName(profileQuery.data.name || "");
    setAvatarPreview(profileQuery.data.avatar?.url || null);
  }, [profileQuery.data]);

  React.useEffect(() => {
    if (!selectedAvatar) {
      return;
    }

    const objectUrl = URL.createObjectURL(selectedAvatar);
    setAvatarPreview(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedAvatar]);

  React.useEffect(() => {
    if (initialParamsHandled.current) {
      return;
    }

    initialParamsHandled.current = true;

    const params = new URLSearchParams(window.location.search);
    const section = params.get("section");
    if (section && isSettingsSection(section)) {
      setActiveSection(section);
    }

    const modal = params.get("modal");
    if (modal === "bricks-manage") {
      setBricksManageModalOpen(true);
    }
    if (modal === "week-start-day") {
      setWeekStartModalOpen(true);
    }
  }, []);

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim() && !selectedAvatar) {
        throw new Error("Provide name or avatar to update profile");
      }

      const formData = new FormData();
      if (name.trim()) {
        formData.append("name", name.trim());
      }
      if (selectedAvatar) {
        formData.append("avatar", selectedAvatar);
      }

      return userApi.updateProfile(formData);
    },
    onSuccess: () => {
      toast.success("Profile updated successfully");
      setSelectedAvatar(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.profile });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Profile update failed");
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: () => authApi.changePassword({ oldPassword, newPassword }),
    onSuccess: () => {
      toast.success("Password changed successfully");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Password change failed");
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: async () => {
      toast.success("Logged out");
      await signOut({ callbackUrl: "/auth/login" });
    },
    onError: async () => {
      toast.error("Logout request failed, signing out locally");
      await signOut({ callbackUrl: "/auth/login" });
    },
  });

  const handleChangePassword = () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error("All password fields are required");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New password and confirm password must match");
      return;
    }

    changePasswordMutation.mutate();
  };

  const updateNotification = (key: NotificationKey, value: boolean) => {
    setNotificationPrefs((prev) => ({ ...prev, [key]: value }));
  };

  const profileName = profileQuery.data?.name || profileQuery.data?.username || "User";
  const profileEmail = profileQuery.data?.email || "";
  const profileUsername = profileQuery.data?.username || "";

  const primarySections = sections.filter((section) => !section.support);
  const supportSections = sections.filter((section) => section.support);
  const currentWeekStartLabel =
    weekStartDayOptions.find((option) => option.key === preferences.weekStartDay)?.label || "Monday";

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-[30px] border border-[#E0E5EE] bg-[#F5F7FC] p-4 shadow-[0_16px_44px_rgba(17,24,37,0.12)] sm:p-6 xl:sticky xl:top-24 xl:h-[calc(100vh-130px)] xl:overflow-auto xl:p-8">
          <h1 className="font-poppins mb-3 text-[28px] leading-[120%] font-semibold text-[#202531] sm:mb-4 sm:text-[30px]">Settings</h1>
          <p className="font-poppins text-[16px] leading-[120%] font-normal text-[#7A8598]">Account and preferences</p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {primarySections.map((section) => {
              const Icon = section.icon;
              const active = activeSection === section.id;

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                    active ? "bg-[#DCE9FF] text-[#2C5DA9]" : "text-[#4C5668] hover:bg-[#ECF1FA]"
                  }`}
                >
                  <span className={`flex size-10 items-center justify-center rounded-xl ${active ? "bg-[#BFD7FF]" : "bg-[#E9EEF6]"}`}>
                    <Icon className="size-5" />
                  </span>
                  <span className="font-poppins text-[16px] leading-[120%] font-medium sm:text-[18px]">{section.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 border-t border-[#DFE4EE] pt-4">
            <p className="font-poppins mb-2 text-[20px] leading-[120%] font-semibold text-[#212734]">Support</p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {supportSections.map((section) => {
                const Icon = section.icon;
                const active = activeSection === section.id;

                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                      active ? "bg-[#DCE9FF] text-[#2C5DA9]" : "text-[#4C5668] hover:bg-[#ECF1FA]"
                    }`}
                  >
                    <span className={`flex size-10 items-center justify-center rounded-xl ${active ? "bg-[#BFD7FF]" : "bg-[#E9EEF6]"}`}>
                      <Icon className="size-5" />
                    </span>
                    <span className="font-poppins text-[16px] leading-[120%] font-medium sm:text-[18px]">{section.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <main className="rounded-[30px] border border-[#E0E5EE] bg-[#F5F7FC] p-4 shadow-[0_16px_44px_rgba(17,24,37,0.12)] sm:p-6">
          {activeSection === "profile" ? (
            <section className="space-y-5">
              <div>
                <h2 className="font-poppins text-[30px] mb-4 leading-[120%] font-semibold text-[#1E2430]">New Profile</h2>
                <p className="font-poppins mt-1 text-[16px] leading-[120%] font-normal text-[#727C8E]">
                  Create new profile info, update existing profile, and manage avatar.
                </p>
              </div>

              {profileQuery.isLoading ? (
                <div className="grid gap-3">
                  <Skeleton className="h-20 w-full rounded-2xl" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                </div>
              ) : (
                <div className="rounded-3xl border border-[#DEE3ED] bg-white p-4 sm:p-5">
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
                        onChange={(event) => setSelectedAvatar(event.target.files?.[0] || null)}
                      />
                      <span className="font-poppins inline-flex h-10 items-center gap-2 rounded-xl border border-[#CED6E4] bg-[#F8FAFF] px-4 text-[16px] leading-[120%] font-medium text-[#44506B] hover:bg-[#EDF2FC]">
                        <Upload className="size-4" />
                        Upload Avatar
                      </span>
                    </label>
                  </div>

                  <div className="grid gap-3">
                    <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" />
                    <Input value={profileUsername} disabled placeholder="Username" />
                    <Input value={profileEmail} disabled placeholder="Email" />
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button
                      type="button"
                      className="font-poppins h-11 rounded-xl px-5 text-[20px] leading-[120%] font-medium"
                      onClick={() => updateProfileMutation.mutate()}
                      disabled={updateProfileMutation.isPending}
                    >
                      <Save className="size-4" />
                      {updateProfileMutation.isPending ? "Updating..." : "Update Profile"}
                    </Button>
                  </div>
                </div>
              )}
            </section>
          ) : null}

          {activeSection === "password" ? (
            <section className="space-y-5">
              <div>
                <h2 className="font-poppins text-[30px] leading-[120%] font-semibold text-[#1E2430] sm:text-[36px] lg:text-[40px]">Change Password</h2>
                <p className="font-poppins mt-1 text-[16px] leading-[120%] font-normal text-[#727C8E]">
                  Use your current password and set a strong new password.
                </p>
              </div>

              <div className="max-w-[560px] rounded-3xl border border-[#DEE3ED] bg-white p-4 sm:p-5">
                <div className="space-y-3">
                  <PasswordInput
                    value={oldPassword}
                    onChange={(event) => setOldPassword(event.target.value)}
                    placeholder="Old Password"
                  />
                  <PasswordInput
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="New Password"
                  />
                  <PasswordInput
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Confirm New Password"
                  />
                </div>

                <div className="mt-4 flex justify-end">
                  <Button
                    type="button"
                    className="font-poppins h-11 rounded-xl px-5 text-[20px] leading-[120%] font-medium"
                    onClick={handleChangePassword}
                    disabled={changePasswordMutation.isPending}
                  >
                    {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
                  </Button>
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === "bricksManage" ? (
            <section className="space-y-5">
              <div>
                <h2 className="font-poppins text-[30px] leading-[120%] font-semibold text-[#1E2430] sm:text-[36px] lg:text-[40px]">Bricks Manage</h2>
                <p className="font-poppins mt-1 text-[16px] leading-[120%] font-normal text-[#727C8E]">
                  Manage brick name, icon, and color.
                </p>
              </div>

              <div className="max-w-[700px] rounded-3xl border border-[#DEE3ED] bg-white p-4 sm:p-5">
                <p className="font-poppins text-[20px] leading-[120%] font-medium text-[#2E3648]">
                  Open Bricks Manage in a modal.
                </p>
                <Button
                  type="button"
                  className="font-poppins mt-4 h-11 rounded-xl px-5 text-[20px] leading-[120%] font-medium"
                  onClick={() => setBricksManageModalOpen(true)}
                >
                  Open Bricks Manage
                </Button>
              </div>
            </section>
          ) : null}

          {activeSection === "weekStartDay" ? (
            <section className="space-y-5">
              <div>
                <h2 className="font-poppins text-[30px] leading-[120%] font-semibold text-[#1E2430] sm:text-[36px] lg:text-[40px]">Manage weeks start day</h2>
                <p className="font-poppins mt-1 text-[16px] leading-[120%] font-normal text-[#727C8E]">
                  Choose the first day of your week calendar.
                </p>
              </div>

              <div className="max-w-[760px] rounded-3xl border border-[#DEE3ED] bg-white p-4 sm:p-5">
                <p className="font-poppins text-[20px] leading-[120%] font-medium text-[#2E3648]">
                  Current week starts on: {currentWeekStartLabel}
                </p>
                <Button
                  type="button"
                  className="font-poppins mt-4 h-11 rounded-xl px-5 text-[20px] leading-[120%] font-medium"
                  onClick={() => setWeekStartModalOpen(true)}
                >
                  Choose Week Start Day
                </Button>
              </div>
            </section>
          ) : null}

          {activeSection === "switchTimeFormat" ? (
            <section className="space-y-5">
              <div>
                <h2 className="font-poppins text-[30px] leading-[120%] font-semibold text-[#1E2430] sm:text-[36px] lg:text-[40px]">Switch time format</h2>
                <p className="font-poppins mt-1 text-[16px] leading-[120%] font-normal text-[#727C8E]">
                  Use 24-hour time in all pages.
                </p>
              </div>

              <div className="max-w-[560px] rounded-3xl border border-[#DEE3ED] bg-white p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-poppins text-[20px] leading-[120%] font-medium text-[#2E3648]">24-hour format</p>
                    <p className="font-poppins mt-1 text-[16px] leading-[120%] font-normal text-[#727C8E]">
                      {preferences.use24Hour ? "Enabled" : "Disabled"}
                    </p>
                  </div>
                  <Switch checked={preferences.use24Hour} onCheckedChange={(value) => updatePreferences({ use24Hour: value })} />
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === "alarmPreset" ? (
            <section className="space-y-5">
              <div>
                <h2 className="font-poppins text-[30px] leading-[120%] font-semibold text-[#1E2430] sm:text-[36px] lg:text-[40px]">Alarm preset</h2>
                <p className="font-poppins mt-1 text-[16px] leading-[120%] font-normal text-[#727C8E]">
                  Select your default reminder pattern.
                </p>
              </div>

              <div className="max-w-[560px] rounded-3xl border border-[#DEE3ED] bg-white p-4 sm:p-5">
                <div className="space-y-2">
                  {[
                    { id: "none", label: "No alert" },
                    { id: "preset1", label: "Preset 1" },
                    { id: "preset2", label: "Preset 2" },
                    { id: "preset3", label: "Preset 3" },
                  ].map((item) => {
                    const active = alarmPreset === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setAlarmPreset(item.id as AlarmPreset)}
                        className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition ${
                          active ? "border-[#31C65B] bg-[#F3FFF6]" : "border-[#D9DEE8] bg-white hover:border-[#BFC7D8]"
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
          ) : null}

          {activeSection === "darkMode" ? (
            <section className="space-y-5">
              <div>
                <h2 className="font-poppins text-[30px] leading-[120%] font-semibold text-[#1E2430] sm:text-[36px] lg:text-[40px]">Dark Mode</h2>
                <p className="font-poppins mt-1 text-[16px] leading-[120%] font-normal text-[#727C8E]">
                  Toggle dark mode preference.
                </p>
              </div>

              <div className="max-w-[560px] rounded-3xl border border-[#DEE3ED] bg-white p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-poppins text-[20px] leading-[120%] font-medium text-[#2E3648]">Enable dark mode</p>
                    <p className="font-poppins mt-1 text-[16px] leading-[120%] font-normal text-[#727C8E]">
                      {preferences.darkMode ? "Enabled" : "Disabled"}
                    </p>
                  </div>
                  <Switch checked={preferences.darkMode} onCheckedChange={(value) => updatePreferences({ darkMode: value })} />
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === "notificationsReminders" ? (
            <section className="space-y-5">
              <div>
                <h2 className="font-poppins text-[30px] leading-[120%] font-semibold text-[#1E2430] sm:text-[36px] lg:text-[40px]">Notifications & Reminders</h2>
                <p className="font-poppins mt-1 text-[16px] leading-[120%] font-normal text-[#727C8E]">
                  Configure which alerts you want to receive.
                </p>
              </div>

              <div className="max-w-[760px] rounded-3xl border border-[#DEE3ED] bg-white p-4 sm:p-5">
                <div className="space-y-3">
                  {[
                    { key: "anyMessages", label: "Any messages" },
                    { key: "taggedMessages", label: "Tagged messages" },
                    { key: "eventAlarms", label: "Events alarm" },
                    { key: "todoAlarms", label: "Todos alarm" },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between rounded-2xl border border-[#E2E7F0] bg-[#FAFBFE] px-3 py-3">
                      <span className="font-poppins text-[20px] leading-[120%] font-medium text-[#2E3648]">{item.label}</span>
                      <Switch
                        checked={notificationPrefs[item.key as NotificationKey]}
                        onCheckedChange={(value) => updateNotification(item.key as NotificationKey, value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === "calendar" ? (
            <section className="space-y-5">
              <div>
                <h2 className="font-poppins text-[30px] leading-[120%] font-semibold text-[#1E2430] sm:text-[36px] lg:text-[40px]">Calendar</h2>
                <p className="font-poppins mt-1 text-[16px] leading-[120%] font-normal text-[#727C8E]">
                  Manage calendar-related settings.
                </p>
              </div>

              <div className="max-w-[760px] rounded-3xl border border-[#DEE3ED] bg-white p-4 sm:p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="font-poppins h-11 rounded-xl px-5 text-[20px] leading-[120%] font-medium"
                    onClick={() => setActiveSection("weekStartDay")}
                  >
                    Manage weeks start day
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="font-poppins h-11 rounded-xl px-5 text-[20px] leading-[120%] font-medium"
                    onClick={() => toast.info("Calendar sync settings coming soon")}
                  >
                    Calendar sync
                  </Button>
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === "feedback" ? (
            <section className="space-y-5">
              <div>
                <h2 className="font-poppins text-[30px] leading-[120%] font-semibold text-[#1E2430] sm:text-[36px] lg:text-[40px]">Feedback</h2>
                <p className="font-poppins mt-1 text-[16px] leading-[120%] font-normal text-[#727C8E]">
                  Send us your feedback and suggestions.
                </p>
              </div>

              <div className="max-w-[760px] rounded-3xl border border-[#DEE3ED] bg-white p-4 sm:p-5">
                <textarea
                  value={feedbackMessage}
                  onChange={(event) => setFeedbackMessage(event.target.value)}
                  placeholder="Type your feedback..."
                  className="font-poppins min-h-[180px] w-full rounded-2xl border border-[#D9DEE8] bg-[#FBFCFF] p-3 text-[16px] leading-[120%] font-normal text-[#2A2E36] outline-none placeholder:text-[#97A1B3] focus:border-[#7AA8EE]"
                />
                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    className="font-poppins h-11 rounded-xl px-5 text-[20px] leading-[120%] font-medium"
                    onClick={() => {
                      if (!feedbackMessage.trim()) {
                        toast.error("Please write feedback");
                        return;
                      }
                      toast.success("Feedback sent");
                      setFeedbackMessage("");
                    }}
                  >
                    Submit Feedback
                  </Button>
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === "logout" ? (
            <section className="space-y-5">
              <div>
                <h2 className="font-poppins text-[30px] leading-[120%] font-semibold text-[#1E2430] sm:text-[36px] lg:text-[40px]">Logout</h2>
                <p className="font-poppins mt-1 text-[16px] leading-[120%] font-normal text-[#727C8E]">
                  End your current session securely.
                </p>
              </div>

              <div className="max-w-[560px] rounded-3xl border border-[#DEE3ED] bg-white p-4 sm:p-5">
                <p className="font-poppins text-[20px] leading-[120%] font-medium text-[#2E3648]">
                  Click the button below to logout from this device.
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  className="font-poppins mt-4 h-11 rounded-xl px-5 text-[20px] leading-[120%] font-medium"
                  onClick={() => setLogoutModalOpen(true)}
                >
                  Logout
                </Button>
              </div>
            </section>
          ) : null}
        </main>
      </div>

      <Dialog open={bricksManageModalOpen} onOpenChange={setBricksManageModalOpen}>
        <DialogContent className="max-h-[88vh] max-w-[1100px] overflow-y-auto rounded-[30px] border border-[#DDE3EE] bg-[#F5F7FC] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="font-poppins text-[30px] leading-[120%] font-semibold text-[#1E2430] sm:text-[36px] lg:text-[40px]">
              Bricks Manage
            </DialogTitle>
            <DialogDescription>Manage brick name, icon, and color from this modal.</DialogDescription>
          </DialogHeader>
          <BricksManagePanel />
        </DialogContent>
      </Dialog>

      <Dialog open={weekStartModalOpen} onOpenChange={setWeekStartModalOpen}>
        <DialogContent className="max-w-3xl rounded-[30px] border border-[#DDE3EE] bg-[#F5F7FC] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="font-poppins text-[30px] leading-[120%] font-semibold text-[#1E2430] sm:text-[36px] lg:text-[40px]">
              Manage weeks start day
            </DialogTitle>
            <DialogDescription>Choose the first day of your week calendar.</DialogDescription>
          </DialogHeader>
          <WeekStartDayPanel
            selectedDay={preferences.weekStartDay}
            onSelect={(day) => updatePreferences({ weekStartDay: day })}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={logoutModalOpen} onOpenChange={setLogoutModalOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-[32px]">Confirm Logout</DialogTitle>
            <DialogDescription>Are you sure you want to logout from your account?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-3">
            <Button
              type="button"
              variant="outline"
              className="font-poppins h-10 min-w-[92px] rounded-xl text-[16px] leading-[120%] font-medium"
              onClick={() => setLogoutModalOpen(false)}
            >
              No
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="font-poppins h-10 min-w-[92px] rounded-xl text-[16px] leading-[120%] font-medium"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              {logoutMutation.isPending ? "..." : "Yes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
