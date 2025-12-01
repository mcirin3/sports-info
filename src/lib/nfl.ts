const DAY_MS = 24 * 60 * 60 * 1000;

function firstWeekdayOfSeptember(year: number, weekday: number) {
  const firstOfMonth = new Date(Date.UTC(year, 8, 1));
  const offset = (weekday - firstOfMonth.getUTCDay() + 7) % 7;
  const day = 1 + offset;
  return new Date(Date.UTC(year, 8, day));
}

function laborDayUtc(year: number) {
  // Labor Day = first Monday in September
  return firstWeekdayOfSeptember(year, 1);
}

export function nflSeasonStartDate(year: number) {
  const laborDay = laborDayUtc(year);
  const kickoff = new Date(laborDay);
  kickoff.setUTCDate(laborDay.getUTCDate() + 3); // Thursday night opener
  kickoff.setUTCHours(0, 0, 0, 0);
  return kickoff;
}

export function nflSeasonYearForDate(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  // Jan/Feb still belong to the previous season; March-August look ahead to this year.
  return month <= 1 ? year - 1 : year;
}

export function getCurrentNflWeek(now = new Date()) {
  const seasonYear = nflSeasonYearForDate(now);
  const seasonStart = nflSeasonStartDate(seasonYear);
  if (now < seasonStart) return 0;
  const diffDays = Math.floor((now.getTime() - seasonStart.getTime()) / DAY_MS);
  return Math.floor(diffDays / 7) + 1;
}

export function clampNflWeek(
  value: number | null | undefined,
  min = 1,
  max = 25
) {
  const num = typeof value === "number" && Number.isFinite(value) ? value : min;
  if (num < min) return min;
  if (num > max) return max;
  return Math.trunc(num);
}
