import { describe, it, expect } from 'vitest';
import { formatClock } from './formatClock';

describe('formatClock', () => {
  it('formats morning hour', () => {
    expect(formatClock(1, 8, false)).toBe('1일차 ☀️ 오전 8시');
  });
  it('floors fractional hours', () => {
    expect(formatClock(1, 8.9, false)).toBe('1일차 ☀️ 오전 8시');
  });
  it('midnight is 오전 12시', () => {
    expect(formatClock(2, 0, true)).toBe('2일차 🌙 오전 12시');
  });
  it('noon is 오후 12시', () => {
    expect(formatClock(1, 12, false)).toBe('1일차 ☀️ 오후 12시');
  });
  it('afternoon hour', () => {
    expect(formatClock(1, 13, false)).toBe('1일차 ☀️ 오후 1시');
  });
  it('night evening hour', () => {
    expect(formatClock(3, 20.5, true)).toBe('3일차 🌙 오후 8시');
  });
});
