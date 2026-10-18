import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createLicensePlateItem,
  createRandomLicensePlate,
  getEquippedLicensePlateFrameIds,
  getLicensePlateRarityReason,
  getLicensePlateValuation,
  getSellableLicensePlates,
  grantLicensePlateFrame,
  LICENSE_PLATE_CHANCES,
  LICENSE_PLATE_RARITY_MULTIPLIERS,
} from './licensePlates';
import { STARTING_PLAYER } from './player';
import { applyLocalAction } from './localActions';

afterEach(() => vi.restoreAllMocks());

describe('license plate drop chances', () => {
  it('allocates the configured probability to each plate tier', () => {
    expect(LICENSE_PLATE_CHANCES).toEqual({
      ordinary: 58,
      patterned: 25,
      knownSeries: 12,
      amr97: 3,
      legendary: 1,
      secret: 1,
    });
    expect(Object.values(LICENSE_PLATE_CHANCES).reduce((sum, chance) => sum + chance, 0)).toBe(100);
  });

  it('generates the explicit legendary combination in its one-percent range', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.015);

    expect(createRandomLicensePlate()).toBe('Х777ХХ 77');
    expect(getLicensePlateValuation('Х777ХХ77')).toMatchObject({ rarity: 'legendary', multiplier: 30, price: 150_000 });
    expect(getLicensePlateValuation('X777XX77').rarity).toBe('legendary');
  });

  it('generates a named secret plate in its one-percent range', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValue(0.4);

    const plate = createRandomLicensePlate();
    expect(plate).toBe('А777АА 97');
    expect(getLicensePlateValuation(plate)).toMatchObject({ rarity: 'secret', specialTitle: 'ЛУДОМАН', multiplier: 250, price: 1_250_000 });
  });

  it('classifies each secret plate title independently', () => {
    expect(getLicensePlateValuation('В777ВВ77')).toMatchObject({ rarity: 'secret', specialTitle: 'BIG BOSS' });
    expect(getLicensePlateValuation('М999ММ99')).toMatchObject({ rarity: 'secret', specialTitle: 'ЛЕГЕНДА' });
  });

  it('keeps AMR 97 in its three-percent range and prices it as mythic', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.025).mockReturnValue(0.4);

    const valuation = getLicensePlateValuation(createRandomLicensePlate());
    expect(valuation.specialAmr97).toBe(true);
    expect(valuation.rarity).toBe('mythic');
    expect(valuation.multiplier).toBe(LICENSE_PLATE_RARITY_MULTIPLIERS.mythic);
  });

  it('generates patterned digits in their twenty-five-percent range', () => {
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

  it('classifies an unpatterned ordinary plate as common', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.2)
      .mockReturnValueOnce(0.4)
      .mockReturnValue(0.99);

    const valuation = getLicensePlateValuation(createRandomLicensePlate());
    expect(valuation.rarity).toBe('common');
    expect(valuation.multiplier).toBe(1);
  });
});

describe('season license plate frame ownership and selection', () => {
  it('adds and equips the first frame reward automatically', () => {
    const frameState = grantLicensePlateFrame([], undefined, 'season-01-vip');

    expect(frameState).toEqual({
      licensePlateFrames: ['season-01-vip'],
      equippedLicensePlateFrameId: 'season-01-vip',
    });
    expect(getEquippedLicensePlateFrameIds(frameState)).toEqual(['season-01-vip']);
  });

  it('preserves an explicit unequipped state and supports selecting an owned frame', () => {
    const frameState = grantLicensePlateFrame(['season-01-vip'], null, 'season-02-gold');
    expect(frameState.licensePlateFrames).toEqual(['season-01-vip', 'season-02-gold']);
    expect(frameState.equippedLicensePlateFrameId).toBeNull();
    expect(getEquippedLicensePlateFrameIds(frameState)).toEqual([]);
    expect(getEquippedLicensePlateFrameIds({
      licensePlateFrames: frameState.licensePlateFrames,
      equippedLicensePlateFrameId: 'season-02-gold',
    })).toEqual(['season-02-gold']);
  });

  it('uses the first owned frame for legacy saves without an explicit selection', () => {
    expect(getEquippedLicensePlateFrameIds({ licensePlateFrames: ['season-01-vip'] })).toEqual(['season-01-vip']);
    expect(getEquippedLicensePlateFrameIds({ licensePlateFrames: ['season-01-vip'], equippedLicensePlateFrameId: null })).toEqual([]);
  });

  it('allows equipping and removing an owned frame through player actions', () => {
    const user = { id: 'test-player', firstName: 'Tester' };
    const withFrame = { ...STARTING_PLAYER, licensePlateFrames: ['season-01-vip'] };
    const equipped = applyLocalAction(withFrame, {
      type: 'equip-license-plate-frame', frameId: 'season-01-vip', requestId: 'equip-frame',
    }, user).snapshot.player;
    expect(equipped.equippedLicensePlateFrameId).toBe('season-01-vip');

    const removed = applyLocalAction(equipped, {
      type: 'equip-license-plate-frame', frameId: null, requestId: 'remove-frame',
    }, user).snapshot.player;
    expect(removed.licensePlateFrames).toEqual(['season-01-vip']);
    expect(removed.equippedLicensePlateFrameId).toBeNull();
    expect(getEquippedLicensePlateFrameIds(removed)).toEqual([]);
  });

  it('rejects equipping a frame the player has not earned', () => {
    expect(() => applyLocalAction(STARTING_PLAYER, {
      type: 'equip-license-plate-frame', frameId: 'season-01-vip', requestId: 'unowned-frame',
    }, { id: 'test-player', firstName: 'Tester' })).toThrow('Эта рамка ещё не получена');
  });
});

describe('bulk license plate sale filtering', () => {
  it('selects only free plates matching the chosen rarity', () => {
    const common = createLicensePlateItem('А246ВС 25', 'common');
    const legendary = createLicensePlateItem('Х777ХХ 77', 'legendary');
    const secret = createLicensePlateItem('В777ВВ 77', 'secret');
    const plates = [common, legendary, secret];
    const installed = new Set([legendary.id]);

    expect(getSellableLicensePlates(plates, installed, 'common').map((plate) => plate.id)).toEqual(['common']);
    expect(getSellableLicensePlates(plates, installed, 'all').map((plate) => plate.id)).toEqual(['common', 'secret']);
    expect(getSellableLicensePlates(plates, installed, 'legendary')).toEqual([]);
  });
});


describe('license plate rarity scoring', () => {
  it('raises multiplier as rarity increases', () => {
    const values = Object.values(LICENSE_PLATE_RARITY_MULTIPLIERS);
    expect(values).toEqual([1, 2, 5, 12, 30, 75, 250]);
    expect(values.every((value, index) => index === 0 || value > values[index - 1])).toBe(true);
  });

  it('explains the detected number pattern for Cyrillic and Latin plates', () => {
    expect(getLicensePlateRarityReason('Х777ХХ77')).toContain('специальная сигнатурная легендарная комбинация');
    expect(getLicensePlateRarityReason('A777AA77')).toContain('Три одинаковые цифры, три одинаковые буквы');
    expect(getLicensePlateRarityReason('А123ВС 25')).toContain('Цифры образуют повтор');
  });
});

it('excludes favorite plates from bulk-sale candidates', () => {
  const favorite = createLicensePlateItem('А246ВС 25', 'favorite');
  const available = createLicensePlateItem('А135ВС 25', 'available');

  expect(getSellableLicensePlates([favorite, available], new Set(), 'all', new Set([favorite.id]))).toEqual([available]);
});
