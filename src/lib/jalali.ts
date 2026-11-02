import { format as gFormat } from "date-fns";
import { getMonth, getYear, getDate } from "date-fns-jalali";

export const PERSIAN_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];

// getDay(): 0=یکشنبه ... 6=شنبه
const WEEKDAY_SHORT = ["ی", "د", "س", "چ", "پ", "ج", "ش"];
const WEEKDAY_FULL = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];

export const WEEK_HEADER = ["ش", "ی", "د", "س", "چ", "پ", "ج"]; // شروع هفته از شنبه

export function toFa(input: string | number): string {
  return String(input).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

export const weekdayShort = (d: Date) => WEEKDAY_SHORT[d.getDay()];
export const weekdayFull = (d: Date) => WEEKDAY_FULL[d.getDay()];
export const monthName = (d: Date) => PERSIAN_MONTHS[getMonth(d)];
export const jYear = (d: Date) => getYear(d);
export const jDay = (d: Date) => getDate(d);

/** ستون روز در جدول ماه وقتی هفته از شنبه شروع شود (۰ تا ۶) */
export const columnOf = (d: Date) => (d.getDay() + 1) % 7;

/** کلید ذخیره‌سازی روز — میلادی و مستقل از تقویم نمایش */
export const dayKey = (d: Date) => gFormat(d, "yyyy-MM-dd");

export function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function longFa(d: Date) {
  return `${weekdayFull(d)} ${toFa(jDay(d))} ${monthName(d)} ${toFa(jYear(d))}`;
}
