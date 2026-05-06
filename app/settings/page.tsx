"use client";

import * as React from "react";
import { signOut } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Menu } from "lucide-react";
import { toast } from "sonner";

import { useAppState } from "@/components/providers/app-state-provider";
import { Button } from "@/components/ui/button";
import { authApi, feedbackApi, googleCalendarApi, userApi } from "@/lib/api";
import {
  getAlarmPresetLabel,
  resolveAlarmPresetOptions,
  type EditableAlarmPresetKey,
} from "@/lib/alarm-presets";

import { queryKeys } from "@/lib/query-keys";
import { weekStartDayOptions, type WeekStartDay } from "@/lib/settings";
import { getTimeChangedMessage } from "@/lib/time-format";

import { AlarmPresetSection } from "./_components/alarm-preset-section";
import { BricksManageSection } from "./_components/bricks-manage-section";
import { CategoryManageSection } from "./_components/category-manage-section";
import { CalendarSection } from "./_components/calendar-section";
import { DarkModeSection } from "./_components/dark-mode-section";
import { FeedbackSection } from "./_components/feedback-section";
import { LogoutConfirmDialog } from "./_components/logout-confirm-dialog";
import { LogoutSection } from "./_components/logout-section";
import { NotificationsSection } from "./_components/notifications-section";
import { PasswordSection } from "./_components/password-section";
import { ProfileSection } from "./_components/profile-section";
import {
  SettingsSidebarDesktop,
  SettingsSidebarMobile,
} from "./_components/settings-sidebar";
import {
  isSettingsSection,
  sections,
  type NotificationKey,
  type SettingsSection,
} from "./_components/settings-types";
import { TimeFormatSection } from "./_components/time-format-section";
import { WeekStartDaySection } from "./_components/week-start-day-section";

