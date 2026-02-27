import { redirect } from "next/navigation";

export default function WeekStartDayPage() {
  redirect("/settings?section=weekStartDay&modal=week-start-day");
}
