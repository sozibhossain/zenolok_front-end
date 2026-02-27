"use client";

import * as React from "react";
import { addMonths, startOfDay, startOfMonth } from "date-fns";

import {
  applyThemePreference,
  defaultPreferences,
  preferencesStorageKey,
  readPreferences,
  writePreferences,
  type AppPreferences,
} from "@/lib/settings";

interface AppStateContextValue {
  monthCursor: Date;
  selectedDate: Date;
  preferences: AppPreferences;
  goToToday: () => void;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  setSelectedDate: (date: Date) => void;
  updatePreferences: (patch: Partial<AppPreferences>) => void;
}

const AppStateContext = React.createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [monthCursor, setMonthCursor] = React.useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDateState] = React.useState(() => startOfDay(new Date()));
  const [preferences, setPreferences] = React.useState<AppPreferences>(defaultPreferences);

  React.useEffect(() => {
    const saved = readPreferences();
    setPreferences(saved);
    applyThemePreference(saved.darkMode);
  }, []);

  React.useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== preferencesStorageKey) {
        return;
      }

      const saved = readPreferences();
      setPreferences(saved);
      applyThemePreference(saved.darkMode);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const goToToday = React.useCallback(() => {
    const today = startOfDay(new Date());
    setSelectedDateState(today);
    setMonthCursor(startOfMonth(today));
  }, []);

  const moveMonth = React.useCallback((offset: number) => {
    setMonthCursor((current) => {
      const nextMonth = startOfMonth(addMonths(current, offset));
      setSelectedDateState(startOfDay(nextMonth));
      return nextMonth;
    });
  }, []);

  const goToPreviousMonth = React.useCallback(() => moveMonth(-1), [moveMonth]);
  const goToNextMonth = React.useCallback(() => moveMonth(1), [moveMonth]);

  const setSelectedDate = React.useCallback((date: Date) => {
    const normalized = startOfDay(date);
    setSelectedDateState(normalized);
    setMonthCursor(startOfMonth(normalized));
  }, []);

  const updatePreferences = React.useCallback((patch: Partial<AppPreferences>) => {
    setPreferences((previous) => {
      const next = { ...previous, ...patch };
      writePreferences(next);

      if (previous.darkMode !== next.darkMode) {
        applyThemePreference(next.darkMode);
      }

      return next;
    });
  }, []);

  const value = React.useMemo<AppStateContextValue>(
    () => ({
      monthCursor,
      selectedDate,
      preferences,
      goToToday,
      goToPreviousMonth,
      goToNextMonth,
      setSelectedDate,
      updatePreferences,
    }),
    [goToNextMonth, goToPreviousMonth, goToToday, monthCursor, preferences, selectedDate, setSelectedDate, updatePreferences]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = React.useContext(AppStateContext);

  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }

  return context;
}
