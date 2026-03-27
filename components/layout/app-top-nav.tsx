"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  Search,
  Settings,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAppState } from "@/components/providers/app-state-provider";
import { BrickIcon } from "@/components/shared/brick-icon";
import { notificationApi } from "@/lib/api";
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
    icon: CalendarDays,
    iconName: "work",
    activeColor: "blue" as const,
  },
  {
    href: "/todos",
    label: "Todos",
    icon: ListTodo,
    iconName: "default",
    activeColor: "blue" as const,
  },
];

export function AppTopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activeNotificationTab, setActiveNotificationTab] = useState<
    "messages" | "system" | "all"
  >("all");
  const { monthCursor, goToToday, goToPreviousMonth, goToNextMonth } =
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
  const notifications = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter((item) => !item.read).length;
  const messageNotifications = notifications.filter((item) =>
    /(message|chat)/i.test(item.type ?? ""),
  );
  const systemNotifications = notifications.filter(
    (item) => !/(message|chat)/i.test(item.type ?? ""),
  );
  const displayedNotifications =
    activeNotificationTab === "messages"
      ? messageNotifications
      : activeNotificationTab === "system"
      ? systemNotifications
      : notifications;
  const unreadByTab = {
    messages: messageNotifications.filter((item) => !item.read).length,
    system: systemNotifications.filter((item) => !item.read).length,
    all: unreadCount,
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#E2E6EE] bg-[#F2F5FA]/90 backdrop-blur">
      <div className="mx-auto flex h-[76px] w-full max-w-[1180px] items-center gap-3 px-3 sm:px-5">
        <div className="flex items-center gap-3">
          <Link href="/home" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Zenolok Logo"
              width={500}
              height={500}
              className="w-[50px] h-[50px] object-contain"
              priority
            />
          </Link>
          {isHomePage ? (
            <>
              <Button
                className="fs-pop-20-medium-center rounded-full border border-[#7A8F64] bg-[#A7C58D] px-7 text-[#2A2E36] hover:bg-[#97ba79]"
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
                className="rounded-full"
                aria-label="Previous period"
                onClick={goToPreviousMonth}
              >
                <ChevronLeft className="size-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label="Next period"
                onClick={goToNextMonth}
              >
                <ChevronRight className="size-5" />
              </Button>
              <div className="fs-pop-20-medium-center hidden md:block">
                {format(monthCursor, "MMMM yyyy")}
              </div>
            </>
          ) : null}
        </div>

        <nav className="mx-auto hidden items-center gap-2 md:flex">
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "fs-pop-20-medium-center inline-flex items-center gap-2 rounded-full px-4 py-2 transition",
                  active
                    ? "bg-[#DDE9FF] text-[#2C5CA8]"
                    : "text-[#5E6577] hover:bg-[#E9EEF7]",
                )}
              >
                <item.icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full bg-[#D5DAE5] cursor-pointer"
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
                className="relative rounded-full bg-[#D5DAE5] cursor-pointer"
                aria-label="Open notifications"
              >
                <Bell className="size-5" />
                {unreadCount ? (
                  <span className="absolute top-1 right-1 inline-flex min-w-4 items-center justify-center rounded-full bg-[#FF3B30] px-1 text-[10px] leading-none text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[310px] border-none bg-[#F0F0F0] p-3 shadow-[0_10px_24px_rgba(20,24,35,0.12)]"
            >
              <div className="mb-2 flex items-center justify-center gap-6">
                {[
                  { key: "messages" as const, label: "Messages" },
                  { key: "system" as const, label: "System" },
                  { key: "all" as const, label: "All" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveNotificationTab(tab.key)}
                    className={cn(
                      "relative text-[13px] leading-none transition",
                      activeNotificationTab === tab.key
                        ? "text-[#2A2E36]"
                        : "text-[#9B9EA6]",
                    )}
                  >
                    {tab.label}
                    {unreadByTab[tab.key] ? (
                      <span className="absolute -top-2 -right-3 inline-flex min-w-[14px] items-center justify-center rounded-full bg-[#FF3B30] px-1 text-[9px] font-medium leading-none text-white">
                        {unreadByTab[tab.key] > 99 ? "99+" : unreadByTab[tab.key]}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>

              <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
                {notificationsQuery.isLoading ? (
                  <>
                    {[40, 40, 66].map((height, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <span className="mt-2 size-4 rounded-full border border-[#D3D3D3] bg-[#E2E2E2]" />
                        <Skeleton
                          className="flex-1 rounded-xl bg-[#DEDEDE]"
                          style={{ height }}
                        />
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

                    return (
                      <button
                        key={notification._id}
                        type="button"
                        className="group flex w-full items-start gap-2 rounded-xl p-1 text-left"
                        onClick={() => {
                          if (!notification.read) {
                            markAsReadMutation.mutate(notification._id);
                          }
                        }}
                      >
                        <span
                          className={cn(
                            "mt-2 size-4 rounded-full border",
                            notification.read
                              ? "border-[#D6D6D6] bg-[#ECECEC]"
                              : "border-[#C5C5C5] bg-white",
                          )}
                        />
                        <div
                          className={cn(
                            "flex-1 rounded-xl border px-3 py-2 transition",
                            notification.read
                              ? "border-[#E2E2E2] bg-[#ECECEC]"
                              : "border-[#D8D8D8] bg-[#E8E8E8]",
                          )}
                        >
                          <p className="text-[12px] leading-[1.35] text-[#4A4F59]">
                            {notification.title}
                          </p>
                          {timeLabel ? (
                            <p className="mt-1 text-[10px] text-[#8A8F9C]">{timeLabel}</p>
                          ) : null}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <p className="py-6 text-center text-[13px] text-[#7D8597]">
                    No notifications yet
                  </p>
                )}
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hidden sm:inline-flex bg-[#D5DAE5] cursor-pointer"
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
            <Avatar className="size-12 border border-[#D0D5E0]">
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

      <div className="mx-auto flex w-full max-w-[1180px] items-center gap-2 px-3 pb-3 md:hidden">
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
    </header>
  );
}
