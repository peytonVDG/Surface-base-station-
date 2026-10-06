import type { IconName } from '../components/Icon.svelte';
import type { Condition } from './types';

export function weatherIcon(c: Condition, night: boolean): IconName {
  switch (c) {
    case 'clear':
      return night ? 'moon' : 'sun';
    case 'partly':
      return night ? 'partlyNight' : 'partly';
    case 'cloudy':
      return 'cloud';
    default:
      return c;
  }
}
