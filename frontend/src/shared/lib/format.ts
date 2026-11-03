export function bytesToMegaBytes(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(2);
}

export function secondsToHHMMSS(seconds: number) {
  return new Date(seconds * 1000).toISOString().slice(11, 19);
}

export function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"];

/** 1_300_000_000 -> "1.21 GB", 88_700_000 -> "84.6 MB". */
export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), BYTE_UNITS.length - 1);
  const value = bytes / 1024 ** exponent;
  const digits = value >= 100 || exponent === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${BYTE_UNITS[exponent]}`;
}

/** 6760 -> "1:52:40", 2890 -> "48:10". */
export function formatDuration(seconds: number) {
  const total = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

/** "5 Mar 2026" */
export function formatDate(value: string | Date) {
  return dateFormat.format(new Date(value));
}

/** "5 Mar 2026, 14:02" */
export function formatDateTime(value: string | Date) {
  return dateTimeFormat.format(new Date(value));
}

/** "14:02" */
export function formatTime(value: string | Date) {
  return timeFormat.format(new Date(value));
}
