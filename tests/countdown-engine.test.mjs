import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getZonedDateParts,
  getStartOfDayInTimeZoneMs,
  getEndOfDayInTimeZoneMs,
  getZonedWallClockEpochMs,
  parseTimeParts,
  getUtcOffsetMinutes,
  formatDisplayDate,
  formatShortDisplayDate,
  generateMonthlyAnniversaries,
  evaluateBoardState
} from '../js/countdown-engine.js';

/**
 * Synthetic test fixture exercising all state machine invariants (Pre-Trip, Apart phases,
 * single-leg reunion, 3-country continuous reunion, and timezone transitions) without real PII.
 * @type {import('../js/config.js').TripConfig}
 */
const SYNTHETIC_TRIP_CONFIG = {
  coupleNames: {
    partnerA: 'Alex',
    partnerB: 'Jordan'
  },
  relationshipOriginDate: '2025-01-10',
  homeCountryCode: 'IL',
  primaryDepartureDate: '2025-12-06',
  secondaryDepartureDate: '2025-12-07',
  pinnedCountryCodes: ['IL', 'AR', 'TH', 'SG', 'KR', 'JP', 'VN'],
  defaultSoloLocations: {
    preTrip: {
      partnerA: { countryCode: 'IL', cityNote: '' },
      partnerB: { countryCode: 'IL', cityNote: '' }
    },
    apartPhase1: {
      partnerA: { countryCode: 'AR', cityNote: '' },
      partnerB: { countryCode: 'TH', cityNote: '' }
    },
    apartPhase2: {
      partnerA: { countryCode: 'AR', cityNote: '' },
      partnerB: { countryCode: 'VN', cityNote: '' }
    },
    apartPhase3: {
      partnerA: { countryCode: 'JP', cityNote: '' },
      partnerB: { countryCode: 'JP', cityNote: '' }
    }
  },
  reunions: [
    {
      id: 'reunion-1-coastal',
      title: 'Coastal Reunion #1',
      emoji: '🌺',
      startDate: '2025-12-31',
      endDate: '2026-01-10',
      description: '11-day shared chapter',
      legs: [
        {
          id: 'leg-coastal-1',
          countryCode: 'TH',
          startDate: '2025-12-31',
          endDate: '2026-01-10',
          notes: 'Shared chapter notes'
        }
      ]
    },
    {
      id: 'reunion-2-trio',
      title: 'Three-Country Chapter',
      emoji: '🌸',
      startDate: '2026-03-10',
      endDate: '2026-04-21',
      description: '42-day continuous shared chapter across 3 countries',
      legs: [
        {
          id: 'leg-stop-1',
          countryCode: 'SG',
          startDate: '2026-03-10',
          endDate: '2026-03-13',
          notes: 'Stop 1'
        },
        {
          id: 'leg-stop-2',
          countryCode: 'KR',
          startDate: '2026-03-13',
          endDate: '2026-03-20',
          notes: 'Stop 2'
        },
        {
          id: 'leg-stop-3',
          countryCode: 'JP',
          startDate: '2026-03-20',
          endDate: '2026-04-21',
          notes: 'Stop 3'
        }
      ]
    }
  ],
  milestones: [
    {
      id: 'ms-origin',
      date: '2025-01-10',
      category: 'origin',
      emoji: '💕',
      title: 'Origin Date',
      details: 'Start of timeline',
      person: 'both',
      countryCode: 'IL'
    },
    {
      id: 'ms-primary-depart',
      date: '2025-12-06',
      category: 'departure',
      emoji: '✈️',
      title: 'Partner A Departs',
      details: 'Apart Phase #1 begins',
      person: 'partnerA',
      countryCode: 'AR'
    },
    {
      id: 'ms-secondary-depart',
      date: '2025-12-07',
      category: 'departure',
      emoji: '✈️',
      title: 'Partner B Departs',
      details: 'Solo leg underway',
      person: 'partnerB',
      countryCode: 'TH'
    },
    {
      id: 'ms-mid-dec-event',
      date: '2025-12-15',
      category: 'birthday',
      emoji: '🎂',
      title: 'Mid-December Milestone',
      details: 'Celebrated across continents',
      person: 'partnerA',
      countryCode: 'AR'
    },
    {
      id: 'ms-one-year-anniversary',
      date: '2026-01-10',
      category: 'anniversary',
      emoji: '🥂',
      title: '1-Year Anniversary (12 Months!)',
      details: 'Celebrated together',
      person: 'both',
      countryCode: 'TH'
    }
  ]
};

