import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createRandomLicensePlate,
  getLicensePlateValuation,
  LICENSE_PLATE_CHANCES,
} from './licensePlates';

afterEach(() => vi.restoreAllMocks());

describe('license plate drop chances', () => {
  it('allocates the configured probability to each plate tier', () => {
    expect(LICENSE_PLATE_CHANCES).toEqual({
      ordinary: 60,
      patterned: 25,
      knownSeries: 12,
      amr97: 3,
    });
    expect(Object.values(LICENSE_PLATE_CHANCES).reduce((sum, chance) => sum + chance, 0)).toBe(100);
  });

  it('generates a special AMR 97 plate in its three-percent range', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValue(0.4);

    expect(getLicensePlateValuation(createRandomLicensePlate()).specialAmr97).toBe(true);
  });

  it('generates patterned digits in its twenty-five-percent range', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.2).mockReturnValue(0);

    const valuation = getLicensePlateValuation(createRandomLicensePlate());
    expect(valuation.digitsMultiplier).toBe(3);
    expect(valuation.seriesInfo).toBeUndefined();
  });

  it('generates a listed series in its twelve-percent range', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValue(0.4);

    const valuation = getLicensePlateValuation(createRandomLicensePlate());
    expect(valuation.seriesInfo).toBeDefined();
    expect(valuation.specialAmr97).toBe(false);
  });

  it('keeps ordinary plates outside the special tiers', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.5).mockReturnValue(0.4);

    const valuation = getLicensePlateValuation(createRandomLicensePlate());
    expect(valuation.digitsMultiplier).toBe(1);
    expect(valuation.seriesInfo).toBeUndefined();
  });
});
