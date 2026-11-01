import { COUNTRY_CATALOG, getCountryInfo } from './config.js';

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** @type {Map<string, Intl.DateTimeFormat>} */
const FORMATTER_CACHE = new Map();

/** @type {Map<string, number>} */
const DAY_BOUNDARY_CACHE = new Map();

/**
 * Returns a cached Intl.DateTimeFormat instance for the given IANA timezone.
 * @param {string} timeZone
 * @returns {Intl.DateTimeFormat}
 */
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

/**
 * Parses a "YYYY-MM-DD" string into numeric year, month (1-12), and day (1-31).
 * @param {string} dateStr
 * @returns {{ year: number, month: number, day: number }}
 */
export function parseIsoDateParts(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day };
}

/**
 * Computes whole calendar days between two "YYYY-MM-DD" strings (endDateStr - startDateStr).
 * @param {string} startDateStr
 * @param {string} endDateStr
 * @returns {number}
 */
export function diffCalendarDays(startDateStr, endDateStr) {
  const start = parseIsoDateParts(startDateStr);
  const end = parseIsoDateParts(endDateStr);
  const startUtcMs = Date.UTC(start.year, start.month - 1, start.day);
  const endUtcMs = Date.UTC(end.year, end.month - 1, end.day);
  return Math.round((endUtcMs - startUtcMs) / MS_PER_DAY);
}

/**
 * Returns the number of days in a specific year and 1-indexed month.
 * @param {number} year
 * @param {number} month
 * @returns {number}
 */
function getDaysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Extracts timezone-accurate wall-clock components at epochMs in timeZone.
 * @param {number} epochMs
 * @param {string} timeZone
 * @returns {{
 *   year: number,
 *   month: number,
 *   day: number,
 *   hour: number,
 *   minute: number,
 *   second: number,
 *   dateStr: string,
 *   timeStr: string
 * }}
 */
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

/**
 * Computes the exact UTC offset in minutes at epochMs for the given IANA timeZone.
 * @param {number} epochMs
 * @param {string} timeZone
 * @returns {number}
 */
export function getUtcOffsetMinutes(epochMs, timeZone) {
  const { year, month, day, hour, minute, second } = getZonedDateParts(epochMs, timeZone);
  const zonedAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const truncatedEpochMs = Math.floor(epochMs / 1000) * 1000;
  return Math.round((zonedAsUtcMs - truncatedEpochMs) / MS_PER_MINUTE);
}

/**
 * Converts a local wall-clock time on dateStr ("YYYY-MM-DD") in timeZone to exact epoch milliseconds.
 * Uses a two-pass offset calculation to handle DST transitions cleanly.
 * @param {string} dateStr
 * @param {string} timeZone
 * @param {number} hour
 * @param {number} minute
 * @param {number} second
 * @param {number} ms
 * @returns {number}
 */
function getZonedWallClockEpochMs(dateStr, timeZone, hour, minute, second, ms) {
  const { year, month, day } = parseIsoDateParts(dateStr);
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  const firstOffsetMin = getUtcOffsetMinutes(naiveUtcMs, timeZone);
  const firstGuessMs = naiveUtcMs - firstOffsetMin * MS_PER_MINUTE;
  const secondOffsetMin = getUtcOffsetMinutes(firstGuessMs, timeZone);
  return naiveUtcMs - secondOffsetMin * MS_PER_MINUTE;
}

/**
 * Converts "YYYY-MM-DD" to the exact epoch milliseconds of 00:00:00.000 in timeZone (memoized).
 * @param {string} dateStr
 * @param {string} timeZone
 * @returns {number}
 */
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

/**
 * Converts "YYYY-MM-DD" to the exact epoch milliseconds of 23:59:59.999 in timeZone (memoized).
 * @param {string} dateStr
 * @param {string} timeZone
 * @returns {number}
 */
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

/**
 * Formats "YYYY-MM-DD" as "DD-MM-YYYY" (or "DD-MM-YY" when shortYear is true).
 * @param {string} dateStr
 * @param {boolean|{ shortYear?: boolean }} [options=false]
 * @returns {string}
 */
