import { format, isSameDay } from "date-fns";

const TWELVE_HOUR_FORMAT = "hh:mm a";
const TWENTY_FOUR_HOUR_FORMAT = "HH:mm";

export function getTimeFormatTitle(use24Hour: boolean) {
  return use24Hour ? "24-hour format" : "12-hour format";
}

export function getTimeChangedMessage(use24Hour: boolean) {
  return `Changed to ${getTimeFormatTitle(use24Hour)}`;
}

export function getTimeFormatPattern(use24Hour: boolean) {
  return use24Hour ? TWENTY_FOUR_HOUR_FORMAT : TWELVE_HOUR_FORMAT;
}

export function formatTimeByPreference(value: Date, use24Hour: boolean) {
  return format(value, getTimeFormatPattern(use24Hour));
}

export function formatDateTimeByPreference(value: Date, use24Hour: boolean) {
  return format(value, `MM/dd/yyyy ${getTimeFormatPattern(use24Hour)}`);
}

export function formatTimeStringByPreference(value: string, use24Hour: boolean) {
  if (!value) {
    return "";
  }

  const parsed = new Date(`1970-01-01T${value}:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return formatTimeByPreference(parsed, use24Hour);
}

export function formatIsoTimeByPreference(value: string, use24Hour: boolean) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return formatTimeByPreference(parsed, use24Hour);
}

export function formatTimeRangeByPreference(
  start: Date,
  end: Date,
  use24Hour: boolean,
) {
  if (isSameDay(start, end)) {
    return formatTimeByPreference(start, use24Hour);
  }

  return `${formatTimeByPreference(start, use24Hour)} - ${formatTimeByPreference(end, use24Hour)}`;
}
