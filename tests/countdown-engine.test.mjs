import test from 'node:test';
import assert from 'node:assert/strict';

import { TRIP_CONFIG } from '../js/config.js';
import {
  getZonedDateParts,
  getStartOfDayInTimeZoneMs,
  getEndOfDayInTimeZoneMs,
  getUtcOffsetMinutes,
  formatDisplayDate,
  formatShortDisplayDate,
  generateMonthlyAnniversaries,
  evaluateBoardState
} from '../js/countdown-engine.js';

test('Timezone & Date Helpers: getZonedDateParts, getUtcOffsetMinutes, and start/end of day boundaries', () => {
  const sampleEpochMs = Date.parse('2026-12-12T15:00:00Z');

  const arParts = getZonedDateParts(sampleEpochMs, 'America/Argentina/Buenos_Aires');
  assert.equal(arParts.dateStr, '2026-12-12');
  assert.equal(arParts.timeStr, '12:00');
  assert.equal(arParts.hour, 12);

  const thParts = getZonedDateParts(sampleEpochMs, 'Asia/Bangkok');
  assert.equal(thParts.dateStr, '2026-12-12');
  assert.equal(thParts.timeStr, '22:00');
  assert.equal(thParts.hour, 22);

  const arOffset = getUtcOffsetMinutes(sampleEpochMs, 'America/Argentina/Buenos_Aires');
  const thOffset = getUtcOffsetMinutes(sampleEpochMs, 'Asia/Bangkok');
  assert.equal(arOffset, -180);
  assert.equal(thOffset, 420);
  assert.equal(Math.abs(thOffset - arOffset) / 60, 10);

  const bkkStartMs = getStartOfDayInTimeZoneMs('2026-12-31', 'Asia/Bangkok');
  assert.equal(bkkStartMs, Date.parse('2026-12-30T17:00:00.000Z'));
  assert.equal(getZonedDateParts(bkkStartMs, 'Asia/Bangkok').dateStr, '2026-12-31');
  assert.equal(getZonedDateParts(bkkStartMs, 'Asia/Bangkok').timeStr, '00:00');
  assert.equal(getZonedDateParts(bkkStartMs - 1, 'Asia/Bangkok').dateStr, '2026-12-30');

  const bkkEndMs = getEndOfDayInTimeZoneMs('2027-01-10', 'Asia/Bangkok');
  assert.equal(bkkEndMs, Date.parse('2027-01-10T16:59:59.999Z'));
  assert.equal(getZonedDateParts(bkkEndMs, 'Asia/Bangkok').dateStr, '2027-01-10');
  assert.equal(getZonedDateParts(bkkEndMs, 'Asia/Bangkok').timeStr, '23:59');
  assert.equal(getZonedDateParts(bkkEndMs + 1, 'Asia/Bangkok').dateStr, '2027-01-11');

  assert.equal(formatDisplayDate('2026-12-31'), '31-12-2026');
  assert.equal(formatDisplayDate('2026-12-31', true), '31-12-26');
  assert.equal(formatShortDisplayDate('2027-03-10'), '10-03-27');
});

test('Automatic Monthly Anniversary Generator produces milestones on the 10th and skips existing 1-Year duplicate', () => {
  const milestones = generateMonthlyAnniversaries('2026-01-10', '2026-11', '2028-01');

  const byDate = new Map(milestones.map((m) => [m.date, m]));
  assert.equal(byDate.get('2026-11-10')?.title, '10 Months Together');
  assert.equal(byDate.get('2026-12-10')?.title, '11 Months Together');
  assert.equal(byDate.has('2027-01-10'), false, 'Should skip 2027-01-10 because ms-one-year-anniversary exists');
  assert.equal(byDate.get('2027-02-10')?.title, '13 Months Together');
  assert.equal(byDate.get('2027-03-10')?.title, '14 Months Together');
  assert.equal(byDate.get('2027-03-10')?.countryCode, 'SG');
  assert.equal(byDate.get('2027-04-10')?.title, '15 Months Together');
  assert.equal(byDate.get('2027-04-10')?.countryCode, 'JP');
  assert.equal(byDate.get('2028-01-10')?.title, '2-Year Anniversary (24 Months!)');
});