export function formatDisplayDate(dateStr, options = false) {
  const shortYear = typeof options === 'boolean' ? options : Boolean(options?.shortYear);
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const formattedYear = shortYear ? yearStr.slice(-2) : yearStr;
  return `${dayStr}-${monthStr}-${formattedYear}`;
}

/**
 * Formats "YYYY-MM-DD" as "DD-MM-YY".
 * @param {string} dateStr
 * @returns {string}
 */
export function formatShortDisplayDate(dateStr) {
  return formatDisplayDate(dateStr, true);
}

/**
 * Resolves CountryInfo from COUNTRY_CATALOG or dynamic fallback.
 * @param {string} countryCode
 * @returns {import('./config.js').CountryInfo}
 */
function resolveCountry(countryCode) {
  const code = (countryCode || 'UTC').toUpperCase();
  return COUNTRY_CATALOG[code] ?? getCountryInfo(code);
}

/**
 * Resolves the month offset relative to originYear and originMonth.
 * @param {string|number|undefined} bound
 * @param {number} originYear
 * @param {number} originMonth
 * @param {number} defaultOffset
 * @returns {number}
 */
function resolveMonthOffset(bound, originYear, originMonth, defaultOffset) {
  if (bound === undefined || bound === null) {
    return defaultOffset;
  }
  if (typeof bound === 'number') {
    return bound;
  }
  const [year, month] = String(bound).split('-').map(Number);
  if (Number.isFinite(year) && Number.isFinite(month)) {
    return (year - originYear) * 12 + (month - originMonth);
  }
  return defaultOffset;
}

/**
 * Determines which country code applies on a given calendar date for an anniversary milestone.
 * @param {string} dateStr
 * @param {import('./config.js').ReunionChapter[]} reunions
 * @param {string} homeCountryCode
 * @returns {string}
 */
function resolveAnniversaryCountryCode(dateStr, reunions, homeCountryCode) {
  for (const reunion of reunions) {
    for (let i = 0; i < reunion.legs.length; i += 1) {
      const leg = reunion.legs[i];
      const isLastLeg = i === reunion.legs.length - 1;
      const inLeg = isLastLeg
        ? dateStr >= leg.startDate && dateStr <= leg.endDate
        : dateStr >= leg.startDate && dateStr < leg.endDate;
      if (inLeg) {
        return leg.countryCode;
      }
    }
  }
  return homeCountryCode;
}

/**
 * Generates automatic monthly anniversary MilestoneEvent items on the Nth day of each month
 * based on originDateStr. Skips dates that already have an explicit anniversary milestone.
 *
 * @param {string} originDateStr
 * @param {string|number} [startYearMonth=10]
 * @param {string|number} [endYearMonth=24]
 * @param {import('./config.js').MilestoneEvent[]} [existingMilestones=[]]
 * @param {import('./config.js').ReunionChapter[]} [reunions=[]]
 * @param {string} [homeCountryCode='UTC']
 * @returns {import('./config.js').MilestoneEvent[]}
 */
