import { describe, expect, it } from 'vitest';
import { conditionFor } from './demo';

describe('conditionFor', () => {
  it('matches the backend mapping', () => {
    expect([0, 2, 3, 45, 63, 81, 75, 95].map(conditionFor)).toEqual(['clear', 'partly', 'cloudy', 'fog', 'rain', 'rain', 'snow', 'storm']);
  });
});