test('Timezone & Date Helpers: getZonedDateParts, getUtcOffsetMinutes, and start/end of day boundaries', () => {
  const sampleEpochMs = Date.parse('2025-12-12T15:00:00Z');

  const arParts = getZonedDateParts(sampleEpochMs, 'America/Argentina/Buenos_Aires');
  assert.equal(arParts.dateStr, '2025-12-12');
  assert.equal(arParts.timeStr, '12:00');
  assert.equal(arParts.hour, 12);

  const thParts = getZonedDateParts(sampleEpochMs, 'Asia/Bangkok');
  assert.equal(thParts.dateStr, '2025-12-12');
  assert.equal(thParts.timeStr, '22:00');
  assert.equal(thParts.hour, 22);

  const arOffset = getUtcOffsetMinutes(sampleEpochMs, 'America/Argentina/Buenos_Aires');
  const thOffset = getUtcOffsetMinutes(sampleEpochMs, 'Asia/Bangkok');
  assert.equal(arOffset, -180);
  assert.equal(thOffset, 420);
  assert.equal(Math.abs(thOffset - arOffset) / 60, 10);

  const bkkStartMs = getStartOfDayInTimeZoneMs('2025-12-31', 'Asia/Bangkok');
  assert.equal(bkkStartMs, Date.parse('2025-12-30T17:00:00.000Z'));
  assert.equal(getZonedDateParts(bkkStartMs, 'Asia/Bangkok').dateStr, '2025-12-31');
  assert.equal(getZonedDateParts(bkkStartMs, 'Asia/Bangkok').timeStr, '00:00');
  assert.equal(getZonedDateParts(bkkStartMs - 1, 'Asia/Bangkok').dateStr, '2025-12-30');

  const bkkEndMs = getEndOfDayInTimeZoneMs('2026-01-10', 'Asia/Bangkok');
  assert.equal(bkkEndMs, Date.parse('2026-01-10T16:59:59.999Z'));
  assert.equal(getZonedDateParts(bkkEndMs, 'Asia/Bangkok').dateStr, '2026-01-10');
  assert.equal(getZonedDateParts(bkkEndMs, 'Asia/Bangkok').timeStr, '23:59');
  assert.equal(getZonedDateParts(bkkEndMs + 1, 'Asia/Bangkok').dateStr, '2026-01-11');

  assert.equal(formatDisplayDate('2025-12-31'), '31-12-2025');
  assert.equal(formatDisplayDate('2025-12-31', true), '31-12-25');
  assert.equal(formatShortDisplayDate('2026-03-10'), '10-03-26');
});

test('Automatic Monthly Anniversary Generator produces milestones on the 10th and skips existing 1-Year duplicate', () => {
  const milestones = generateMonthlyAnniversaries(
    '2025-01-10',
    '2025-11',
    '2027-01',
    SYNTHETIC_TRIP_CONFIG.milestones,
    SYNTHETIC_TRIP_CONFIG.reunions,
    'IL'
  );

  const byDate = new Map(milestones.map((m) => [m.date, m]));
  assert.equal(byDate.get('2025-11-10')?.title, '10 Months Together');
  assert.equal(byDate.get('2025-12-10')?.title, '11 Months Together');
  assert.equal(byDate.has('2026-01-10'), false, 'Should skip 2026-01-10 because ms-one-year-anniversary exists');
  assert.equal(byDate.get('2026-02-10')?.title, '13 Months Together');
  assert.equal(byDate.get('2026-03-10')?.title, '14 Months Together');
  assert.equal(byDate.get('2026-03-10')?.countryCode, 'SG');
  assert.equal(byDate.get('2026-04-10')?.title, '15 Months Together');
  assert.equal(byDate.get('2026-04-10')?.countryCode, 'JP');
  assert.equal(byDate.get('2027-01-10')?.title, '2-Year Anniversary (24 Months!)');
});

