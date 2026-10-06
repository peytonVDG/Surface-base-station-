export function temp(celsius: number, unit: 'F' | 'C'): string {
  return `${Math.round(unit === 'F' ? (celsius * 9) / 5 + 32 : celsius)}°`;
}

export function clockParts(d: Date, h24: boolean, seconds = false): { time: string; ampm: string } {
  const h = d.getHours();
  const hh = h24 ? String(h).padStart(2, '0') : String(h % 12 || 12);
  const ss = seconds ? ':' + String(d.getSeconds()).padStart(2, '0') : '';
  return { time: `${hh}:${String(d.getMinutes()).padStart(2, '0')}${ss}`, ampm: h24 ? '' : h < 12 ? 'AM' : 'PM' };
}

/** "6:10 AM" / "06:10" */
export function timeOfDay(d: Date, h24: boolean): string {
  const { time, ampm } = clockParts(d, h24);
  return ampm ? `${time} ${ampm}` : time;
}

/** Hour label for the forecast strip: "5p" / "17". */
export function hourLabel(d: Date, h24: boolean): string {
  const h = d.getHours();
  return h24 ? String(h).padStart(2, '0') : `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`;
}

export function longDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export const CONDITION_LABEL: Record<string, string> = {
  clear: 'Clear',
  partly: 'Partly cloudy',
  cloudy: 'Cloudy',
  fog: 'Foggy',
  rain: 'Rain',
  storm: 'Thunderstorms',
  snow: 'Snow',
};
