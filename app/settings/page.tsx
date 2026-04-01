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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authApi, eventApi, feedbackApi, userApi } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { weekStartDayOptions, type WeekStartDay } from "@/lib/settings";

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
import {
  SettingsSidebarDesktop,
  SettingsSidebarMobile,
} from "./_components/settings-sidebar";
import {
  isSettingsSection,
  sections,
  type AlarmPreset,
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

const GOOGLE_GSI_SCRIPT_URL = "https://accounts.google.com/gsi/client";
const GOOGLE_CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.readonly";
const GOOGLE_CALENDAR_EVENTS_LIMIT = 100;

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleTokenClient = {
  requestAccessToken: (config?: { prompt?: string }) => void;
};

type GoogleOAuth2Namespace = {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: GoogleTokenResponse) => void;
    error_callback?: () => void;
  }) => GoogleTokenClient;
};

type GoogleOAuthWindow = Window & {
  google?: {
    accounts?: {
      oauth2?: GoogleOAuth2Namespace;
    };
  };
};

type GoogleCalendarEvent = {
  id: string;
  status?: string;
  summary?: string;
  location?: string;
  start?: {
    date?: string;
    dateTime?: string;
  };
  end?: {
    date?: string;
    dateTime?: string;
  };
};

type SyncCandidateEvent = {
  title: string;
  location?: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
};

function createSyncEventKey(event: SyncCandidateEvent) {
  const title = event.title.trim().toLowerCase();
  const location = (event.location || "").trim().toLowerCase();
  const startTime = new Date(event.startTime).getTime();
  const endTime = new Date(event.endTime).getTime();
  const allDayFlag = event.isAllDay ? "1" : "0";

  return `${title}|${location}|${startTime}|${endTime}|${allDayFlag}`;
}