test('Phase 1: Pre-Trip at Home (2025-10-31T12:00:00+02:00)', () => {
  const nowMs = Date.parse('2025-10-31T12:00:00+02:00');
  const state = evaluateBoardState(SYNTHETIC_TRIP_CONFIG, null, nowMs);

  assert.equal(state.phase, 'PRE_TRIP');
  assert.equal(state.phaseBannerText, 'Pre-Trip • Together at Home 🇮🇱');
  assert.equal(state.activeReunion, null);

  assert.equal(state.relationshipDuration.totalDays, 294);
  assert.equal(state.relationshipDuration.months, 9);
  assert.equal(state.relationshipDuration.daysRemainder, 21);

  assert.ok(state.primaryCountdown);
  assert.equal(state.primaryCountdown.targetId, 'reunion-1-coastal');
  assert.equal(state.primaryCountdown.targetDate, '2025-12-31');

  assert.ok(state.departureCountdown);
  assert.equal(state.departureCountdown.targetDate, '2025-12-06');
  assert.equal(state.departureCountdown.days, 35);

  assert.ok(state.soonerMilestone);
  assert.equal(state.soonerMilestone.date, '2025-11-10');
  assert.equal(state.soonerMilestone.title, '10 Months Together');
  assert.equal(state.soonerMilestoneDaysAway, 10);

  assert.equal(state.dualStatus.primary.countryCode, 'IL');
  assert.equal(state.dualStatus.secondary.countryCode, 'IL');
  assert.equal(state.dualStatus.isSameTimeZone, true);
  assert.equal(state.dualStatus.hourDifference, 0);

  assert.equal(state.timeline.plannedTripDaysTogether, 53);
  assert.equal(state.timeline.completedTripDaysTogether, 0);
  assert.equal(state.timeline.pastItems.length, 1);
  assert.equal(state.timeline.pastItems[0].id, 'ms-origin');
});

test('Phase 2: Apart Phase #1 (2025-12-12T15:00:00Z)', () => {
  const nowMs = Date.parse('2025-12-12T15:00:00Z');
  const state = evaluateBoardState(SYNTHETIC_TRIP_CONFIG, null, nowMs);

  assert.equal(state.phase, 'APART');
  assert.equal(state.activeReunion, null);

  assert.ok(state.primaryCountdown);
  assert.equal(state.primaryCountdown.targetId, 'reunion-1-coastal');
  assert.equal(state.primaryCountdown.targetDate, '2025-12-31');
  assert.equal(state.primaryCountdown.days, 18);
  assert.equal(state.primaryCountdown.hours, 2);
  assert.equal(state.primaryCountdown.separationStartDate, '2025-12-06');
  assert.equal(state.primaryCountdown.separationTotalDays, 25);

  assert.ok(state.soonerMilestone);
  assert.equal(state.soonerMilestone.id, 'ms-mid-dec-event');
  assert.equal(state.soonerMilestone.date, '2025-12-15');
  assert.equal(state.soonerMilestoneDaysAway, 3);

  assert.equal(state.dualStatus.primary.countryCode, 'AR');
  assert.equal(state.dualStatus.primary.localTimeFormatted, '12:00');
  assert.equal(state.dualStatus.secondary.countryCode, 'TH');
  assert.equal(state.dualStatus.secondary.localTimeFormatted, '22:00');
  assert.equal(state.dualStatus.hourDifference, 10);
  assert.equal(state.dualStatus.isSameTimeZone, false);
  assert.equal(state.dualStatus.bridgeLabel, '10h apart');
});

test('Phase 3: Active Reunion #1 (2026-01-02T12:00:00+07:00)', () => {
  const nowMs = Date.parse('2026-01-02T12:00:00+07:00');
  const state = evaluateBoardState(SYNTHETIC_TRIP_CONFIG, null, nowMs);

  assert.equal(state.phase, 'TOGETHER');
  assert.ok(state.activeReunion);
  assert.equal(state.activeReunion.reunion.id, 'reunion-1-coastal');
  assert.equal(state.activeReunion.activeLeg.id, 'leg-coastal-1');
  assert.equal(state.activeReunion.dayOfReunion, 3);
  assert.equal(state.activeReunion.totalReunionDays, 11);

  assert.equal(state.dualStatus.primary.countryCode, 'TH');
  assert.equal(state.dualStatus.primary.isAutoSyncedToReunion, true);
  assert.equal(state.dualStatus.secondary.countryCode, 'TH');
  assert.equal(state.dualStatus.secondary.isAutoSyncedToReunion, true);
  assert.equal(state.dualStatus.isSameTimeZone, true);

  assert.ok(state.soonerMilestone);
  assert.equal(state.soonerMilestone.id, 'ms-one-year-anniversary');
  assert.equal(state.soonerMilestoneDaysAway, 8);
});

