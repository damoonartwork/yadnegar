/** فهرست کشورها و شهرها با منطقهٔ زمانی (IANA). کشورهای چندمنطقه‌ای چند ردیف دارند. */
export interface WorldZone {
  zone: string;
  country: string;
  city?: string;
}

export const WORLD_ZONES: WorldZone[] = [
  { zone: "America/New_York", country: "آمریکا", city: "نیویورک / واشنگتن" },
  { zone: "America/Chicago", country: "آمریکا", city: "شیکاگو / تگزاس" },
  { zone: "America/Denver", country: "آمریکا", city: "دنور" },
  { zone: "America/Phoenix", country: "آمریکا", city: "آریزونا" },
  { zone: "America/Los_Angeles", country: "آمریکا", city: "لس‌آنجلس / کالیفرنیا" },
  { zone: "America/Anchorage", country: "آمریکا", city: "آلاسکا" },
  { zone: "Pacific/Honolulu", country: "آمریکا", city: "هاوایی" },
  { zone: "America/Toronto", country: "کانادا", city: "تورنتو / اتاوا" },
  { zone: "America/Vancouver", country: "کانادا", city: "ونکوور" },
  { zone: "America/Edmonton", country: "کانادا", city: "کلگری / ادمونتون" },
  { zone: "America/Halifax", country: "کانادا", city: "هالیفاکس" },
  { zone: "America/Mexico_City", country: "مکزیک", city: "مکزیکوسیتی" },
  { zone: "America/Sao_Paulo", country: "برزیل", city: "سائوپائولو" },
  { zone: "America/Argentina/Buenos_Aires", country: "آرژانتین", city: "بوئنوس‌آیرس" },
  { zone: "Europe/London", country: "انگلستان", city: "لندن" },
  { zone: "Europe/Dublin", country: "ایرلند", city: "دوبلین" },
  { zone: "Europe/Paris", country: "فرانسه", city: "پاریس" },
  { zone: "Europe/Berlin", country: "آلمان", city: "برلین" },
  { zone: "Europe/Amsterdam", country: "هلند", city: "آمستردام" },
  { zone: "Europe/Brussels", country: "بلژیک", city: "بروکسل" },
  { zone: "Europe/Zurich", country: "سوئیس", city: "زوریخ" },
  { zone: "Europe/Vienna", country: "اتریش", city: "وین" },
  { zone: "Europe/Rome", country: "ایتالیا", city: "رم" },
  { zone: "Europe/Madrid", country: "اسپانیا", city: "مادرید" },
  { zone: "Europe/Lisbon", country: "پرتغال", city: "لیسبون" },
  { zone: "Europe/Stockholm", country: "سوئد", city: "استکهلم" },
  { zone: "Europe/Oslo", country: "نروژ", city: "اسلو" },
  { zone: "Europe/Copenhagen", country: "دانمارک", city: "کپنهاگ" },
  { zone: "Europe/Helsinki", country: "فنلاند", city: "هلسینکی" },
  { zone: "Europe/Warsaw", country: "لهستان", city: "ورشو" },
  { zone: "Europe/Athens", country: "یونان", city: "آتن" },
  { zone: "Europe/Istanbul", country: "ترکیه", city: "استانبول" },
  { zone: "Europe/Kyiv", country: "اوکراین", city: "کی‌یف" },
  { zone: "Europe/Moscow", country: "روسیه", city: "مسکو" },
  { zone: "Asia/Tehran", country: "ایران", city: "تهران" },
  { zone: "Asia/Dubai", country: "امارات", city: "دبی" },
  { zone: "Asia/Qatar", country: "قطر", city: "دوحه" },
  { zone: "Asia/Riyadh", country: "عربستان", city: "ریاض" },
  { zone: "Asia/Kuwait", country: "کویت" },
  { zone: "Asia/Baghdad", country: "عراق", city: "بغداد" },
  { zone: "Asia/Muscat", country: "عمان", city: "مسقط" },
  { zone: "Asia/Baku", country: "آذربایجان", city: "باکو" },
  { zone: "Asia/Yerevan", country: "ارمنستان", city: "ایروان" },
  { zone: "Asia/Tbilisi", country: "گرجستان", city: "تفلیس" },
  { zone: "Asia/Kabul", country: "افغانستان", city: "کابل" },
  { zone: "Asia/Karachi", country: "پاکستان", city: "کراچی" },
  { zone: "Asia/Kolkata", country: "هند", city: "دهلی / بمبئی" },
  { zone: "Asia/Dushanbe", country: "تاجیکستان", city: "دوشنبه" },
  { zone: "Asia/Tashkent", country: "ازبکستان", city: "تاشکند" },
  { zone: "Asia/Bangkok", country: "تایلند", city: "بانکوک" },
  { zone: "Asia/Kuala_Lumpur", country: "مالزی", city: "کوالالامپور" },
  { zone: "Asia/Singapore", country: "سنگاپور" },
  { zone: "Asia/Shanghai", country: "چین", city: "پکن / شانگهای" },
  { zone: "Asia/Hong_Kong", country: "هنگ‌کنگ" },
  { zone: "Asia/Seoul", country: "کره جنوبی", city: "سئول" },
  { zone: "Asia/Tokyo", country: "ژاپن", city: "توکیو" },
  { zone: "Australia/Sydney", country: "استرالیا", city: "سیدنی / ملبورن" },
  { zone: "Australia/Perth", country: "استرالیا", city: "پرت" },
  { zone: "Pacific/Auckland", country: "نیوزیلند", city: "اوکلند" },
  { zone: "Africa/Cairo", country: "مصر", city: "قاهره" },
  { zone: "Africa/Johannesburg", country: "آفریقای جنوبی", city: "ژوهانسبورگ" },
  { zone: "UTC", country: "ساعت جهانی", city: "UTC" },
];

export const findZone = (zone: string) => WORLD_ZONES.find((z) => z.zone === zone) ?? WORLD_ZONES[0];

/** اختلاف ساعت یک منطقه با ساعت این کامپیوتر به دقیقه */
export function offsetFromLocal(zone: string, at = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(at);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUTC = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"));
  const zoneOffset = Math.round((asUTC - Math.floor(at.getTime() / 60000) * 60000) / 60000);
  return zoneOffset + at.getTimezoneOffset();
}
