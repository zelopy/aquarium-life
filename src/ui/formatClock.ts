/** "1일차 ☀️ 오전 8시" 형태의 시계 문자열. 시간은 내림한다. */
export function formatClock(day: number, hour: number, isNight: boolean): string {
  const h = Math.floor(hour) % 24;
  const period = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const icon = isNight ? '🌙' : '☀️';
  return `${day}일차 ${icon} ${period} ${h12}시`;
}