test('Phase 4: Apart Phase #2 (2026-02-15T15:00:00Z)', () => {
  const nowMs = Date.parse('2026-02-15T15:00:00Z');
  const state = evaluateBoardState(SYNTHETIC_TRIP_CONFIG, null, nowMs);

  assert.equal(state.phase, 'APART');
  assert.ok(state.primaryCountdown);
  assert.equal(state.primaryCountdown.targetId, 'reunion-2-trio');
  assert.equal(state.primaryCountdown.separationStartDate, '2026-01-10');
  assert.equal(state.primaryCountdown.separationTotalDays, 59);

  const pastIds = state.timeline.pastItems.map((item) => item.id);
  assert.ok(pastIds.includes('reunion-1-coastal'));
  assert.equal(state.timeline.completedTripDaysTogether, 11);
});

test('Phase 5: Multi-Leg Reunion (SG -> KR -> JP) with seamless leg transitions', () => {
  const sgMs = Date.parse('2026-03-11T12:00:00+08:00');
  const sgState = evaluateBoardState(SYNTHETIC_TRIP_CONFIG, null, sgMs);
  assert.equal(sgState.phase, 'TOGETHER');
  assert.equal(sgState.activeReunion?.activeLeg.countryCode, 'SG');
  assert.equal(sgState.activeReunion?.totalReunionDays, 42);
  assert.equal(sgState.activeReunion?.dayOfReunion, 2);
  assert.equal(sgState.activeReunion?.nextLeg?.id, 'leg-stop-2');

  const krStartMs = getStartOfDayInTimeZoneMs('2026-03-13', 'Asia/Seoul');
  const justBeforeKrState = evaluateBoardState(SYNTHETIC_TRIP_CONFIG, null, krStartMs - 1);
  const atKrStartState = evaluateBoardState(SYNTHETIC_TRIP_CONFIG, null, krStartMs);
  assert.equal(justBeforeKrState.activeReunion?.activeLeg.countryCode, 'SG');
  assert.equal(atKrStartState.activeReunion?.activeLeg.countryCode, 'KR');

  const jpMs = Date.parse('2026-03-25T12:00:00+09:00');
  const jpState = evaluateBoardState(SYNTHETIC_TRIP_CONFIG, null, jpMs);
  assert.equal(jpState.activeReunion?.activeLeg.countryCode, 'JP');
  assert.equal(jpState.activeReunion?.dayOfLeg, 6);
  assert.equal(jpState.activeReunion?.dayOfReunion, 16);
  assert.equal(jpState.activeReunion?.nextLeg, null);
});

test('LiveState statusOverrides: ignored during reunion if older than leg start, honored if newer', () => {
  const reunionMs = Date.parse('2026-01-02T12:00:00+07:00');

  const staleLiveState = {
    schemaVersion: 1,
    updatedAt: '2025-12-20T10:00:00Z',
    statusOverrides: {
      partnerA: {
        countryCode: 'PE',
        cityNote: 'Mountain Trail',
        updatedAt: '2025-12-20T10:00:00Z'
      }
    }
  };

  const stateWithStaleOverride = evaluateBoardState(SYNTHETIC_TRIP_CONFIG, staleLiveState, reunionMs);
  assert.equal(stateWithStaleOverride.dualStatus.primary.countryCode, 'TH');
  assert.equal(stateWithStaleOverride.dualStatus.primary.cityNote, '');
  assert.equal(stateWithStaleOverride.dualStatus.primary.isAutoSyncedToReunion, true);

  const freshLiveState = {
    schemaVersion: 1,
    updatedAt: '2026-01-01T08:00:00Z',
    statusOverrides: {
      partnerA: {
        countryCode: 'TH',
        cityNote: 'Island Bay',
        updatedAt: '2026-01-01T08:00:00Z'
      }
    }
  };

  const stateWithFreshOverride = evaluateBoardState(SYNTHETIC_TRIP_CONFIG, freshLiveState, reunionMs);
  assert.equal(stateWithFreshOverride.dualStatus.primary.countryCode, 'TH');
  assert.equal(stateWithFreshOverride.dualStatus.primary.cityNote, 'Island Bay');
  assert.equal(stateWithFreshOverride.dualStatus.primary.isAutoSyncedToReunion, false);
});