function toSyncCandidateEvent(
  googleEvent: GoogleCalendarEvent,
): SyncCandidateEvent | null {
  if (googleEvent.status === "cancelled") {
    return null;
  }

  const title = (googleEvent.summary || "Untitled event").trim();
  const location = googleEvent.location?.trim() || undefined;

  if (googleEvent.start?.date && googleEvent.end?.date) {
    const start = new Date(`${googleEvent.start.date}T00:00:00`);
    const endExclusive = new Date(`${googleEvent.end.date}T00:00:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(endExclusive.getTime())) {
      return null;
    }

    const end = new Date(endExclusive.getTime() - 1);
    if (end.getTime() < start.getTime()) {
      return null;
    }

    return {
      title,
      location,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      isAllDay: true,
    };
  }

  if (googleEvent.start?.dateTime && googleEvent.end?.dateTime) {
    const start = new Date(googleEvent.start.dateTime);
    const end = new Date(googleEvent.end.dateTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return null;
    }

    if (end.getTime() <= start.getTime()) {
      return null;
    }

    return {
      title,
      location,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      isAllDay: false,
    };
  }

  return null;
}

function loadGoogleIdentityScript() {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Google sign-in is only available in the browser"));
      return;
    }

    const googleWindow = window as GoogleOAuthWindow;
    if (googleWindow.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const existingScript = document.querySelector(
      "script[data-google-gsi='true']",
    ) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Failed to load Google sign-in script")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = GOOGLE_GSI_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.dataset.googleGsi = "true";
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load Google sign-in script"));
    document.head.appendChild(script);
  });
}

async function requestGoogleAccessToken(clientId: string) {
  await loadGoogleIdentityScript();

  const googleWindow = window as GoogleOAuthWindow;
  const oauth2 = googleWindow.google?.accounts?.oauth2;

  if (!oauth2) {
    throw new Error("Google sign-in client is unavailable");
  }

  return new Promise<string>((resolve, reject) => {
    const tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_CALENDAR_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(
            new Error(
              response.error_description ||
                response.error ||
                "Failed to authorize Google Calendar",
            ),
          );
          return;
        }

        resolve(response.access_token);
      },
      error_callback: () =>
        reject(new Error("Google sign-in was cancelled or failed")),
    });

    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

async function fetchGoogleCalendarEvents(accessToken: string) {
  const url = new URL(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
  );
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("timeMin", new Date().toISOString());
  url.searchParams.set("maxResults", String(GOOGLE_CALENDAR_EVENTS_LIMIT));

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = (await response.json()) as {
    items?: GoogleCalendarEvent[];
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(
      data.error?.message || "Failed to fetch events from Google Calendar",
    );
  }

  return data.items || [];
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { preferences, updatePreferences } = useAppState();
  const initialParamsHandled = React.useRef(false);
  const didSyncWeekStartFromProfile = React.useRef(false);

  const [activeSection, setActiveSection] =
    React.useState<SettingsSection>("profile");

  const [name, setName] = React.useState("");
  const [selectedAvatar, setSelectedAvatar] = React.useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null);

  const [oldPassword, setOldPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const [alarmPreset, setAlarmPreset] = React.useState<AlarmPreset>("none");
  const [feedbackMessage, setFeedbackMessage] = React.useState("");
  const [feedbackPhotos, setFeedbackPhotos] = React.useState<File[]>([]);
  const [feedbackVideos, setFeedbackVideos] = React.useState<File[]>([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = React.useState(false);
  const [bricksManageModalOpen, setBricksManageModalOpen] =
    React.useState(false);
  const [weekStartModalOpen, setWeekStartModalOpen] = React.useState(false);
  const [notificationPrefs, setNotificationPrefs] = React.useState<
    Record<NotificationKey, boolean>
  >({
    anyMessages: true,
    taggedMessages: true,
    eventAlarms: true,
    todoAlarms: true,
  });

  const profileQuery = useQuery({
    queryKey: queryKeys.profile,
    queryFn: userApi.getProfile,
  });

  const feedbackQuery = useQuery({
    queryKey: queryKeys.feedbacks,
    queryFn: feedbackApi.getAll,
  });

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

  const googleCalendarSyncMutation = useMutation({
    mutationFn: async () => {
      const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
      if (!googleClientId) {
        throw new Error("Google client ID is not configured");
      }

      const accessToken = await requestGoogleAccessToken(googleClientId);
      const [googleEvents, existingEvents] = await Promise.all([
        fetchGoogleCalendarEvents(accessToken),
        eventApi.getAll({ filter: "all" }),
      ]);

      const existingEventKeys = new Set(
        existingEvents
          .map((event) => {
            const start = new Date(event.startTime);
            const end = new Date(event.endTime);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
              return null;
            }

            return createSyncEventKey({
              title: event.title || "Untitled event",
              location: event.location || undefined,
              startTime: start.toISOString(),
              endTime: end.toISOString(),
              isAllDay: Boolean(event.isAllDay),
            });
          })
          .filter((key): key is string => Boolean(key)),
      );

      let imported = 0;
      let skipped = 0;
      let failed = 0;

      for (const googleEvent of googleEvents) {
        const candidate = toSyncCandidateEvent(googleEvent);
        if (!candidate) {
          skipped += 1;
          continue;
        }

        const candidateKey = createSyncEventKey(candidate);
        if (existingEventKeys.has(candidateKey)) {
          skipped += 1;
          continue;
        }

        try {
          await eventApi.create({
            title: candidate.title,
            startTime: candidate.startTime,
            endTime: candidate.endTime,
            isAllDay: candidate.isAllDay,
            location: candidate.location,
            recurrence: "once",
          });
          existingEventKeys.add(candidateKey);
          imported += 1;
        } catch {
          failed += 1;
        }
      }

      return {
        scanned: googleEvents.length,
        imported,
        skipped,
        failed,
      };
    },
    onSuccess: ({ scanned, imported, skipped, failed }) => {
      queryClient.invalidateQueries({ queryKey: ["events"] });

      if (!scanned) {
        toast.info("No upcoming Google Calendar events found");
        return;
      }

      if (!imported && !failed) {
        toast.info(`Google Calendar already in sync (${skipped} skipped)`);
        return;
      }

      if (failed) {
        toast.warning(
          `Google sync finished: ${imported} imported, ${skipped} skipped, ${failed} failed`,
        );
        return;
      }

      toast.success(
        `Google sync finished: ${imported} imported, ${skipped} skipped`,
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || "Google Calendar sync failed");
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

  const updateNotification = (key: NotificationKey, value: boolean) => {
    setNotificationPrefs((prev) => ({ ...prev, [key]: value }));
  };

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
        return (
          <BricksManageSection
            onOpenModal={() => setBricksManageModalOpen(true)}
          />
        );
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
        return (
          <AlarmPresetSection value={alarmPreset} onChange={setAlarmPreset} />
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
            onToggle={updateNotification}
          />
        );
      case "calendar":
        return (
          <CalendarSection
            onManageWeekStartDay={() => setActiveSection("weekStartDay")}
            onCalendarSync={() => googleCalendarSyncMutation.mutate()}
            isCalendarSyncing={googleCalendarSyncMutation.isPending}
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

      <Dialog
        open={bricksManageModalOpen}
        onOpenChange={setBricksManageModalOpen}
      >
        <DialogContent className="max-h-[88vh] max-w-[1100px] overflow-y-auto rounded-[30px] border border-[var(--border)] bg-[var(--surface-1)] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="font-poppins text-[30px] leading-[120%] font-semibold text-[#1E2430] sm:text-[36px] lg:text-[40px]">
              Bricks Manage
            </DialogTitle>
            <DialogDescription>
              Manage brick name, icon, and color from this modal.
            </DialogDescription>
          </DialogHeader>
          <BricksManagePanel />
        </DialogContent>
      </Dialog>

      <Dialog open={weekStartModalOpen} onOpenChange={setWeekStartModalOpen}>
        <DialogContent className="max-w-3xl rounded-[30px] border border-[var(--border)] bg-[var(--surface-1)] p-4 sm:p-6 space-y-2">
          <DialogHeader>
            <DialogTitle className="font-poppins text-[24px] leading-[120%] font-semibold text-[#1E2430] sm:text-[24px] lg:text-[40px]">
              Manage weeks start day
            </DialogTitle>
            <DialogDescription>
              Choose the first day of your week calendar.
            </DialogDescription>
          </DialogHeader>
          <WeekStartDayPanel
            selectedDay={preferences.weekStartDay}
            onSelect={handleWeekStartDayChange}
          />
        </DialogContent>
      </Dialog>

      <LogoutConfirmDialog
        open={logoutModalOpen}
        onOpenChange={setLogoutModalOpen}
        onConfirm={() => logoutMutation.mutate()}
        isPending={logoutMutation.isPending}
      />
    </div>
  );
}
