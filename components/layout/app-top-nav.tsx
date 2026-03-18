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
  const clearAllMutation = useMutation({
    mutationFn: notificationApi.clearAll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
  const notifications = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter((item) => !item.read).length;

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
            <PopoverContent align="end" className="w-[340px] p-0">
              <div className="flex items-center justify-between border-b border-[#E3E8F2] px-3 py-2">
                <p className="text-[14px] font-medium text-[#3A4150]">Notifications</p>
                <button
                  type="button"
                  className="text-[12px] text-[#667084] disabled:opacity-50"
                  disabled={!notifications.length || clearAllMutation.isPending}
                  onClick={() => clearAllMutation.mutate()}
                >
                  {clearAllMutation.isPending ? "Clearing..." : "Clear all"}
                </button>
              </div>
              <div className="max-h-[340px] space-y-2 overflow-y-auto p-3">
                {notificationsQuery.isLoading ? (
                  <p className="py-3 text-center text-[13px] text-[#7D8597]">Loading notifications...</p>
                ) : notificationsQuery.isError ? (
                  <p className="py-3 text-center text-[13px] text-[#B14E4E]">Failed to load notifications</p>
                ) : notifications.length ? (
                  notifications.map((notification) => {
                    const createdAt = new Date(notification.createdAt);
                    const timeLabel = Number.isNaN(createdAt.getTime())
                      ? ""
                      : formatDistanceToNow(createdAt, { addSuffix: true });

                    return (
                      <button
                        key={notification._id}
                        type="button"
                        className={cn(
                          "w-full rounded-xl border px-3 py-2 text-left transition",
                          notification.read
                            ? "border-[#E5E9F1] bg-[#F8FAFD]"
                            : "border-[#D2DCEE] bg-white",
                        )}
                        onClick={() => {
                          if (!notification.read) {
                            markAsReadMutation.mutate(notification._id);
                          }
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[13px] leading-[1.3] text-[#3E4655]">{notification.title}</p>
                          {!notification.read ? (
                            <span className="mt-1 size-2 rounded-full bg-[#2DAA46]" />
                          ) : null}
                        </div>
                        {timeLabel ? (
                          <p className="mt-1 text-[11px] text-[#8A92A3]">{timeLabel}</p>
                        ) : null}
                      </button>
                    );
                  })
                ) : (
                  <p className="py-6 text-center text-[13px] text-[#7D8597]">No notifications yet</p>
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