function resolveWeekStartDayFromWeekend(
  weekend?: string[],
): WeekStartDay | null {
  if (!Array.isArray(weekend) || !weekend.length) {
    return null;
  }

  const firstWeekendValue = weekend[0];
  if (typeof firstWeekendValue !== "string") {
    return null;
  }

  const normalizedWeekendDay = firstWeekendValue.trim().toLowerCase();
  return weekStartDayOptions.some((option) => option.key === normalizedWeekendDay)
    ? (normalizedWeekendDay as WeekStartDay)
    : null;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { preferences, updatePreferences } = useAppState();
  const initialParamsHandled = React.useRef(false);
  const didSyncWeekStartFromProfile = React.useRef(false);
  const didSyncTimeFormatFromProfile = React.useRef(false);
  const didSyncNotificationsFromProfile = React.useRef(false);

  const [activeSection, setActiveSection] =
    React.useState<SettingsSection>("profile");

  const [name, setName] = React.useState("");
  const [selectedAvatar, setSelectedAvatar] = React.useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null);

  const [oldPassword, setOldPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const [savingAlarmPresetOptionKey, setSavingAlarmPresetOptionKey] =
    React.useState<EditableAlarmPresetKey | null>(null);
  const [feedbackMessage, setFeedbackMessage] = React.useState("");
  const [feedbackPhotos, setFeedbackPhotos] = React.useState<File[]>([]);
  const [feedbackVideos, setFeedbackVideos] = React.useState<File[]>([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = React.useState(false);
  const [notificationPrefs, setNotificationPrefs] = React.useState<
    Record<NotificationKey, boolean>
  >({
    anyMessages: true,
    taggedMessages: true,
    eventsAlarm: true,
    todosAlarm: true,
  });

  const profileQuery = useQuery({
    queryKey: queryKeys.profile,
    queryFn: userApi.getProfile,
  });

  const feedbackQuery = useQuery({
    queryKey: queryKeys.feedbacks,
    queryFn: feedbackApi.getAll,
  });
  const alarmPresetOptions = React.useMemo(
    () => resolveAlarmPresetOptions(profileQuery.data?.preferences?.alarmPresetOptions),
    [profileQuery.data?.preferences?.alarmPresetOptions],
  );

  React.useEffect(() => {
    if (!profileQuery.data) {
      return;
    }

    setName(profileQuery.data.name || "");
    setAvatarPreview(profileQuery.data.avatar?.url || null);
  }, [profileQuery.data]);

  React.useEffect(() => {
    if (!profileQuery.data || didSyncWeekStartFromProfile.current) {
      return;
    }

    didSyncWeekStartFromProfile.current = true;
    const backendWeekStartDay = resolveWeekStartDayFromWeekend(
      profileQuery.data.weekend,
    );

    if (backendWeekStartDay) {
      updatePreferences({ weekStartDay: backendWeekStartDay });
    }
  }, [profileQuery.data, updatePreferences]);

  React.useEffect(() => {
    if (!profileQuery.data || didSyncTimeFormatFromProfile.current) {
      return;
    }

    didSyncTimeFormatFromProfile.current = true;
    const backendTimeFormat = profileQuery.data.preferences?.use24HourFormat;

    if (typeof backendTimeFormat === "boolean") {
      updatePreferences({ use24Hour: backendTimeFormat });
    }
  }, [profileQuery.data, updatePreferences]);

  React.useEffect(() => {
    if (!profileQuery.data || didSyncNotificationsFromProfile.current) {
      return;
    }

    didSyncNotificationsFromProfile.current = true;
    const backendNotifications = profileQuery.data.preferences?.notificationSettings;

    if (!backendNotifications) {
      return;
    }

    setNotificationPrefs({
      anyMessages: backendNotifications.anyMessages,
      taggedMessages: backendNotifications.taggedMessages,
      eventsAlarm: backendNotifications.eventsAlarm,
      todosAlarm: backendNotifications.todosAlarm,
    });
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
      setActiveSection("bricksManage");
    }
    if (modal === "category-manage") {
      setActiveSection("categoryManage");
    }
    if (modal === "week-start-day") {
      setActiveSection("weekStartDay");
    }

    const googleCalendarParam = params.get("googleCalendar");
    if (googleCalendarParam === "connected") {
      toast.success("Google Calendar connected — running first sync");
      queryClient.invalidateQueries({ queryKey: queryKeys.googleCalendarStatus });
      googleCalendarApi.sync().then(() => {
        queryClient.invalidateQueries({ queryKey: ["events"] });
        queryClient.invalidateQueries({ queryKey: queryKeys.googleCalendarStatus });
      }).catch(() => {});
      const cleaned = new URL(window.location.href);
      cleaned.searchParams.delete("googleCalendar");
      cleaned.searchParams.delete("reason");
      window.history.replaceState({}, "", cleaned.toString());
    } else if (googleCalendarParam === "error") {
      const reason = params.get("reason") || "unknown";
      toast.error(`Google Calendar connect failed: ${reason}`);
      const cleaned = new URL(window.location.href);
      cleaned.searchParams.delete("googleCalendar");
      cleaned.searchParams.delete("reason");
      window.history.replaceState({}, "", cleaned.toString());
    }
  }, [queryClient]);

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

  const updateWeekStartDayMutation = useMutation({
    mutationFn: ({
      day,
    }: {
      day: WeekStartDay;
      previousDay: WeekStartDay;
    }) => {
      const formData = new FormData();
      formData.append("weekend", JSON.stringify([day]));
      return userApi.updateProfile(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile });
    },
    onError: (error: Error, variables) => {
      updatePreferences({ weekStartDay: variables.previousDay });
      toast.error(error.message || "Failed to update week start day");
    },
  });

  const handleWeekStartDayChange = React.useCallback(
    (day: WeekStartDay) => {
      if (day === preferences.weekStartDay) {
        return;
      }

      const previousDay = preferences.weekStartDay;
      updatePreferences({ weekStartDay: day });
      updateWeekStartDayMutation.mutate({ day, previousDay });
    },
    [
      preferences.weekStartDay,
      updatePreferences,
      updateWeekStartDayMutation,
    ],
  );

  const updateTimeFormatMutation = useMutation({
    mutationFn: ({
      use24HourFormat,
    }: {
      use24HourFormat: boolean;
      previousUse24Hour: boolean;
    }) => userApi.updateTimeFormatPreference({ use24HourFormat }),
    onSuccess: (_data, variables) => {
      toast.success(getTimeChangedMessage(variables.use24HourFormat));
      queryClient.invalidateQueries({ queryKey: queryKeys.profile });
    },
    onError: (error: Error, variables) => {
      updatePreferences({ use24Hour: variables.previousUse24Hour });
      toast.error(error.message || "Failed to update time format");
    },
  });

  const handleTimeFormatToggle = React.useCallback(
    (value: boolean) => {
      if (value === preferences.use24Hour) {
        return;
      }

      const previousUse24Hour = preferences.use24Hour;
      updatePreferences({ use24Hour: value });
      updateTimeFormatMutation.mutate({
        use24HourFormat: value,
        previousUse24Hour,
      });
    },
    [
      preferences.use24Hour,
      updatePreferences,
      updateTimeFormatMutation,
    ],
  );

  const updateAlarmPresetOptionMutation = useMutation({
    mutationFn: ({
      key,
      offsetsInMinutes,
    }: {
      key: EditableAlarmPresetKey;
      offsetsInMinutes: number[];
    }) => userApi.updateAlarmPresetOption({ key, offsetsInMinutes }),
    onSuccess: (_data, variables) => {
      toast.success(
        `${getAlarmPresetLabel(variables.key, alarmPresetOptions)} updated`,
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.profile });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update preset timing");
    },
    onSettled: () => {
      setSavingAlarmPresetOptionKey(null);
    },
  });

  const handleAlarmPresetOptionSave = React.useCallback(
    ({
      key,
      offsetsInMinutes,
    }: {
      key: EditableAlarmPresetKey;
      offsetsInMinutes: number[];
    }) => {
      setSavingAlarmPresetOptionKey(key);
      updateAlarmPresetOptionMutation.mutate({ key, offsetsInMinutes });
    },
    [updateAlarmPresetOptionMutation],
  );

  const updateNotificationMutation = useMutation({
    mutationFn: ({
      key,
      value,
    }: {
      key: NotificationKey;
      value: boolean;
      previousValue: boolean;
      optionName: string;
    }) =>
      userApi.updateNotificationPreferences({
        [key]: value,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile });
    },
    onError: (error: Error, variables) => {
      setNotificationPrefs((prev) => ({ ...prev, [variables.key]: variables.previousValue }));
      toast.error(error.message || "Failed to update notification preference");
    },
  });

  const handleNotificationToggle = React.useCallback(
    (key: NotificationKey, value: boolean, optionName: string) => {
      const previousValue = notificationPrefs[key];
      if (previousValue === value) {
        return;
      }

      setNotificationPrefs((prev) => ({ ...prev, [key]: value }));
      toast.success(
        `Notifications ${value ? "enabled" : "disabled"} for ${optionName}`,
      );
      updateNotificationMutation.mutate({
        key,
        value,
        previousValue,
        optionName,
      });
    },
    [notificationPrefs, updateNotificationMutation],
  );

  const googleCalendarStatusQuery = useQuery({
    queryKey: queryKeys.googleCalendarStatus,
    queryFn: googleCalendarApi.getStatus,
  });

  const connectGoogleCalendarMutation = useMutation({
    mutationFn: async () => googleCalendarApi.getAuthUrl(),
    onSuccess: ({ authUrl }) => {
      window.location.href = authUrl;
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to start Google Calendar connection");
    },
  });

  // When the stored Google token lacks calendar scope, clear it and immediately
  // redirect to OAuth so the user re-grants with the proper permission. This
  // happens automatically the first time `Sync` is clicked after a scope upgrade.
  const reconnectAfterScopeFailure = React.useCallback(async () => {
    try {
      await googleCalendarApi.disconnect();
    } catch {
      // ignore — even if disconnect fails, the OAuth flow will re-grant tokens.
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.googleCalendarStatus });
    try {
      const { authUrl } = await googleCalendarApi.getAuthUrl();
      toast.info("Reconnecting Google Calendar with calendar permission…");
      window.location.href = authUrl;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to start reconnect flow";
      toast.error(message);
    }
  }, [queryClient]);

  const isScopeMessage = (message: string | null | undefined): boolean => {
    if (!message) return false;
    return (
      message.includes("didn't grant calendar access") ||
      message.includes("insufficient authentication scopes") ||
      message.includes("insufficient_scope") ||
      message.includes("PERMISSION_DENIED")
    );
  };

  const googleCalendarSyncMutation = useMutation({
    mutationFn: () => googleCalendarApi.sync(),
    onSuccess: ({ inbound, outbound, inboundError, outboundError }) => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.googleCalendarStatus });

      // If either side failed because of a scope problem, auto-restart OAuth
      // instead of asking the user to dig through MongoDB.
      if (
        isScopeMessage(outboundError) ||
        isScopeMessage(inboundError) ||
        isScopeMessage(outbound?.firstError)
      ) {
        reconnectAfterScopeFailure();
        return;
      }

      if (outboundError) {
        toast.error(`Push to Google Calendar failed: ${outboundError}`);
        return;
      }
      if (inboundError) {
        toast.error(`Pull from Google Calendar failed: ${inboundError}`);
        return;
      }
      if (outbound.failed && outbound.firstError) {
        toast.error(
          `${outbound.failed} event(s) failed to push to Google: ${outbound.firstError}`,
        );
        return;
      }

      const inboundChanges = inbound.imported + inbound.updated + inbound.cancelled;
      if (!inboundChanges && !outbound.pushed && !outbound.failed) {
        toast.info("Google Calendar already in sync");
        return;
      }

      const parts: string[] = [];
      if (inbound.imported) parts.push(`${inbound.imported} imported`);
      if (inbound.updated) parts.push(`${inbound.updated} updated`);
      if (inbound.cancelled) parts.push(`${inbound.cancelled} cancelled`);
      if (outbound.pushed) parts.push(`${outbound.pushed} pushed to Google`);
      if (outbound.failed) parts.push(`${outbound.failed} failed`);

      toast.success(`Sync complete: ${parts.join(", ")}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Google Calendar sync failed");
    },
  });

  const disconnectGoogleCalendarMutation = useMutation({
    mutationFn: () => googleCalendarApi.disconnect(),
    onSuccess: () => {
      toast.success("Google Calendar disconnected");
      queryClient.invalidateQueries({ queryKey: queryKeys.googleCalendarStatus });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to disconnect Google Calendar");
    },
  });

  // Single click handler for the existing "Sync Google Calendar" button:
  // - If not connected → start Google OAuth (consent flow). After redirect-back,
  //   the page-mount effect auto-runs the first sync.
  // - If connected     → run two-way sync immediately.
  const handleGoogleCalendarSyncClick = React.useCallback(() => {
    if (googleCalendarStatusQuery.data?.connected) {
      googleCalendarSyncMutation.mutate();
    } else {
      connectGoogleCalendarMutation.mutate();
    }
  }, [
    googleCalendarStatusQuery.data?.connected,
    googleCalendarSyncMutation,
    connectGoogleCalendarMutation,
  ]);

  const isGoogleCalendarBusy =
    googleCalendarStatusQuery.isLoading ||
    connectGoogleCalendarMutation.isPending ||
    googleCalendarSyncMutation.isPending;

  // Reference disconnect mutation to silence unused warning — exposed for future UI.
  void disconnectGoogleCalendarMutation;

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

  const feedbackMutation = useMutation({
    mutationFn: () => {
      const nextMessage = feedbackMessage.trim();
      if (!nextMessage) {
        throw new Error("Please write feedback");
      }

      const formData = new FormData();
      formData.append("message", nextMessage);

      feedbackPhotos.forEach((photo) => {
        formData.append("photos", photo);
      });
      feedbackVideos.forEach((video) => {
        formData.append("videos", video);
      });

      return feedbackApi.create(formData);
    },
    onSuccess: () => {
      toast.success("Feedback sent");
      setFeedbackMessage("");
      setFeedbackPhotos([]);
      setFeedbackVideos([]);
      queryClient.invalidateQueries({ queryKey: queryKeys.feedbacks });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to submit feedback");
    },
  });

  const handleAddFeedbackPhotos = (files: FileList | null) => {
    if (!files?.length) {
      return;
    }

    const nextPhotos = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );

    if (!nextPhotos.length) {
      toast.error("Please choose image files");
      return;
    }

    setFeedbackPhotos((previous) => {
      const slots = 5 - previous.length;
      if (slots <= 0) {
        toast.error("Maximum 5 photos allowed");
        return previous;
      }

      const filesToAdd = nextPhotos.slice(0, slots);
      if (filesToAdd.length < nextPhotos.length) {
        toast.error("Maximum 5 photos allowed");
      }

      return [...previous, ...filesToAdd];
    });
  };

  const handleAddFeedbackVideos = (files: FileList | null) => {
    if (!files?.length) {
      return;
    }

    const nextVideos = Array.from(files).filter((file) =>
      file.type.startsWith("video/"),
    );

    if (!nextVideos.length) {
      toast.error("Please choose video files");
      return;
    }

    setFeedbackVideos((previous) => {
      const slots = 5 - previous.length;
      if (slots <= 0) {
        toast.error("Maximum 5 videos allowed");
        return previous;
      }

      const filesToAdd = nextVideos.slice(0, slots);
      if (filesToAdd.length < nextVideos.length) {
        toast.error("Maximum 5 videos allowed");
      }

      return [...previous, ...filesToAdd];
    });
  };

  const handleFeedbackSubmit = () => {
    feedbackMutation.mutate();
  };

  const profileName =
    profileQuery.data?.name || profileQuery.data?.username || "User";
  const profileEmail = profileQuery.data?.email || "";
  const profileUsername = profileQuery.data?.username || "";

  const primarySections = sections.filter((section) => !section.support);
  const supportSections = sections.filter((section) => section.support);
  const currentWeekStartLabel =
    weekStartDayOptions.find(
      (option) => option.key === preferences.weekStartDay,
    )?.label || "Monday";

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
        return <BricksManageSection />;
      case "categoryManage":
        return <CategoryManageSection />;
      case "weekStartDay":
        return (
          <WeekStartDaySection
            currentWeekStartLabel={currentWeekStartLabel}
            selectedDay={preferences.weekStartDay}
            onSelect={handleWeekStartDayChange}
          />
        );
      case "switchTimeFormat":
        return (
          <TimeFormatSection
            use24Hour={preferences.use24Hour}
            onToggle={handleTimeFormatToggle}
          />
        );
      case "alarmPreset":
        return (
          <AlarmPresetSection
            options={alarmPresetOptions}
            onSaveOption={handleAlarmPresetOptionSave}
            savingKey={savingAlarmPresetOptionKey}
          />
        );
      case "darkMode":
        return (
          <DarkModeSection
            darkMode={preferences.darkMode}
            onToggle={(value) => updatePreferences({ darkMode: value })}
          />
        );
      case "notificationsReminders":
        return (
          <NotificationsSection
            prefs={notificationPrefs}
            onToggle={handleNotificationToggle}
          />
        );
      case "calendar":
        return (
          <CalendarSection
            onManageWeekStartDay={() => setActiveSection("weekStartDay")}
            onCalendarSync={handleGoogleCalendarSyncClick}
            isCalendarSyncing={isGoogleCalendarBusy}
          />
        );
      case "feedback":
        return (
          <FeedbackSection
            feedbacks={feedbackQuery.data || []}
            isFeedbacksLoading={feedbackQuery.isLoading}
            isSubmitting={feedbackMutation.isPending}
            message={feedbackMessage}
            photos={feedbackPhotos}
            videos={feedbackVideos}
            onAddPhotos={handleAddFeedbackPhotos}
            onAddVideos={handleAddFeedbackVideos}
            onChangeMessage={setFeedbackMessage}
            onRemovePhoto={(index) =>
              setFeedbackPhotos((previous) =>
                previous.filter((_, currentIndex) => currentIndex !== index),
              )
            }
            onRemoveVideo={(index) =>
              setFeedbackVideos((previous) =>
                previous.filter((_, currentIndex) => currentIndex !== index),
              )
            }
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
    <div className="settings-page space-y-3">
      <div className="settings-mobile-header font-poppins flex items-center justify-between rounded-2xl border p-3 shadow-[0_12px_30px_rgba(17,24,37,0.10)] xl:hidden">
        <div>
          <h1 className="font-poppins text-[24px] leading-[120%] font-semibold text-[var(--text-strong)]">
            Settings
          </h1>
          <p className="font-poppins text-[14px] leading-[120%] font-normal text-[var(--text-muted)]">
            Account and preferences
          </p>
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

      <div className="settings-layout font-poppins grid gap-1 xl:grid-cols-[340px_minmax(0,1fr)]">
        <SettingsSidebarDesktop
          activeSection={activeSection}
          primarySections={primarySections}
          supportSections={supportSections}
          onSectionSelect={handleSectionSelect}
        />

        <main className="settings-content-panel rounded-r-xl border border-[#E0E5EE] bg-[#ECEFF4] p-4 sm:p-6">
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

      <LogoutConfirmDialog
        open={logoutModalOpen}
        onOpenChange={setLogoutModalOpen}
        onConfirm={() => logoutMutation.mutate()}
        isPending={logoutMutation.isPending}
      />
    </div>
  );
}
