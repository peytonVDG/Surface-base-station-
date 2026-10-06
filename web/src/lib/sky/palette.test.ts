import { describe, expect, it } from 'vitest';
import { heaviness, phaseFor, skyColours } from './palette';

describe('skyColours', () => {
  it('uses the end keyframes outside their range', () => {
    expect(skyColours(-40, true, 0, 'clear').stops[0]).toBe('rgb(6,10,29)');
    expect(skyColours(60, false, 0, 'clear').stops[0]).toBe('rgb(58,139,214)');
  });

  it('blends between keyframes', () => {
    // Halfway between -18 and -10 on the top stop: #060a1d -> #0a1130.
    expect(skyColours(-14, true, 0, 'clear').stops[0]).toBe('rgb(8,14,39)');
  });

  it('goes grey under overcast', () => {
    const clear = skyColours(30, true, 0, 'clear').stops[0];
    const rain = skyColours(30, true, 100, 'rain').stops[0];
    expect(rain).not.toBe(clear);
    expect(heaviness(100, 'rain')).toBeGreaterThan(heaviness(20, 'partly'));
  });
});

describe('phaseFor', () => {
  it('names the coarse phase', () => {
    expect(phaseFor(-12, true)).toBe('night');
    expect(phaseFor(0, true)).toBe('dawn');
    expect(phaseFor(0, false)).toBe('dusk');
    expect(phaseFor(30, false)).toBe('day');
  });
});
