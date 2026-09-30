import {
  getTimezoneOffsetMinutes,
  getLocalDateKey,
  getUtcRangeForLocalDate,
  getPreviousLocalDateKey,
} from './timezoneHelper'

describe('timezoneHelper (Phase 6)', () => {
  describe('getTimezoneOffsetMinutes', () => {
    it('returns 0 for UTC', () => {
      expect(getTimezoneOffsetMinutes('UTC', new Date('2026-06-15T12:00:00.000Z'))).toBe(0)
    })

    it('returns +840 for a fixed UTC+14 zone (Pacific/Kiritimati, no DST)', () => {
      expect(getTimezoneOffsetMinutes('Pacific/Kiritimati', new Date('2026-06-15T12:00:00.000Z'))).toBe(14 * 60)
    })

    it('returns a negative offset for a zone behind UTC (US Eastern, winter/no-DST reference)', () => {
      // Jan 15 is outside US DST, so Eastern is a fixed UTC-5 here.
      expect(getTimezoneOffsetMinutes('America/New_York', new Date('2026-01-15T12:00:00.000Z'))).toBe(-5 * 60)
    })
  })

  describe('getLocalDateKey', () => {
    it('matches the UTC date for a UTC-based check', () => {
      expect(getLocalDateKey('UTC', new Date('2026-03-05T15:00:00.000Z'))).toBe('2026-03-05')
    })

    it('rolls over to the next local day for a far-ahead timezone', () => {
      // 2026-01-10T23:00Z + 14h = 2026-01-11T13:00 local.
      expect(getLocalDateKey('Pacific/Kiritimati', new Date('2026-01-10T23:00:00.000Z'))).toBe('2026-01-11')
    })

    it('stays on the previous local day for a far-behind timezone', () => {
      // 2026-01-10T02:00Z - 11h = 2026-01-09T15:00 local (Pacific/Niue, UTC-11).
      expect(getLocalDateKey('Pacific/Niue', new Date('2026-01-10T02:00:00.000Z'))).toBe('2026-01-09')
    })
  })

  describe('getUtcRangeForLocalDate', () => {
    it('produces [00:00Z, 24:00Z) for UTC', () => {
      const { start, end } = getUtcRangeForLocalDate('UTC', '2026-03-05')
      expect(start.toISOString()).toBe('2026-03-05T00:00:00.000Z')
      expect(end.toISOString()).toBe('2026-03-06T00:00:00.000Z')
    })

    it('produces a range shifted by the timezone offset for a non-UTC zone', () => {
      // Local midnight 2026-01-11 in UTC+14 is UTC 2026-01-10T10:00:00Z.
      const { start, end } = getUtcRangeForLocalDate('Pacific/Kiritimati', '2026-01-11')
      expect(start.toISOString()).toBe('2026-01-10T10:00:00.000Z')
      expect(end.toISOString()).toBe('2026-01-11T10:00:00.000Z')
    })

    it('is a contiguous 24-hour range', () => {
      const { start, end } = getUtcRangeForLocalDate('America/New_York', '2026-01-15')
      expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000)
    })
  })

  describe('getPreviousLocalDateKey', () => {
    it('returns yesterday for a UTC reference near the start of today', () => {
      expect(getPreviousLocalDateKey('UTC', new Date('2026-03-05T00:30:00.000Z'))).toBe('2026-03-04')
    })

    it('returns yesterday for a UTC reference near the end of today', () => {
      expect(getPreviousLocalDateKey('UTC', new Date('2026-03-05T23:30:00.000Z'))).toBe('2026-03-04')
    })

    it('correctly resolves "yesterday" for a far-ahead timezone even when the UTC date disagrees', () => {
      // At this UTC instant it's still 2026-01-10 in UTC, but already
      // 2026-01-11 local in Kiritimati (UTC+14) — "yesterday" there is
      // 2026-01-10, matching the UTC date only by coincidence of the offset
      // chosen; the point is the function reasons in local time, not UTC.
      expect(getPreviousLocalDateKey('Pacific/Kiritimati', new Date('2026-01-10T23:00:00.000Z'))).toBe('2026-01-10')
    })
  })
})
