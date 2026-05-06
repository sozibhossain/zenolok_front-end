"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { googleCalendarApi } from "@/lib/api";

function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const handled = React.useRef(false);
  const [message, setMessage] = React.useState("Connecting to Google Calendar…");
  const [isError, setIsError] = React.useState(false);

  React.useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const oauthError = searchParams.get("error");

    if (oauthError) {
      setIsError(true);
      setMessage(`Google rejected the request: ${oauthError}`);
      const t = window.setTimeout(() => {
        router.replace(
          `/settings?section=calendar&googleCalendar=error&reason=${encodeURIComponent(
            oauthError,
          )}`,
        );
      }, 1500);
      return () => window.clearTimeout(t);
    }

    if (!code || !state) {
      setIsError(true);
      setMessage("Missing authorization code from Google.");
      const t = window.setTimeout(() => {
        router.replace(
          "/settings?section=calendar&googleCalendar=error&reason=missing_code",
        );
      }, 1500);
      return () => window.clearTimeout(t);
    }

    googleCalendarApi
      .exchange({ code, state })
      .then(() => {
        router.replace("/settings?section=calendar&googleCalendar=connected");
      })
      .catch((err: unknown) => {
        const reason =
          (err as { response?: { data?: { message?: string } }; message?: string })
            ?.response?.data?.message ||
          (err as { message?: string })?.message ||
          "exchange_failed";
        setIsError(true);
        setMessage(`Connection failed: ${reason}`);
        window.setTimeout(() => {
          router.replace(
            `/settings?section=calendar&googleCalendar=error&reason=${encodeURIComponent(
              reason,
            )}`,
          );
        }, 1500);
      });
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div
        className={`max-w-md rounded-2xl border p-6 text-center shadow-sm ${
          isError ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"
        }`}
      >
        <h1 className="mb-2 text-lg font-semibold">Google Calendar</h1>
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
}

// useSearchParams() requires a Suspense boundary so Next.js can render a
// fallback during static generation / streaming. Without this, `next build`
// fails the route with "missing-suspense-with-csr-bailout".
export default function GoogleCalendarOAuthCallbackPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
            <h1 className="mb-2 text-lg font-semibold">Google Calendar</h1>
            <p className="text-sm text-gray-600">Loading…</p>
          </div>
        </div>
      }
    >
      <CallbackInner />
    </React.Suspense>
  );
}
