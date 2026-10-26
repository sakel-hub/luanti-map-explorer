import { describe, it, expect } from 'vitest';
import { formatDurationSeconds } from './format.utils';

describe('formatDurationSeconds', () => {
  it('formats zero or negative durations', () => {
    expect(formatDurationSeconds(0)).toBe('0s');
    expect(formatDurationSeconds(-5)).toBe('0s');
    expect(formatDurationSeconds(null)).toBe('0s');
    expect(formatDurationSeconds(undefined)).toBe('0s');
  });

  it('formats seconds under one minute', () => {
    expect(formatDurationSeconds(1)).toBe('1s');
    expect(formatDurationSeconds(45)).toBe('45s');
    expect(formatDurationSeconds(59)).toBe('59s');
    expect(formatDurationSeconds(45.4)).toBe('45s');
    expect(formatDurationSeconds(45.6)).toBe('46s');
  });

  it('formats minutes and seconds under one hour', () => {
    expect(formatDurationSeconds(60)).toBe('1m');
    expect(formatDurationSeconds(65)).toBe('1m 5s');
    expect(formatDurationSeconds(125)).toBe('2m 5s');
    expect(formatDurationSeconds(3599)).toBe('59m 59s');
  });

  it('formats hours and minutes for durations of an hour or more', () => {
    expect(formatDurationSeconds(3600)).toBe('1h');
    expect(formatDurationSeconds(3660)).toBe('1h 1m');
    expect(formatDurationSeconds(7200)).toBe('2h');
    expect(formatDurationSeconds(7320)).toBe('2h 2m');
    // User examples:
    // 12000s = 3h 20m
    expect(formatDurationSeconds(12000)).toBe('3h 20m');
    // 14632s = 4h 3m
    expect(formatDurationSeconds(14632)).toBe('4h 3m');
  });
});