test('Time Precision & Multi-Leg Route Editing: parseTimeParts, zoned wall clock, and leg time boundaries', () => {
  assert.deepEqual(parseTimeParts('14:30'), [14, 30]);
  assert.deepEqual(parseTimeParts('09:05'), [9, 5]);
  assert.deepEqual(parseTimeParts(null, 0, 0), [0, 0]);
  assert.deepEqual(parseTimeParts(undefined, 23, 59), [23, 59]);

  // Specific wall-clock epoch in Singapore (UTC+8) at 14:30
  const sgEpoch = getZonedWallClockEpochMs('2026-03-10', 'Asia/Singapore', 14, 30, 0, 0);
  const sgParts = getZonedDateParts(sgEpoch, 'Asia/Singapore');
  assert.equal(sgParts.dateStr, '2026-03-10');
  assert.equal(sgParts.timeStr, '14:30');

  // Multi-leg chapter with custom times & leg labels
  const timedChapter = {
    id: 'reunion-timed',
    title: 'Southeast Asia Journey',
    emoji: '✈️',
    startDate: '2026-03-10',
    endDate: '2026-03-20',
    description: 'Timed multi-stop trip',
    legs: [
      {
        id: 'leg-1',
        countryCode: 'SG',
        label: 'Marina Bay & Sentosa',
        startDate: '2026-03-10',
        endDate: '2026-03-13',
        startTime: '10:00',
        endTime: '16:00'
      },
      {
        id: 'leg-2',
        countryCode: 'JP',
        label: 'Tokyo Cherry Blossoms',
        startDate: '2026-03-13',
        endDate: '2026-03-20',
        startTime: '16:00',
        endTime: '22:00'
      }
    ]
  };

  const config = {
    ...SYNTHETIC_TRIP_CONFIG,
    reunions: [timedChapter]
  };

  // 1 minute before Singapore start time
  const beforeStartMs = getZonedWallClockEpochMs('2026-03-10', 'Asia/Singapore', 9, 59, 0, 0);
  const beforeState = evaluateBoardState(config, null, beforeStartMs);
  assert.equal(beforeState.phase, 'APART');

  // Exactly at Singapore start time
  const atStartMs = getZonedWallClockEpochMs('2026-03-10', 'Asia/Singapore', 10, 0, 0, 0);
  const activeState = evaluateBoardState(config, null, atStartMs);
  assert.equal(activeState.phase, 'TOGETHER');
  assert.equal(activeState.activeReunion?.activeLeg.countryCode, 'SG');
  assert.equal(activeState.activeReunion?.activeLeg.label, 'Marina Bay & Sentosa');

  // Overridden chapter legs via liveState
  const liveStateWithOverriddenLegs = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    statusOverrides: {},
    chapterOverrides: {
      'reunion-timed': {
        title: 'Updated Southeast Asia Tour',
        legs: [
          {
            id: 'leg-1-modified',
            countryCode: 'TH',
            label: 'Bangkok Old Town',
            startDate: '2026-03-08',
            endDate: '2026-03-15',
            startTime: '12:00'
          }
        ]
      }
    }
  };

  const overriddenState = evaluateBoardState(config, liveStateWithOverriddenLegs, atStartMs);
  assert.equal(overriddenState.phase, 'TOGETHER');
  assert.equal(overriddenState.activeReunion?.reunion.title, 'Updated Southeast Asia Tour');
  assert.equal(overriddenState.activeReunion?.activeLeg.countryCode, 'TH');
  assert.equal(overriddenState.activeReunion?.activeLeg.label, 'Bangkok Old Town');
});
