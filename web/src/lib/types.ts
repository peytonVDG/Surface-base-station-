// Mirrors server/kitchen/models.py and settings.py. Dates arrive as ISO strings.

export type Status = 'live' | 'stale' | 'sample';
export type Condition = 'clear' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'storm' | 'snow';

export interface Weather {
  status: Status;
  updated_at: string;
  location_name: string;
  current: {
    temp_c: number;
    condition: Condition;
    code: number;
    cloud_cover: number;
    precip_mm: number;
    wind_kph: number;
    is_day: boolean;
  };
  today: { high_c: number; low_c: number; sunrise: string | null; sunset: string | null };
  hourly: { time: string; temp_c: number; condition: Condition; precip_prob: number | null }[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  all_day: boolean;
  color: string;
  location: string;
}

export interface Calendar {
  status: Status;
  events: CalendarEvent[];
}

export interface Todo {
  id: string;
  title: string;
  due: string | null;
  overdue: boolean;
  done: boolean;
}

export interface Todos {
  status: Status;
  items: Todo[];
}

export interface Brief {
  status: Status;
  url: string;
  updated_at: string | null;
}

export interface ClientConfig {
  latitude: number | null;
  longitude: number | null;
  location_name: string;
  hardware_backlight: boolean;
}

export interface Schedule {
  weekday_wake: string;
  leave_for_work: string;
  back_from_work: string;
  sleep_at: string;
  weekend_wake: string;
  workdays: number[];
  sleep_during_work: boolean;
  nap_minutes: number;
}

export interface Settings {
  brightness: number;
  animations: 'full' | 'calm' | 'off';
  look: 'auto' | 'day' | 'night';
  clock_24h: boolean;
  show_seconds: boolean;
  temp_unit: 'F' | 'C';
  leave_warn_minutes: number;
  countdown_ring: boolean;
  hold_clock_for_settings: boolean;
  volume: number;
  mic_muted: boolean;
  schedule: Schedule;
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K] };

export interface Connections {
  todoist: { connected: boolean };
  google: { connected: boolean; ready: boolean };
}