export function generateMonthlyAnniversaries(
  originDateStr,
  startYearMonth = 10,
  endYearMonth = 24,
  existingMilestones = [],
  reunions = [],
  homeCountryCode = 'UTC'
) {
  if (!originDateStr) {
    return [];
  }
  const { year: originYear, month: originMonth, day: originDay } = parseIsoDateParts(originDateStr);
  const startOffset = Math.max(1, resolveMonthOffset(startYearMonth, originYear, originMonth, 10));
  const endOffset = Math.max(startOffset, resolveMonthOffset(endYearMonth, originYear, originMonth, 24));

  const existingAnniversaryDates = new Set(
    (existingMilestones || [])
      .filter((ms) => ms.category === 'anniversary')
      .map((ms) => ms.date)
  );

  /** @type {import('./config.js').MilestoneEvent[]} */
  const generated = [];

  for (let monthCount = startOffset; monthCount <= endOffset; monthCount += 1) {
    const totalMonthsZeroBased = originMonth - 1 + monthCount;
    const targetYear = originYear + Math.floor(totalMonthsZeroBased / 12);
    const targetMonth = (totalMonthsZeroBased % 12) + 1;
    const clampedDay = Math.min(originDay, getDaysInMonth(targetYear, targetMonth));
    const dateStr = `${String(targetYear).padStart(4, '0')}-${String(targetMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;

    if (existingAnniversaryDates.has(dateStr)) {
      continue;
    }

    const isExactYear = monthCount % 12 === 0;
    const yearsCount = monthCount / 12;
    const title = isExactYear
      ? `${yearsCount}-Year Anniversary (${monthCount} Months!)`
      : `${monthCount} Months Together`;

    generated.push({
      id: `ms-anniversary-${monthCount}m`,
      date: dateStr,
      category: 'anniversary',
      emoji: '🥂',
      title,
      details: '',
      person: 'both',
      countryCode: resolveAnniversaryCountryCode(dateStr, reunions || [], homeCountryCode),
      autoGenerated: true
    });
  }

  return generated;
}

/**
 * Computes the relationship duration count-up from originDateStr to currentDateStr.
 * @param {string} originDateStr
 * @param {string} currentDateStr
 * @returns {{
 *   totalDays: number,
 *   months: number,
 *   daysRemainder: number,
 *   formattedPill: string
 * }}
 */
export function computeRelationshipDuration(originDateStr, currentDateStr) {
  const totalDays = Math.max(0, diffCalendarDays(originDateStr, currentDateStr));
  const origin = parseIsoDateParts(originDateStr);
  const current = parseIsoDateParts(currentDateStr);

  let months = (current.year - origin.year) * 12 + (current.month - origin.month);
  let daysRemainder = current.day - origin.day;

  if (daysRemainder < 0) {
    months -= 1;
    const prevMonth = current.month === 1 ? 12 : current.month - 1;
    const prevMonthYear = current.month === 1 ? current.year - 1 : current.year;
    const daysInPrevMonth = getDaysInMonth(prevMonthYear, prevMonth);
    daysRemainder = daysInPrevMonth - origin.day + current.day;
  }

  if (months < 0) {
    months = 0;
    daysRemainder = 0;
  }

  const daysLabel = totalDays === 1 ? 'Day' : 'Days';
  const monthsLabel = months === 1 ? 'Month' : 'Months';
  const remLabel = daysRemainder === 1 ? 'Day' : 'Days';

  return {
    totalDays,
    months,
    daysRemainder,
    formattedPill: `${totalDays} ${daysLabel} Together • ${months} ${monthsLabel}, ${daysRemainder} ${remLabel}`
  };
}

/**
 * Decomposes a millisecond duration into days, hours, minutes, seconds, and totalRemainingMs.
 * @param {number} remainingMs
 * @returns {{
 *   days: number,
 *   hours: number,
 *   minutes: number,
 *   seconds: number,
 *   totalRemainingMs: number
 * }}
 */
export function decomposeRemainingMs(remainingMs) {
  const clampedMs = Math.max(0, remainingMs);
  const totalSeconds = Math.floor(clampedMs / MS_PER_SECOND);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days,
    hours,
    minutes,
    seconds,
    totalRemainingMs: clampedMs
  };
}

/**
 * Computes the planned duration in days for a reunion leg.
 * @param {import('./config.js').ReunionLeg} leg
 * @param {import('./config.js').ReunionChapter} reunion
 * @returns {number}
 */
export function getLegDurationDays(leg, reunion) {
  const rawDiff = diffCalendarDays(leg.startDate, leg.endDate);
  if (reunion.legs.length === 1) {
    return Math.max(1, rawDiff + 1);
  }
  return Math.max(1, rawDiff);
}

/**
 * Computes total planned days for a ReunionChapter.
 * @param {import('./config.js').ReunionChapter} reunion
 * @returns {number}
 */
export function getReunionDurationDays(reunion) {
  return reunion.legs.reduce((sum, leg) => sum + getLegDurationDays(leg, reunion), 0);
}

/**
 * Computes the exact epoch millisecond start and end boundaries for a ReunionChapter and each of its legs.
 * @param {import('./config.js').ReunionChapter} reunion
 */
function resolveReunionWindows(reunion) {
  const legWindows = reunion.legs.map((leg, index) => {
    const legCountry = resolveCountry(leg.countryCode);
    const startMs = getStartOfDayInTimeZoneMs(leg.startDate, legCountry.timeZone);
    let endMs;
    if (index < reunion.legs.length - 1) {
      const nextLeg = reunion.legs[index + 1];
      const nextCountry = resolveCountry(nextLeg.countryCode);
      endMs = getStartOfDayInTimeZoneMs(nextLeg.startDate, nextCountry.timeZone) - 1;
    } else {
      endMs = getEndOfDayInTimeZoneMs(leg.endDate, legCountry.timeZone);
    }
    return {
      leg,
      index,
      country: legCountry,
      startMs,
      endMs,
      totalLegDays: getLegDurationDays(leg, reunion)
    };
  });

  const startMs = legWindows[0].startMs;
  const endMs = legWindows[legWindows.length - 1].endMs;
  const totalReunionDays = getReunionDurationDays(reunion);

  return {
    reunion,
    startMs,
    endMs,
    totalReunionDays,
    legWindows
  };
}

/**
 * Resolves the two partner keys and departure dates dynamically from `config`.
 * @param {import('./config.js').TripConfig} config
 * @returns {{
 *   firstPartnerKey: string,
 *   secondPartnerKey: string,
 *   primaryDepartureDate: string,
 *   secondaryDepartureDate: string
 * }}
 */
export function resolvePartnerConfigMeta(config) {
  const keys = Object.keys(config.coupleNames || {});
  const firstPartnerKey = keys[0] || 'partnerA';
  const secondPartnerKey = keys[1] || 'partnerB';

  const primaryDepartureDate =
    /** @type {any} */ (config)[`${firstPartnerKey}DepartureDate`] ||
    config.primaryDepartureDate ||
    config.relationshipOriginDate;

  const secondaryDepartureDate =
    /** @type {any} */ (config)[`${secondPartnerKey}DepartureDate`] ||
    config.secondaryDepartureDate ||
    primaryDepartureDate;

  return {
    firstPartnerKey,
    secondPartnerKey,
    primaryDepartureDate,
    secondaryDepartureDate
  };
}

/**
 * Evaluates the complete board state deterministically at `nowMs`.
 * Never invokes Date.now() internally.
 *
 * @param {import('./config.js').TripConfig} config
 * @param {import('./config.js').LiveStatePayload | null} [liveState=null]
 * @param {number} nowMs
 * @returns {import('./config.js').EvaluatedBoardState}
 */
export function evaluateBoardState(config, liveState = null, nowMs) {
  if (!config || typeof config !== 'object') {
    throw new TypeError('evaluateBoardState requires a valid decrypted TripConfig object');
  }
  if (typeof nowMs !== 'number' || Number.isNaN(nowMs)) {
    throw new TypeError('evaluateBoardState requires an explicit numeric nowMs timestamp');
  }

  const {
    firstPartnerKey,
    secondPartnerKey,
    primaryDepartureDate,
    secondaryDepartureDate
  } = resolvePartnerConfigMeta(config);

  const homeCountry = resolveCountry(config.homeCountryCode);
  const homeTz = homeCountry.timeZone;

  const baseReunions = config.reunions || [];
  const customReunions = liveState?.customReunions || [];
  const chapterOverrides = liveState?.chapterOverrides || {};
  const reunions = [...baseReunions, ...customReunions]
    .filter((rc) => !chapterOverrides[rc.id]?.hidden)
    .map((rc) => {
      const override = chapterOverrides[rc.id];
      if (!override) return rc;
      const updated = { ...rc, ...override };
      if (Array.isArray(override.legs) && override.legs.length > 0) {
        updated.legs = override.legs.map((leg) => ({ ...leg }));
        updated.startDate = updated.legs[0].startDate;
        updated.endDate = updated.legs[updated.legs.length - 1].endDate;
      } else if (override.countryCode && Array.isArray(updated.legs) && updated.legs.length > 0) {
        updated.legs = updated.legs.map((leg, index) =>
          index === 0 ? { ...leg, countryCode: override.countryCode } : leg
        );
      }
      return updated;
    })
    .filter((rc) => Array.isArray(rc.legs) && rc.legs.length > 0)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const reunionWindows = reunions.map(resolveReunionWindows);

  const primaryDepartureStartMs = getStartOfDayInTimeZoneMs(primaryDepartureDate, homeTz);
  const secondaryDepartureStartMs = getStartOfDayInTimeZoneMs(secondaryDepartureDate, homeTz);

  // 1. Determine Phase & Active Reunion
  /** @type {'PRE_TRIP'|'APART'|'TOGETHER'} */
  let phase = 'APART';
  /** @type {import('./config.js').EvaluatedBoardState['activeReunion']} */
  let activeReunion = null;
  let activeReunionWindow = null;
  let activeLegWindow = null;

  for (const rw of reunionWindows) {
    if (nowMs >= rw.startMs && nowMs <= rw.endMs) {
      phase = 'TOGETHER';
      activeReunionWindow = rw;
      activeLegWindow =
        rw.legWindows.find((lw) => nowMs >= lw.startMs && nowMs <= lw.endMs) ??
        rw.legWindows[rw.legWindows.length - 1];

      const localDateInLeg = getZonedDateParts(nowMs, activeLegWindow.country.timeZone).dateStr;
      const priorLegsDays = rw.legWindows
        .slice(0, activeLegWindow.index)
        .reduce((acc, lw) => acc + lw.totalLegDays, 0);
      const dayOfLeg = Math.min(
        activeLegWindow.totalLegDays,
        Math.max(1, diffCalendarDays(activeLegWindow.leg.startDate, localDateInLeg) + 1)
      );
      const dayOfReunion = Math.min(
        rw.totalReunionDays,
        Math.max(1, priorLegsDays + dayOfLeg)
      );

      const nextLegWindow = rw.legWindows[activeLegWindow.index + 1] ?? null;
      const daysUntilNextLeg = nextLegWindow
        ? Math.max(0, diffCalendarDays(localDateInLeg, nextLegWindow.leg.startDate))
        : null;

      activeReunion = {
        reunion: rw.reunion,
        activeLeg: activeLegWindow.leg,
        legIndex: activeLegWindow.index,
        totalLegs: rw.legWindows.length,
        dayOfReunion,
        totalReunionDays: rw.totalReunionDays,
        dayOfLeg,
        totalLegDays: activeLegWindow.totalLegDays,
        nextLeg: nextLegWindow ? nextLegWindow.leg : null,
        daysUntilNextLeg
      };
      break;
    }
  }

  if (phase !== 'TOGETHER' && nowMs < primaryDepartureStartMs) {
    phase = 'PRE_TRIP';
  }

  // 2. Relationship Duration (in origin timezone)
  const currentOriginDateStr = getZonedDateParts(nowMs, homeTz).dateStr;
  const relationshipDuration = computeRelationshipDuration(
    config.relationshipOriginDate,
    currentOriginDateStr
  );

  // 3. Merge Milestones (baseline + auto-generated monthly anniversaries + customMilestones)
  const baseMilestones = [...(config.milestones || []), ...(liveState?.customMilestones || [])];
  const monthlyAnniversaries = generateMonthlyAnniversaries(
    config.relationshipOriginDate,
    10,
    24,
    baseMilestones,
    reunions,
    config.homeCountryCode
  );
  const milestoneOverrides = liveState?.milestoneOverrides || {};
  const allMilestones = [...baseMilestones, ...monthlyAnniversaries]
    .filter((ms) => !milestoneOverrides[ms.id]?.hidden)
    .map((ms) => (milestoneOverrides[ms.id] ? { ...ms, ...milestoneOverrides[ms.id] } : ms))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 4. Primary Countdown & Phase Banner Text
  const nextReunionWindow = reunionWindows.find((rw) => rw.startMs > nowMs) ?? null;
  let phaseBannerText = '';
  /** @type {import('./config.js').EvaluatedBoardState['primaryCountdown']} */
  let primaryCountdown = null;

  const departureMilestone =
    baseMilestones.find((ms) => ms.category === 'departure' && ms.date === primaryDepartureDate) ||
    baseMilestones.find((ms) => ms.category === 'departure') ||
    null;

  const departureParts = decomposeRemainingMs(primaryDepartureStartMs - nowMs);
  const departureCountdown = {
    targetId: departureMilestone?.id || 'ms-primary-depart',
    targetTitle: departureMilestone?.title || 'Trip Departure',
    targetEmoji: departureMilestone?.emoji || '✈️',
    targetDate: primaryDepartureDate,
    targetEpochMs: primaryDepartureStartMs,
    ...departureParts
  };

  if (phase === 'PRE_TRIP') {
    phaseBannerText = `Pre-Trip • Together at Home ${homeCountry.flag}`;
    if (nextReunionWindow) {
      const originStartMs = getStartOfDayInTimeZoneMs(config.relationshipOriginDate, homeTz);
      const remaining = decomposeRemainingMs(nextReunionWindow.startMs - nowMs);
      const totalSpanMs = Math.max(1, nextReunionWindow.startMs - originStartMs);
      const separationProgressPct = Math.min(
        100,
        Math.max(0, Number((((nowMs - originStartMs) / totalSpanMs) * 100).toFixed(2)))
      );
      primaryCountdown = {
        targetId: nextReunionWindow.reunion.id,
        targetTitle: nextReunionWindow.reunion.title,
        targetEmoji: nextReunionWindow.reunion.emoji,
        targetDate: nextReunionWindow.reunion.startDate,
        targetEpochMs: nextReunionWindow.startMs,
        ...remaining,
        separationProgressPct,
        separationStartDate: primaryDepartureDate,
        separationTotalDays: diffCalendarDays(
          primaryDepartureDate,
          nextReunionWindow.reunion.startDate
        ),
        departureCountdown
      };
    }
  } else if (phase === 'TOGETHER' && activeReunionWindow && activeLegWindow && activeReunion) {
    phaseBannerText = `Together Now in ${activeLegWindow.country.name} ${activeLegWindow.country.flag}`;
    const remaining = decomposeRemainingMs(activeReunionWindow.endMs - nowMs);
    const totalSpanMs = Math.max(1, activeReunionWindow.endMs - activeReunionWindow.startMs);
    const chapterProgressPct = Math.min(
      100,
      Math.max(0, Number((((nowMs - activeReunionWindow.startMs) / totalSpanMs) * 100).toFixed(2)))
    );
    primaryCountdown = {
      targetId: activeReunionWindow.reunion.id,
      targetTitle: activeReunionWindow.reunion.title,
      targetEmoji: activeReunionWindow.reunion.emoji,
      targetDate: activeReunionWindow.reunion.endDate,
      targetEpochMs: activeReunionWindow.endMs,
      ...remaining,
      separationProgressPct: chapterProgressPct,
      separationStartDate: activeReunionWindow.reunion.startDate,
      separationTotalDays: activeReunionWindow.totalReunionDays
    };
  } else {
    // phase === 'APART'
    if (nextReunionWindow) {
      phaseBannerText = `Apart • Counting Down to ${nextReunionWindow.reunion.title} ${nextReunionWindow.reunion.emoji}`;
      const previousReunionWindows = reunionWindows.filter((rw) => rw.endMs < nowMs);
      const lastCompletedReunion =
        previousReunionWindows.length > 0
          ? previousReunionWindows[previousReunionWindows.length - 1]
          : null;

      const separationStartMs = lastCompletedReunion
        ? lastCompletedReunion.endMs + 1
        : primaryDepartureStartMs;
      const separationStartDate = lastCompletedReunion
        ? lastCompletedReunion.reunion.endDate
        : primaryDepartureDate;
      const separationTotalDays = diffCalendarDays(
        separationStartDate,
        nextReunionWindow.reunion.startDate
      );

      const totalSeparationMs = Math.max(1, nextReunionWindow.startMs - separationStartMs);
      const separationProgressPct = Math.min(
        100,
        Math.max(0, Number((((nowMs - separationStartMs) / totalSeparationMs) * 100).toFixed(2)))
      );
      const remaining = decomposeRemainingMs(nextReunionWindow.startMs - nowMs);

      primaryCountdown = {
        targetId: nextReunionWindow.reunion.id,
        targetTitle: nextReunionWindow.reunion.title,
        targetEmoji: nextReunionWindow.reunion.emoji,
        targetDate: nextReunionWindow.reunion.startDate,
        targetEpochMs: nextReunionWindow.startMs,
        ...remaining,
        separationProgressPct,
        separationStartDate,
        separationTotalDays
      };
    } else {
      phaseBannerText = 'Apart • Next Reunion TBD 🌏';
      primaryCountdown = null;
    }
  }

  // 5. Sooner Milestone Resolution
  /** @type {import('./config.js').MilestoneEvent | null} */
  let soonerMilestone = null;
  /** @type {number | null} */
  let soonerMilestoneDaysAway = null;

  for (const ms of allMilestones) {
    const msCountry = resolveCountry(ms.countryCode || config.homeCountryCode);
    const msEndMs = getEndOfDayInTimeZoneMs(ms.date, msCountry.timeZone);
    if (msEndMs < nowMs) {
      continue;
    }

    if (phase === 'APART' && primaryCountdown && ms.date >= primaryCountdown.targetDate) {
      continue;
    }
    if (phase === 'PRE_TRIP' && primaryCountdown && ms.date >= primaryCountdown.targetDate) {
      continue;
    }
    if (phase === 'TOGETHER' && activeReunionWindow && ms.date > activeReunionWindow.reunion.endDate) {
      continue;
    }

    soonerMilestone = ms;
    const currentLocalDateInMsTz = getZonedDateParts(nowMs, msCountry.timeZone).dateStr;
    soonerMilestoneDaysAway = Math.max(0, diffCalendarDays(currentLocalDateInMsTz, ms.date));
    break;
  }

  // 6. Dual Status & Timezone Bridge
  const resolvePersonStatus = (
    /** @type {string} */ personKey,
    /** @type {'primary'|'secondary'} */ slot
  ) => {
    const override =
      liveState?.statusOverrides?.[personKey] ??
      liveState?.statusOverrides?.[slot] ??
      null;
    let countryCode = config.homeCountryCode;
    let cityNote = '';
    let isAutoSyncedToReunion = false;

    const soloLocs = config.defaultSoloLocations || {};
    const getPhaseDefault = (phaseKey) => {
      const phaseObj = soloLocs[phaseKey] || {};
      return phaseObj[personKey] || phaseObj[slot] || { countryCode: config.homeCountryCode, cityNote: '' };
    };

    if (phase === 'TOGETHER' && activeLegWindow) {
      const overrideMs = override?.updatedAt ? Date.parse(override.updatedAt) : NaN;
      if (override?.countryCode && Number.isFinite(overrideMs) && overrideMs > activeLegWindow.startMs) {
        countryCode = override.countryCode;
        cityNote = override.cityNote ?? '';
        isAutoSyncedToReunion = false;
      } else {
        countryCode = activeLegWindow.leg.countryCode;
        cityNote = '';
        isAutoSyncedToReunion = true;
      }
    } else if (override?.countryCode) {
      countryCode = override.countryCode;
      cityNote = override.cityNote ?? '';
      isAutoSyncedToReunion = false;
    } else if (phase === 'PRE_TRIP') {
      const def = getPhaseDefault('preTrip');
      countryCode = def.countryCode;
      cityNote = def.cityNote ?? '';
    } else {
      // APART default solo locations based on which separation phase we are in
      const firstReunion = reunionWindows[0] ?? null;
      const secondReunion = reunionWindows[1] ?? null;
      if (firstReunion && nowMs < firstReunion.startMs) {
        if (slot === 'secondary' && nowMs < secondaryDepartureStartMs) {
          const def = getPhaseDefault('preTrip');
          countryCode = def.countryCode;
          cityNote = def.cityNote ?? '';
        } else {
          const def = getPhaseDefault('apartPhase1');
          countryCode = def.countryCode;
          cityNote = def.cityNote ?? '';
        }
      } else if (secondReunion && nowMs < secondReunion.startMs) {
        const def = getPhaseDefault('apartPhase2');
        countryCode = def.countryCode;
        cityNote = def.cityNote ?? '';
      } else {
        const def = getPhaseDefault('apartPhase3');
        countryCode = def.countryCode;
        cityNote = def.cityNote ?? '';
      }
    }

    const countryInfo = resolveCountry(countryCode);
    const zonedParts = getZonedDateParts(nowMs, countryInfo.timeZone);
    const utcOffsetMinutes = getUtcOffsetMinutes(nowMs, countryInfo.timeZone);

    return {
      person: personKey,
      slot,
      displayName: config.coupleNames?.[personKey] || personKey,
      countryCode: countryInfo.code,
      countryName: countryInfo.name,
      flag: countryInfo.flag,
      timeZone: countryInfo.timeZone,
      cityNote,
      localTimeFormatted: zonedParts.timeStr,
      utcOffsetMinutes,
      isAutoSyncedToReunion
    };
  };

  const primaryStatus = resolvePersonStatus(firstPartnerKey, 'primary');
  const secondaryStatus = resolvePersonStatus(secondPartnerKey, 'secondary');
  const rawHourDiff = Math.abs(primaryStatus.utcOffsetMinutes - secondaryStatus.utcOffsetMinutes) / 60;
  const hourDifference = Number.isInteger(rawHourDiff) ? rawHourDiff : Number(rawHourDiff.toFixed(1));
  const isSameTimeZone = hourDifference === 0;
  const bridgeLabel = isSameTimeZone ? 'Same time zone! 🎉' : `${hourDifference}h apart`;

  // 7. Timeline Partitioning & Trip Together Stats
  const plannedTripDaysTogether = reunionWindows.reduce((sum, rw) => sum + rw.totalReunionDays, 0);
  const completedTripDaysTogether = reunionWindows.reduce((sum, rw) => {
    if (nowMs > rw.endMs) {
      return sum + rw.totalReunionDays;
    }
    if (nowMs >= rw.startMs && nowMs <= rw.endMs && activeReunion?.reunion.id === rw.reunion.id) {
      return sum + activeReunion.dayOfReunion;
    }
    return sum;
  }, 0);

  /** @type {Map<string, { countryCode: string, countryName: string, flag: string, days: number }>} */
  const countryDaysMap = new Map();
  for (const rw of reunionWindows) {
    for (const lw of rw.legWindows) {
      const code = lw.country.code;
      const customLabel = lw.leg.label?.trim();
      const mapKey = customLabel ? `${code}:${customLabel}` : code;
      const existing = countryDaysMap.get(mapKey) || {
        countryCode: code,
        countryName: customLabel || lw.country.name,
        flag: lw.country.flag,
        days: 0
      };
      existing.days += lw.totalLegDays;
      countryDaysMap.set(mapKey, existing);
    }
  }
  const countryDaysBreakdown = Array.from(countryDaysMap.values());

  const timelineDescriptors = [
    ...allMilestones.map((ms) => {
      const msCountry = resolveCountry(ms.countryCode || config.homeCountryCode);
      const startMs = getStartOfDayInTimeZoneMs(ms.date, msCountry.timeZone);
      const endMs = getEndOfDayInTimeZoneMs(ms.date, msCountry.timeZone);
      return {
        item: ms,
        sortDate: ms.date,
        startMs,
        endMs,
        typeOrder: 0
      };
    }),
    ...reunionWindows.map((rw) => ({
      item: rw.reunion,
      sortDate: rw.reunion.startDate,
      startMs: rw.startMs,
      endMs: rw.endMs,
      typeOrder: 1
    }))
  ].sort((a, b) => {
    const dateCmp = a.sortDate.localeCompare(b.sortDate);
    if (dateCmp !== 0) {
      return dateCmp;
    }
    if (a.typeOrder !== b.typeOrder) {
      return a.typeOrder - b.typeOrder;
    }
    return a.startMs - b.startMs;
  });

  /** @type {Array<import('./config.js').MilestoneEvent | import('./config.js').ReunionChapter>} */
  const pastItems = [];
  /** @type {Array<import('./config.js').MilestoneEvent | import('./config.js').ReunionChapter>} */
  const upcomingItems = [];

  for (const desc of timelineDescriptors) {
    if (nowMs > desc.endMs) {
      pastItems.push(desc.item);
    } else {
      upcomingItems.push(desc.item);
    }
  }

  return {
    nowMs,
    phase,
    phaseBannerText,
    relationshipDuration,
    primaryCountdown,
    departureCountdown: phase === 'PRE_TRIP' ? departureCountdown : null,
    activeReunion,
    soonerMilestone,
    soonerMilestoneDaysAway,
    dualStatus: {
      [firstPartnerKey]: primaryStatus,
      [secondPartnerKey]: secondaryStatus,
      primary: primaryStatus,
      secondary: secondaryStatus,
      hourDifference,
      isSameTimeZone,
      bridgeLabel
    },
    timeline: {
      plannedTripDaysTogether,
      completedTripDaysTogether,
      countryDaysBreakdown,
      pastItems,
      upcomingItems
    }
  };
}