test('Key Date 1: Pre-Trip in Israel (2026-10-31T12:00:00+02:00)', () => {
  const nowMs = Date.parse('2026-10-31T12:00:00+02:00');
  const state = evaluateBoardState(TRIP_CONFIG, null, nowMs);

  assert.equal(state.phase, 'PRE_TRIP');
  assert.equal(state.phaseBannerText, 'Pre-Trip • Together at Home 🇮🇱');
  assert.equal(state.activeReunion, null);

  assert.equal(state.relationshipDuration.totalDays, 294);
  assert.equal(state.relationshipDuration.months, 9);
  assert.equal(state.relationshipDuration.daysRemainder, 21);
  assert.equal(
    state.relationshipDuration.formattedPill,
    '294 Days Together • 9 Months, 21 Days'
  );

  assert.ok(state.primaryCountdown);
  assert.equal(state.primaryCountdown.targetId, 'reunion-1-thailand');
  assert.equal(state.primaryCountdown.targetDate, '2026-12-31');

  assert.ok(state.departureCountdown);
  assert.equal(state.departureCountdown.targetDate, '2026-12-06');
  assert.equal(state.departureCountdown.days, 35);

  assert.ok(state.soonerMilestone);
  assert.equal(state.soonerMilestone.date, '2026-11-10');
  assert.equal(state.soonerMilestone.title, '10 Months Together');
  assert.equal(state.soonerMilestoneDaysAway, 10);

  assert.equal(state.dualStatus.shoval.countryCode, 'IL');
  assert.equal(state.dualStatus.eitan.countryCode, 'IL');
  assert.equal(state.dualStatus.isSameTimeZone, true);
  assert.equal(state.dualStatus.hourDifference, 0);
  assert.equal(state.dualStatus.bridgeLabel, 'Same time zone! 🎉');

  assert.equal(state.timeline.plannedTripDaysTogether, 53);
  assert.equal(state.timeline.completedTripDaysTogether, 0);
  assert.equal(state.timeline.pastItems.length, 1);
  assert.equal(state.timeline.pastItems[0].id, 'ms-origin');
});

test('Key Date 2: Apart Phase #1 (2026-12-12T15:00:00Z)', () => {
  const nowMs = Date.parse('2026-12-12T15:00:00Z');
  const state = evaluateBoardState(TRIP_CONFIG, null, nowMs);

  assert.equal(state.phase, 'APART');
  assert.equal(state.activeReunion, null);

  assert.ok(state.primaryCountdown);
  assert.equal(state.primaryCountdown.targetId, 'reunion-1-thailand');
  assert.equal(state.primaryCountdown.targetDate, '2026-12-31');
  assert.equal(state.primaryCountdown.days, 18);
  assert.equal(state.primaryCountdown.hours, 2);
  assert.equal(state.primaryCountdown.separationStartDate, '2026-12-06');
  assert.equal(state.primaryCountdown.separationTotalDays, 25);
  assert.ok(
    state.primaryCountdown.separationProgressPct > 20 &&
      state.primaryCountdown.separationProgressPct < 35
  );

  assert.ok(state.soonerMilestone);
  assert.equal(state.soonerMilestone.id, 'ms-shoval-hebrew-bday');
  assert.equal(state.soonerMilestone.date, '2026-12-15');
  assert.equal(state.soonerMilestoneDaysAway, 3);

  assert.equal(state.dualStatus.shoval.countryCode, 'AR');
  assert.equal(state.dualStatus.shoval.cityNote, '');
  assert.equal(state.dualStatus.shoval.localTimeFormatted, '12:00');
  assert.equal(state.dualStatus.eitan.countryCode, 'TH');
  assert.equal(state.dualStatus.eitan.cityNote, '');
  assert.equal(state.dualStatus.eitan.localTimeFormatted, '22:00');
  assert.equal(state.dualStatus.hourDifference, 10);
  assert.equal(state.dualStatus.isSameTimeZone, false);
  assert.equal(state.dualStatus.bridgeLabel, '10h apart');
});

