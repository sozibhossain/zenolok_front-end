"use client";

import * as React from "react";
import { signOut } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Menu } from "lucide-react";
import { toast } from "sonner";

import { useAppState } from "@/components/providers/app-state-provider";
import { BricksManagePanel } from "@/components/settings/bricks-manage-panel";
import { WeekStartDayPanel } from "@/components/settings/week-start-day-panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { authApi, userApi } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { weekStartDayOptions } from "@/lib/settings";

import { AlarmPresetSection } from "./_components/alarm-preset-section";
import { BricksManageSection } from "./_components/bricks-manage-section";
import { CalendarSection } from "./_components/calendar-section";
import { DarkModeSection } from "./_components/dark-mode-section";
import { FeedbackSection } from "./_components/feedback-section";
import { LogoutConfirmDialog } from "./_components/logout-confirm-dialog";
import { LogoutSection } from "./_components/logout-section";
import { NotificationsSection } from "./_components/notifications-section";
import { PasswordSection } from "./_components/password-section";
import { ProfileSection } from "./_components/profile-section";
import { SettingsSidebarDesktop, SettingsSidebarMobile } from "./_components/settings-sidebar";
import {
  isSettingsSection,
  sections,
  type AlarmPreset,
  type NotificationKey,
  type SettingsSection,
} from "./_components/settings-types";
import { TimeFormatSection } from "./_components/time-format-section";
import { WeekStartDaySection } from "./_components/week-start-day-section";

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
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
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

  const handleFeedbackSubmit = () => {
    if (!feedbackMessage.trim()) {
      toast.error("Please write feedback");
      return;
    }

    toast.success("Feedback sent");
    setFeedbackMessage("");
  };

  const profileName = profileQuery.data?.name || profileQuery.data?.username || "User";
  const profileEmail = profileQuery.data?.email || "";
  const profileUsername = profileQuery.data?.username || "";

  const primarySections = sections.filter((section) => !section.support);
  const supportSections = sections.filter((section) => section.support);
  const currentWeekStartLabel =
    weekStartDayOptions.find((option) => option.key === preferences.weekStartDay)?.label || "Monday";

  const handleSectionSelect = (section: SettingsSection) => {
    setActiveSection(section);
    setMobileSidebarOpen(false);
  };

  const renderActiveSection = () => {
    switch (activeSection) {
      case "profile":
        return (
          <ProfileSection
            avatarPreview={avatarPreview}
            isLoading={profileQuery.isLoading}
            isUpdating={updateProfileMutation.isPending}
            name={name}
            profileEmail={profileEmail}
            profileName={profileName}
            profileUsername={profileUsername}
            onAvatarSelect={setSelectedAvatar}
            onNameChange={setName}
            onSubmit={() => updateProfileMutation.mutate()}
          />
        );
      case "password":
        return (
          <PasswordSection
            confirmPassword={confirmPassword}
            isPending={changePasswordMutation.isPending}
            newPassword={newPassword}
            oldPassword={oldPassword}
            onChangeConfirmPassword={setConfirmPassword}
            onChangeNewPassword={setNewPassword}
            onChangeOldPassword={setOldPassword}
            onSubmit={handleChangePassword}
          />
        );
      case "bricksManage":
        return <BricksManageSection onOpenModal={() => setBricksManageModalOpen(true)} />;
      case "weekStartDay":
        return (
          <WeekStartDaySection
            currentWeekStartLabel={currentWeekStartLabel}
            onOpenModal={() => setWeekStartModalOpen(true)}
          />
        );
      case "switchTimeFormat":
        return (
          <TimeFormatSection
            use24Hour={preferences.use24Hour}
            onToggle={(value) => updatePreferences({ use24Hour: value })}
          />
        );
      case "alarmPreset":
        return <AlarmPresetSection value={alarmPreset} onChange={setAlarmPreset} />;
      case "darkMode":
        return (
          <DarkModeSection
            darkMode={preferences.darkMode}
            onToggle={(value) => updatePreferences({ darkMode: value })}
          />
        );
      case "notificationsReminders":
        return <NotificationsSection prefs={notificationPrefs} onToggle={updateNotification} />;
      case "calendar":
        return (
          <CalendarSection
            onManageWeekStartDay={() => setActiveSection("weekStartDay")}
            onCalendarSync={() => toast.info("Calendar sync settings coming soon")}
          />
        );
      case "feedback":
        return (
          <FeedbackSection
            message={feedbackMessage}
            onChangeMessage={setFeedbackMessage}
            onSubmit={handleFeedbackSubmit}
          />
        );
      case "logout":
        return <LogoutSection onLogout={() => setLogoutModalOpen(true)} />;
      default:
        return null;
    }
  };

  return (
    <>
      <div className="font-poppins mb-3 flex items-center justify-between rounded-2xl border border-[#E0E5EE] bg-[#172649] p-3 shadow-[0_12px_30px_rgba(17,24,37,0.10)] xl:hidden">
        <div>
          <h1 className="font-poppins text-[24px] leading-[120%] font-semibold text-[#202531]">Settings</h1>
          <p className="font-poppins text-[14px] leading-[120%] font-normal text-[#7A8598]">Account and preferences</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-11 rounded-xl p-0"
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Open settings menu"
        >
          <Menu className="size-5" />
        </Button>
      </div>

      <div className="font-poppins grid gap-1 xl:grid-cols-[340px_minmax(0,1fr)]">
        <SettingsSidebarDesktop
          activeSection={activeSection}
          primarySections={primarySections}
          supportSections={supportSections}
          onSectionSelect={handleSectionSelect}
        />

        <main className="rounded-r-xl border border-[#E0E5EE] bg-[#bfc2c9] p-4 sm:p-6">
          {renderActiveSection()}
        </main>
      </div>

      <SettingsSidebarMobile
        open={mobileSidebarOpen}
        activeSection={activeSection}
        primarySections={primarySections}
        supportSections={supportSections}
        onSectionSelect={handleSectionSelect}
        onClose={() => setMobileSidebarOpen(false)}
      />

      <Dialog open={bricksManageModalOpen} onOpenChange={setBricksManageModalOpen}>
        <DialogContent className="max-h-[88vh] max-w-[1100px] overflow-y-auto rounded-[30px] border border-[#DDE3EE] bg-[#bfc2c9] p-4 sm:p-6">
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
        <DialogContent className="max-w-3xl rounded-[30px] border border-[#DDE3EE] bg-[#bfc2c9] p-4 sm:p-6">
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

      <LogoutConfirmDialog
        open={logoutModalOpen}
        onOpenChange={setLogoutModalOpen}
        onConfirm={() => logoutMutation.mutate()}
        isPending={logoutMutation.isPending}
      />
    </>
  );
}

