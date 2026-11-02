export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

/** @type {Map<string, Intl.DateTimeFormat>} */
const FORMATTER_CACHE = new Map();

/** @type {Map<string, number>} */
const DAY_BOUNDARY_CACHE = new Map();

function getZonedFormatter(timeZone) {
  let formatter = FORMATTER_CACHE.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    });
    FORMATTER_CACHE.set(timeZone, formatter);
  }
  return formatter;
}

export function parseIsoDateParts(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day };
}

export function diffCalendarDays(startDateStr, endDateStr) {
  const start = parseIsoDateParts(startDateStr);
  const end = parseIsoDateParts(endDateStr);
  const startUtcMs = Date.UTC(start.year, start.month - 1, start.day);
  const endUtcMs = Date.UTC(end.year, end.month - 1, end.day);
  return Math.round((endUtcMs - startUtcMs) / MS_PER_DAY);
}

export function getDaysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function getZonedDateParts(epochMs, timeZone) {
  const parts = getZonedFormatter(timeZone).formatToParts(new Date(epochMs));
  const raw = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      raw[part.type] = part.value;
    }
  }

  const year = Number(raw.year);
  const month = Number(raw.month);
  const day = Number(raw.day);
  const hour = Number(raw.hour) % 24;
  const minute = Number(raw.minute);
  const second = Number(raw.second);

  const yearStr = String(year).padStart(4, '0');
  const monthStr = String(month).padStart(2, '0');
  const dayStr = String(day).padStart(2, '0');
  const hourStr = String(hour).padStart(2, '0');
  const minuteStr = String(minute).padStart(2, '0');

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    dateStr: `${yearStr}-${monthStr}-${dayStr}`,
    timeStr: `${hourStr}:${minuteStr}`
  };
}

export function getUtcOffsetMinutes(epochMs, timeZone) {
  const { year, month, day, hour, minute, second } = getZonedDateParts(epochMs, timeZone);
  const zonedAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const truncatedEpochMs = Math.floor(epochMs / 1000) * 1000;
  return Math.round((zonedAsUtcMs - truncatedEpochMs) / MS_PER_MINUTE);
}

export function getZonedWallClockEpochMs(dateStr, timeZone, hour, minute, second, ms) {
  const { year, month, day } = parseIsoDateParts(dateStr);
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  const firstOffsetMin = getUtcOffsetMinutes(naiveUtcMs, timeZone);
  const firstGuessMs = naiveUtcMs - firstOffsetMin * MS_PER_MINUTE;
  const secondOffsetMin = getUtcOffsetMinutes(firstGuessMs, timeZone);
  return naiveUtcMs - secondOffsetMin * MS_PER_MINUTE;
}

export function getStartOfDayInTimeZoneMs(dateStr, timeZone) {
  const cacheKey = `S|${dateStr}|${timeZone}`;
  const cached = DAY_BOUNDARY_CACHE.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  const computed = getZonedWallClockEpochMs(dateStr, timeZone, 0, 0, 0, 0);
  DAY_BOUNDARY_CACHE.set(cacheKey, computed);
  return computed;
}

export function getEndOfDayInTimeZoneMs(dateStr, timeZone) {
  const cacheKey = `E|${dateStr}|${timeZone}`;
  const cached = DAY_BOUNDARY_CACHE.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  const computed = getZonedWallClockEpochMs(dateStr, timeZone, 23, 59, 59, 999);
  DAY_BOUNDARY_CACHE.set(cacheKey, computed);
  return computed;
}

export function formatDisplayDate(dateStr, options = false) {
  const shortYear = typeof options === 'boolean' ? options : Boolean(options?.shortYear);
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const formattedYear = shortYear ? yearStr.slice(-2) : yearStr;
  return `${dayStr}-${monthStr}-${formattedYear}`;
}

export function formatShortDisplayDate(dateStr) {
  return formatDisplayDate(dateStr, true);
}
