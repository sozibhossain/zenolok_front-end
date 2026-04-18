"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  formatDistanceToNow,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Search,
  Settings,
} from "lucide-react";
import { motion } from "motion/react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAppState } from "@/components/providers/app-state-provider";
import { BrickIcon } from "@/components/shared/brick-icon";
import { notificationApi } from "@/lib/api";
import { isMessageNotification } from "@/lib/notifications";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";

const navItems = [
  {
    href: "/home",
    label: "Home",
    icon: CalendarDays,
    iconName: "home",
    activeColor: "blue" as const,
  },
  {
    href: "/events",
    label: "Events",
    icon: LayoutGrid,
    iconName: "work",
    activeColor: "blue" as const,
  },
  {
    href: "/todos",
    label: "Todos",
    icon: List,
    iconName: "default",
    activeColor: "blue" as const,
  },
];

const weekStartsOnMap: Record<string, 0 | 1 | 2 | 3 | 4 | 5 | 6> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function HomeMonthDatePicker({
  className,
  align = "start",
}: {
  className?: string;
  align?: "start" | "center" | "end";
}) {
  const minYear = 1900;
  const maxYear = 2100;
  const { monthCursor, selectedDate, setSelectedDate, preferences } = useAppState();
  const [open, setOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(() => startOfMonth(selectedDate));
  const [pickerView, setPickerView] = useState<"day" | "year">("day");
  const activeYearRef = useRef<HTMLDivElement | null>(null);
  const yearsScrollRef = useRef<HTMLDivElement | null>(null);
  const weekStartsOn = weekStartsOnMap[preferences.weekStartDay] ?? 0;

  const monthStart = useMemo(() => startOfMonth(pickerMonth), [pickerMonth]);
  const monthEnd = useMemo(() => endOfMonth(pickerMonth), [pickerMonth]);
  const calendarStart = useMemo(
    () => startOfWeek(monthStart, { weekStartsOn }),
    [monthStart, weekStartsOn],
  );
  const calendarEnd = useMemo(
    () => endOfWeek(monthEnd, { weekStartsOn }),
    [monthEnd, weekStartsOn],
  );
  const days = useMemo(
    () => eachDayOfInterval({ start: calendarStart, end: calendarEnd }),
    [calendarEnd, calendarStart],
  );
  const weekdayLabels = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const day = addDays(calendarStart, index);

        return {
          key: format(day, "EEEE"),
          label: format(day, "EEEEE"),
          isSunday: day.getDay() === 0,
        };
      }),
    [calendarStart],
  );
  const years = useMemo(
    () => Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index),
    [],
  );
  const activeYear = pickerMonth.getFullYear();

  const scrollToActiveYear = useCallback(() => {
    const scroller = yearsScrollRef.current;
    const target = activeYearRef.current;
    if (!scroller || !target || scroller.clientHeight === 0) {
      return false;
    }

    const scrollerRect = scroller.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const targetTopInScroller = targetRect.top - scrollerRect.top + scroller.scrollTop;
    const centeredScrollTop =
      targetTopInScroller - scroller.clientHeight / 2 + targetRect.height / 2;

    scroller.scrollTop = Math.max(0, centeredScrollTop);
    return true;
  }, []);

  useEffect(() => {
    if (!open || pickerView !== "year") {
      return;
    }

    const frameId = window.requestAnimationFrame(scrollToActiveYear);
    return () => window.cancelAnimationFrame(frameId);
  }, [open, pickerView, activeYear, scrollToActiveYear]);

  const handleSelectDate = (day: Date) => {
    setSelectedDate(day);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setPickerMonth(startOfMonth(selectedDate));
          setPickerView("day");
        }

        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-left transition hover:bg-[var(--surface-1)] hover:text-[var(--text-strong)]",
            className,
          )}
          aria-label={`Open date picker for ${format(monthCursor, "MMMM yyyy")}`}
        >
          {format(monthCursor, "MMMM yyyy")}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={12}
        collisionPadding={12}
        className="w-[min(calc(100vw-1rem),390px)] rounded-[26px] border-[var(--ui-calendar-popup-border)] bg-[var(--ui-calendar-popup-bg)] p-4 text-[var(--ui-calendar-popup-strong)] shadow-[0_22px_45px_rgba(15,23,42,0.12)]"
      >
        <div className="space-y-3">
          <p className="font-poppins inline-flex items-center gap-2 text-[18px] leading-[120%] font-medium text-[var(--ui-calendar-popup-title)]">
            <CalendarDays className="size-4" />
            Choose a date
          </p>

          <div className="rounded-[22px] bg-[var(--ui-calendar-popup-panel-bg)] p-3">
            {pickerView === "year" ? (
              <div className="space-y-3">
                <div
                  ref={yearsScrollRef}
                  className="max-h-[258px] space-y-4 overflow-y-auto pr-1"
                >
                  {years.map((year) => (
                    <div
                      key={year}
                      ref={year === activeYear ? activeYearRef : null}
                    >
                      <p className="mb-2 text-[30px] leading-none font-medium text-[var(--ui-calendar-popup-year)]">
                        {year}
                      </p>
                      <div className="grid grid-cols-6 gap-2">
                        {Array.from({ length: 12 }, (_, index) => {
                          const monthDate = new Date(year, index, 1);
                          const active =
                            pickerMonth.getFullYear() === year &&
                            pickerMonth.getMonth() === index;

                          return (
                            <motion.button
                              key={`${year}-${index}`}
                              type="button"
                              onClick={() => {
                                setPickerMonth(monthDate);
                                setPickerView("day");
                              }}
                              className={cn(
                                "flex size-10 items-center justify-center rounded-full text-[20px] leading-none text-white transition-colors",
                                active
                                  ? "bg-[var(--ui-calendar-accent)]"
                                  : "bg-[var(--ui-calendar-neutral-bg)] hover:bg-[var(--ui-calendar-neutral-hover)]",
                              )}
                              aria-label={`Select ${format(monthDate, "MMMM yyyy")}`}
                              whileTap={{ scale: 0.95 }}
                            >
                              {index + 1}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-end">
                  <motion.button
                    type="button"
                    onClick={() => setPickerView("day")}
                    className="rounded-full px-3 py-1 text-[12px] text-[var(--ui-calendar-popup-subtle)] transition hover:bg-[var(--ui-calendar-popup-input-bg)] hover:text-[var(--ui-calendar-popup-strong)]"
                    whileTap={{ scale: 0.97 }}
                  >
                    Back
                  </motion.button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1">
                    <motion.button
                      type="button"
                      onClick={() => setPickerMonth((current) => addMonths(current, -1))}
                      className="rounded-full p-1 text-[var(--ui-calendar-popup-nav)] transition hover:bg-[var(--ui-calendar-popup-input-bg)] hover:text-[var(--ui-calendar-popup-strong)]"
                      aria-label="Previous month"
                      whileTap={{ scale: 0.95 }}
                    >
                      <ChevronLeft className="size-4" />
                    </motion.button>

                    <motion.button
                      type="button"
                      onClick={() => setPickerView("year")}
                      className="min-w-[156px] rounded-full px-2 py-1 text-center text-[22px] leading-none font-medium text-[var(--ui-calendar-popup-strong)] transition hover:bg-[var(--ui-calendar-popup-input-bg)] sm:text-[24px]"
                      aria-label={`Open year picker for ${format(pickerMonth, "MMMM yyyy")}`}
                      whileTap={{ scale: 0.98 }}
                    >
                      {format(pickerMonth, "MMMM yyyy")}
                    </motion.button>

                    <motion.button
                      type="button"
                      onClick={() => setPickerMonth((current) => addMonths(current, 1))}
                      className="rounded-full p-1 text-[var(--ui-calendar-popup-nav)] transition hover:bg-[var(--ui-calendar-popup-input-bg)] hover:text-[var(--ui-calendar-popup-strong)]"
                      aria-label="Next month"
                      whileTap={{ scale: 0.95 }}
                    >
                      <ChevronRight className="size-4" />
                    </motion.button>
                  </div>

                  <motion.button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[16px] text-[var(--ui-calendar-popup-subtle)] transition hover:text-[var(--ui-calendar-popup-strong)]"
                    whileTap={{ scale: 0.97 }}
                  >
                    Done
                    <ChevronRight className="size-4" />
                  </motion.button>
                </div>

                <div className="mt-4 grid grid-cols-7 gap-2 px-0.5">
                  {weekdayLabels.map((weekday) => (
                    <p
                      key={weekday.key}
                      className={cn(
                        "text-center text-[11px] leading-none",
                        weekday.isSunday
                          ? "text-[var(--ui-calendar-accent)]"
                          : "text-[var(--ui-calendar-popup-weekday)]",
                      )}
                    >
                      {weekday.label}
                    </p>
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-7 gap-x-0 gap-y-2">
                  {days.map((day) => {
                    const inCurrentMonth = isSameMonth(day, pickerMonth);
                    const selected = isSameDay(day, selectedDate);
                    const isSunday = inCurrentMonth && day.getDay() === 0;

                    return (
                      <motion.button
                        key={format(day, "yyyy-MM-dd")}
                        type="button"
                        onClick={() => handleSelectDate(day)}
                        className={cn(
                          "mx-auto flex h-9 items-center justify-center rounded-full text-[17px] leading-none transition-colors",
                          selected
                            ? "size-9 bg-[#474954] text-white hover:bg-[#3e4049]"
                            : isSunday
                              ? "size-9 bg-[var(--ui-calendar-accent)] text-white hover:bg-[var(--ui-calendar-accent-hover)]"
                              : inCurrentMonth
                                ? "size-9 bg-[var(--ui-calendar-neutral-bg)] text-white hover:bg-[var(--ui-calendar-neutral-hover)]"
                                : "size-9 bg-[var(--ui-calendar-outside-bg)] text-[var(--ui-calendar-outside-text)]",
                        )}
                        aria-label={`Select ${format(day, "MMMM d, yyyy")}`}
                        whileTap={{ scale: 0.95 }}
                      >
                        {format(day, "d")}
                      </motion.button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AppTopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activeNotificationCategory, setActiveNotificationCategory] = useState<
    "messages" | "system" | "all"
  >("all");
  const [showUnreadNotificationsOnly, setShowUnreadNotificationsOnly] =
    useState(false);
  const { goToToday, goToPreviousMonth, goToNextMonth, preferences } =
    useAppState();
  const isHomePage =
    pathname === "/home" || pathname.startsWith("/home/");
  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: notificationApi.getAll,
    enabled: Boolean(session),
    staleTime: 30_000,
  });
  const markAsReadMutation = useMutation({
    mutationFn: notificationApi.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
  const markAsUnreadMutation = useMutation({
    mutationFn: notificationApi.markAsUnread,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
  const markAllReadMutation = useMutation({
    mutationFn: notificationApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
  const notifications = notificationsQuery.data?.items ?? [];
  const serverCounts = notificationsQuery.data?.counts;
  const unreadCount = serverCounts?.all.unread ?? notifications.filter((item) => !item.read).length;
  const messageNotifications = notifications.filter((item) =>
    isMessageNotification(item),
  );
  const systemNotifications = notifications.filter(
    (item) => !isMessageNotification(item),
  );
  const categoryNotifications =
    activeNotificationCategory === "messages"
      ? messageNotifications
      : activeNotificationCategory === "system"
        ? systemNotifications
        : notifications;
  const displayedNotifications = showUnreadNotificationsOnly
    ? categoryNotifications.filter((item) => !item.read)
    : categoryNotifications;
  const unreadByTab = {
    messages:
      serverCounts?.messages.unread ??
      messageNotifications.filter((item) => !item.read).length,
    system:
      serverCounts?.system.unread ??
      systemNotifications.filter((item) => !item.read).length,
    all: serverCounts?.all.unread ?? unreadCount,
  };
  const emptyNotificationLabel = showUnreadNotificationsOnly
    ? activeNotificationCategory === "messages"
      ? "No unread message notifications"
      : activeNotificationCategory === "system"
        ? "No unread system notifications"
        : "No unread notifications"
    : activeNotificationCategory === "messages"
      ? "No message notifications yet"
      : activeNotificationCategory === "system"
        ? "No system notifications yet"
        : "No notifications yet";

  return (
    <motion.header
      className="app-top-nav sticky top-0 z-40 border-b backdrop-blur"
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <div className="mx-auto flex h-[76px] w-full max-w-[1180px] items-center gap-3 px-3 sm:px-5">
        <div className="flex items-center gap-3">
          <Link
            href="/home"
            className="inline-flex size-[52px] items-center justify-center rounded-[16px] border border-[var(--border)] bg-[var(--surface-1)] mr-2 shadow-[0_6px_18px_rgba(21,32,54,0.08)]"
            aria-label="Go to home"
          >
            <Image
              src={preferences.darkMode ? "/dark-mode-logo.png" : "/logo.png"}
              alt="Zenolok Logo"
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
              priority
            />
          </Link>
          {isHomePage ? (
            <>
              <Button
                className="app-top-nav-today fs-pop-20-medium-center rounded-full border px-4 py-1.5 text-[16px] sm:px-7 sm:text-[20px]"
                onClick={() => {
                  goToToday();
                  router.push("/home");
                }}
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="hidden size-9 rounded-full sm:size-10 md:inline-flex"
                aria-label="Previous period"
                onClick={goToPreviousMonth}
              >
                <ChevronLeft className="size-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="hidden size-9 rounded-full sm:size-10 md:inline-flex"
                aria-label="Next period"
                onClick={goToNextMonth}
              >
                <ChevronRight className="size-5" />
              </Button>
              <HomeMonthDatePicker
                align="start"
                className="app-top-nav-month fs-pop-20-medium-center hidden md:inline-flex"
              />
            </>
          ) : null}
        </div>

        <nav className="mx-auto hidden items-center gap-2 md:flex">
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <motion.div key={item.href} layout whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}>
                <Link
                  href={item.href}
                  data-active={active}
                  className={cn(
                    "app-top-nav-link fs-pop-20-medium-center inline-flex items-center gap-2 rounded-full px-4 py-2 transition",
                    active
                      ? "bg-[var(--nav-link-active-bg)] text-[var(--nav-link-active-text)]"
                      : "text-[var(--nav-link-text)] hover:bg-[var(--nav-link-hover-bg)]",
                  )}
                >
                  <item.icon className="size-5" />
                  {item.label}
                </Link>
              </motion.div>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="app-top-nav-icon-btn size-9 rounded-full cursor-pointer sm:size-10"
            onClick={() => router.push("/search")}
          >
            <Search className="size-5" />
          </Button>
          <Popover
            open={notificationsOpen}
            onOpenChange={(open) => {
              setNotificationsOpen(open);
              if (open) {
                notificationsQuery.refetch();
              }
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="app-top-nav-icon-btn relative size-9 rounded-full cursor-pointer sm:size-10"
                aria-label="Open notifications"
              >
                <Bell className="size-5" />
                {unreadCount ? (
                  <span className="absolute top-[-8px] right-0 inline-flex items-center justify-center rounded-full bg-[#FF3B30] px-1 text-[9px] leading-none text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="app-notification-popover w-[332px] rounded-[20px] border px-4 py-3"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-5">
                  {[
                    { key: "messages" as const, label: "Messages" },
                    { key: "system" as const, label: "System" },
                    { key: "all" as const, label: "All" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveNotificationCategory(tab.key)}
                      className={cn(
                        "relative text-[14px] leading-none transition",
                        activeNotificationCategory === tab.key
                          ? "font-medium text-[var(--text-strong)]"
                          : "text-[var(--text-muted)]",
                      )}
                    >
                      {tab.label}
                      {unreadByTab[tab.key] ? (
                        <span className="absolute -top-2.5 -right-4 inline-flex min-w-[12px] min-h-[12px] items-center justify-center rounded-full bg-[#FF3B30] px-1 text-[9px] font-medium leading-none text-white">
                          {unreadByTab[tab.key] > 99 ? "99+" : unreadByTab[tab.key]}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowUnreadNotificationsOnly((current) => !current)
                  }
                  className={cn(
                    "relative shrink-0 text-center text-[16px] leading-[16px] font-normal transition",
                    showUnreadNotificationsOnly
                      ? "text-[#32ADE6]"
                      : "text-[#97C6DC]",
                  )}
                >
                  Unread
                </button>
              </div>
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  className="text-[12px] text-[var(--text-muted)] transition hover:text-[var(--text-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={!unreadCount || markAllReadMutation.isPending}
                >
                  {markAllReadMutation.isPending ? "Marking..." : "Mark all read"}
                </button>
              </div>

              <div className="max-h-[300px] space-y-3 overflow-y-auto pr-1">
                {notificationsQuery.isLoading ? (
                  <>
                    {[40, 40, 66].map((height, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <span className="mt-3 size-4 rounded-full border border-[#D8DEE9] bg-transparent" />
                        <Skeleton className="h-[62px] flex-1 rounded-[16px]" style={{ height }} />
                      </div>
                    ))}
                  </>
                ) : notificationsQuery.isError ? (
                  <p className="py-3 text-center text-[13px] text-[#B14E4E]">
                    Failed to load notifications
                  </p>
                ) : displayedNotifications.length ? (
                  displayedNotifications.map((notification) => {
                    const createdAt = new Date(notification.createdAt);
                    const timeLabel = Number.isNaN(createdAt.getTime())
                      ? ""
                      : formatDistanceToNow(createdAt, { addSuffix: true });
                    const isTogglePending =
                      markAsReadMutation.isPending ||
                      markAsUnreadMutation.isPending;

                    return (
                      <motion.div
                        key={notification._id}
                        className="group flex w-full items-start gap-3 rounded-[18px] p-0.5 text-left"
                        whileHover={{ x: 2 }}
                        whileTap={{ scale: 0.995 }}
                      >
                        <button
                          type="button"
                          aria-label={
                            notification.read
                              ? "Mark notification as unread"
                              : "Mark notification as read"
                          }
                          className="mt-3 rounded-full disabled:cursor-not-allowed"
                          disabled={isTogglePending}
                          onClick={() => {
                            if (notification.read) {
                              markAsUnreadMutation.mutate(notification._id);
                              return;
                            }

                            markAsReadMutation.mutate(notification._id);
                          }}
                        >
                          <span
                            className={cn(
                              "block size-4 shrink-0 rounded-full border transition",
                              notification.read
                                ? "border-[#E1E6EE] bg-[#E3E8F2]"
                                : "border-[#D8DEE9] bg-transparent",
                            )}
                          />
                        </button>
                        <div
                          className={cn(
                            "min-h-[62px] flex-1 rounded-[16px] border px-4 py-3 transition",
                            notification.read
                              ? "border-[#EEF2F7] bg-[#FAFBFD]"
                              : "border-[#E3E8F1] bg-[#F8FAFD]",
                          )}
                        >
                          <p className="text-[12px] leading-[1.35] text-[var(--text-default)]">
                            {notification.title}
                          </p>
                          {timeLabel ? (
                            <p className="mt-1.5 text-[10px] text-[var(--text-muted)]">{timeLabel}</p>
                          ) : null}
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  <p className="py-6 text-center text-[13px] text-[#7D8597]">
                    {emptyNotificationLabel}
                  </p>
                )}
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="icon"
            className="app-top-nav-icon-btn inline-flex size-9 rounded-full cursor-pointer sm:size-10"
            onClick={() => router.push("/settings")}
            aria-label="Open settings"
          >
            <Settings className="size-5" />
          </Button>
          <button
            type="button"
            className="rounded-full border border-transparent transition hover:border-[#D5DAE5]"
            title="Sign out"
          >
            <Avatar className="size-10 border border-[#D0D5E0] sm:size-12">
              <AvatarImage
                src={session?.user?.avatar?.url}
                alt={session?.user?.name || session?.user?.email || "User"}
              />
              <AvatarFallback>
                {(session?.user?.name || session?.user?.username || "U").slice(
                  0,
                  1,
                )}
              </AvatarFallback>
            </Avatar>
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1180px] px-3 pb-3 md:hidden">
        {isHomePage ? (
          <div className="flex w-full items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-full sm:size-10"
              aria-label="Previous period"
              onClick={goToPreviousMonth}
            >
              <ChevronLeft className="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-full sm:size-10"
              aria-label="Next period"
              onClick={goToNextMonth}
            >
              <ChevronRight className="size-5" />
            </Button>
            <HomeMonthDatePicker
              align="end"
              className="app-top-nav-month text-right font-poppins text-[15px] leading-[120%] font-medium"
            />
          </div>
        ) : null}
        <div className="mt-2 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link key={item.href} href={item.href}>
                <Badge
                  variant={active ? "blue" : "neutral"}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 !text-[14px] font-medium"
                >
                  <BrickIcon name={item.iconName} className="size-3.5" />
                  {item.label}
                </Badge>
              </Link>
            );
          })}
        </div>
      </div>
    </motion.header>
  );
}