test('Key Date 3: Together in Thailand Reunion #1 (2027-01-02T12:00:00+07:00)', () => {
  const nowMs = Date.parse('2027-01-02T12:00:00+07:00');
  const state = evaluateBoardState(TRIP_CONFIG, null, nowMs);

  assert.equal(state.phase, 'TOGETHER');
  assert.equal(state.phaseBannerText, 'Together Now in Thailand 🇹🇭');
  assert.ok(state.activeReunion);
  assert.equal(state.activeReunion.reunion.id, 'reunion-1-thailand');
  assert.equal(state.activeReunion.activeLeg.id, 'leg-thailand');
  assert.equal(state.activeReunion.activeLeg.countryCode, 'TH');
  assert.equal(state.activeReunion.dayOfReunion, 3);
  assert.equal(state.activeReunion.totalReunionDays, 11);
  assert.equal(state.activeReunion.dayOfLeg, 3);
  assert.equal(state.activeReunion.totalLegDays, 11);
  assert.equal(state.activeReunion.nextLeg, null);

  assert.equal(state.dualStatus.shoval.countryCode, 'TH');
  assert.equal(state.dualStatus.shoval.isAutoSyncedToReunion, true);
  assert.equal(state.dualStatus.eitan.countryCode, 'TH');
  assert.equal(state.dualStatus.eitan.isAutoSyncedToReunion, true);
  assert.equal(state.dualStatus.isSameTimeZone, true);
  assert.equal(state.dualStatus.hourDifference, 0);
  assert.equal(state.dualStatus.bridgeLabel, 'Same time zone! 🎉');

  assert.ok(state.soonerMilestone);
  assert.equal(state.soonerMilestone.id, 'ms-one-year-anniversary');
  assert.equal(state.soonerMilestone.date, '2027-01-10');
  assert.equal(state.soonerMilestoneDaysAway, 8);
});

test('Key Date 4: Apart Phase #2 (2027-02-15T15:00:00Z)', () => {
  const nowMs = Date.parse('2027-02-15T15:00:00Z');
  const state = evaluateBoardState(TRIP_CONFIG, null, nowMs);

  assert.equal(state.phase, 'APART');
  assert.equal(state.activeReunion, null);

  assert.ok(state.primaryCountdown);
  assert.equal(state.primaryCountdown.targetId, 'reunion-2-asia-trio');
  assert.equal(state.primaryCountdown.targetDate, '2027-03-10');
  assert.equal(state.primaryCountdown.separationStartDate, '2027-01-10');
  assert.equal(state.primaryCountdown.separationTotalDays, 59);

  const pastIds = state.timeline.pastItems.map((item) => item.id);
  assert.ok(
    pastIds.includes('reunion-1-thailand'),
    'Thailand Reunion #1 must be in timeline.pastItems during February'
  );
  assert.ok(pastIds.includes('ms-one-year-anniversary'));
  assert.ok(pastIds.includes('ms-anniversary-13m'));
  assert.equal(state.timeline.completedTripDaysTogether, 11);

  assert.equal(state.dualStatus.shoval.countryCode, 'AR');
  assert.equal(state.dualStatus.eitan.countryCode, 'VN');
  assert.equal(state.dualStatus.hourDifference, 10);
});

