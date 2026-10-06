import { getMoonIllumination, getMoonPosition, getPosition } from 'suncalc';

export interface Astro {
  sunAlt: number;
  sunAz: number;
  /** True before solar noon: picks the dawn rather than dusk palette. */
  rising: boolean;
  moonAlt: number;
  moonAz: number;
  moonFraction: number;
  moonWaxing: boolean;
}

export interface Place {
  lat: number;
  lon: number;
}

/**
 * Without a configured location, guess one from the browser's time zone (15° of
 * longitude per hour) at a mid-US latitude. Dawn and dusk land within the
 * hour, which is fine until the real location is set in config.toml.
 */
export function guessPlace(now = new Date()): Place {
  return { lat: 40, lon: -now.getTimezoneOffset() / 4 };
}

export function astroAt(now: Date, place: Place): Astro {
  const sun = getPosition(now, place.lat, place.lon);
  const moon = getMoonPosition(now, place.lat, place.lon);
  const illum = getMoonIllumination(now);
  return {
    sunAlt: sun.altitude,
    // Azimuth is clockwise from north: the sun is in the east (< 180°) before noon.
    sunAz: sun.azimuth,
    rising: sun.azimuth < 180,
    moonAlt: moon.altitude,
    moonAz: moon.azimuth,
    moonFraction: illum.fraction,
    moonWaxing: illum.waxing,
  };
}