test('Key Date 5: Together Across 3 Countries (SG -> KR -> JP) with seamless leg transitions', () => {
  // Leg 1: Singapore (2027-03-11T12:00:00+08:00)
  const sgMs = Date.parse('2027-03-11T12:00:00+08:00');
  const sgState = evaluateBoardState(TRIP_CONFIG, null, sgMs);
  assert.equal(sgState.phase, 'TOGETHER');
  assert.equal(sgState.activeReunion?.reunion.id, 'reunion-2-asia-trio');
  assert.equal(sgState.activeReunion?.activeLeg.id, 'leg-singapore');
  assert.equal(sgState.activeReunion?.activeLeg.countryCode, 'SG');
  assert.equal(sgState.activeReunion?.legIndex, 0);
  assert.equal(sgState.activeReunion?.totalLegs, 3);
  assert.equal(sgState.activeReunion?.totalReunionDays, 42);
  assert.equal(sgState.activeReunion?.dayOfReunion, 2);
  assert.equal(sgState.activeReunion?.dayOfLeg, 2);
  assert.equal(sgState.activeReunion?.totalLegDays, 3);
  assert.equal(sgState.activeReunion?.nextLeg?.id, 'leg-south-korea');
  assert.equal(sgState.activeReunion?.daysUntilNextLeg, 2);
  assert.equal(sgState.dualStatus.shoval.countryCode, 'SG');
  assert.equal(sgState.dualStatus.eitan.countryCode, 'SG');
  assert.equal(sgState.dualStatus.isSameTimeZone, true);

  // Seamless boundary between SG and KR at 2027-03-13T00:00:00+09:00
  const krStartMs = getStartOfDayInTimeZoneMs('2027-03-13', 'Asia/Seoul');
  const justBeforeKrState = evaluateBoardState(TRIP_CONFIG, null, krStartMs - 1);
  const atKrStartState = evaluateBoardState(TRIP_CONFIG, null, krStartMs);
  assert.equal(justBeforeKrState.phase, 'TOGETHER');
  assert.equal(justBeforeKrState.activeReunion?.activeLeg.countryCode, 'SG');
  assert.equal(atKrStartState.phase, 'TOGETHER');
  assert.equal(atKrStartState.activeReunion?.activeLeg.countryCode, 'KR');

  // Leg 2: South Korea (2027-03-15T12:00:00+09:00)
  const krMs = Date.parse('2027-03-15T12:00:00+09:00');
  const krState = evaluateBoardState(TRIP_CONFIG, null, krMs);
  assert.equal(krState.phase, 'TOGETHER');
  assert.equal(krState.activeReunion?.activeLeg.id, 'leg-south-korea');
  assert.equal(krState.activeReunion?.activeLeg.countryCode, 'KR');
  assert.equal(krState.activeReunion?.legIndex, 1);
  assert.equal(krState.activeReunion?.dayOfLeg, 3);
  assert.equal(krState.activeReunion?.totalLegDays, 7);
  assert.equal(krState.activeReunion?.dayOfReunion, 6);
  assert.equal(krState.activeReunion?.nextLeg?.id, 'leg-japan');
  assert.equal(krState.activeReunion?.daysUntilNextLeg, 5);
  assert.equal(krState.dualStatus.shoval.countryCode, 'KR');
  assert.equal(krState.dualStatus.eitan.countryCode, 'KR');

  // Leg 3: Japan (2027-03-25T12:00:00+09:00)
  const jpMs = Date.parse('2027-03-25T12:00:00+09:00');
  const jpState = evaluateBoardState(TRIP_CONFIG, null, jpMs);
  assert.equal(jpState.phase, 'TOGETHER');
  assert.equal(jpState.activeReunion?.activeLeg.id, 'leg-japan');
  assert.equal(jpState.activeReunion?.activeLeg.countryCode, 'JP');
  assert.equal(jpState.activeReunion?.legIndex, 2);
  assert.equal(jpState.activeReunion?.dayOfLeg, 6);
  assert.equal(jpState.activeReunion?.totalLegDays, 32);
  assert.equal(jpState.activeReunion?.dayOfReunion, 16);
  assert.equal(jpState.activeReunion?.nextLeg, null);
  assert.equal(jpState.activeReunion?.daysUntilNextLeg, null);
  assert.equal(jpState.dualStatus.shoval.countryCode, 'JP');
  assert.equal(jpState.dualStatus.eitan.countryCode, 'JP');
  assert.equal(jpState.soonerMilestone?.id, 'ms-anniversary-15m');
  assert.equal(jpState.soonerMilestone?.date, '2027-04-10');
});

test('LiveState statusOverrides: ignored during reunion if older than leg start, honored if newer', () => {
  const thailandReunionMs = Date.parse('2027-01-02T12:00:00+07:00');

  const staleLiveState = {
    schemaVersion: 1,
    updatedAt: '2026-12-20T10:00:00Z',
    statusOverrides: {
      shoval: {
        countryCode: 'PE',
        cityNote: 'Cusco 🦙',
        updatedAt: '2026-12-20T10:00:00Z'
      }
    }
  };

  const stateWithStaleOverride = evaluateBoardState(TRIP_CONFIG, staleLiveState, thailandReunionMs);
  assert.equal(stateWithStaleOverride.dualStatus.shoval.countryCode, 'TH');
  assert.equal(stateWithStaleOverride.dualStatus.shoval.cityNote, '');
  assert.equal(stateWithStaleOverride.dualStatus.shoval.isAutoSyncedToReunion, true);

  const freshLiveState = {
    schemaVersion: 1,
    updatedAt: '2027-01-01T08:00:00Z',
    statusOverrides: {
      shoval: {
        countryCode: 'TH',
        cityNote: 'Koh Tao 🤿',
        updatedAt: '2027-01-01T08:00:00Z'
      }
    }
  };

  const stateWithFreshOverride = evaluateBoardState(TRIP_CONFIG, freshLiveState, thailandReunionMs);
  assert.equal(stateWithFreshOverride.dualStatus.shoval.countryCode, 'TH');
  assert.equal(stateWithFreshOverride.dualStatus.shoval.cityNote, 'Koh Tao 🤿');
  assert.equal(stateWithFreshOverride.dualStatus.shoval.isAutoSyncedToReunion, false);
});
