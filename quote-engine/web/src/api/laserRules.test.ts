import { describe, expect, it } from 'vitest';
import { CONFIGURATORS, composePartNumber } from './configurators';
import { laserModel } from '../screens/LaserConfigurator';
import { mockApi as api } from './mock';
import { EMPTY_PROFILE } from './types';
import type { ApplicationProfile } from './types';

/**
 * The laser rules, against the machines the configurator actually builds.
 *
 * LSR had four rules and every one of them named the CSL60, so the CSL10, the CSL30
 * and both fibre lasers were ungraded on every application. Eleven more were read off
 * the three spec sheets — and none of them could fire, because a configured laser
 * reported its model as the first three characters of its part number.
 *
 * So these assert the whole path: configure a machine, register it, describe a line,
 * and check that the rule the datasheet supports is the one that speaks. A rule that
 * cannot reach the thing it grades is decoration.
 */

/** Configure a laser the way the screen does, and make it quotable. */
async function configured(confCode: string, choices: Record<string, string> = {}) {
  const conf = CONFIGURATORS.find((c) => c.code === confCode)!;
  const picked = { ...conf.defaults, ...choices };
  const partNo = composePartNumber(conf, picked);
  const model = laserModel(conf, picked);
  await api.addConfiguredItem({
    itemNo: partNo, description: `${conf.name} ${model}`,
    technologyCode: 'LSR', listPrice: 40000, model,
  });
  return { partNo, model };
}

/** Which fit rules speak about this machine for this application. */
async function gradeFor(partNo: string, profile: Partial<ApplicationProfile>) {
  const ev = await api.evaluateDraft({
    technologyCode: 'LSR', customerNo: null, customerName: 'Test Co', lineName: 'L1',
    profile: { ...EMPTY_PROFILE, ...profile },
    noConstraint: [], flags: {}, categoryDiscounts: {},
    lines: [{ itemNo: partNo, quantity: 1 }],
  } as never);
  const fit = ev.fit.find((f) => f.itemNo === partNo);
  return { grade: fit?.grade, codes: (fit?.reasons ?? []).map((r) => r.ruleCode) };
}

describe('the machine a laser configuration is', () => {
  it('is the model the datasheets name, not the part number', () => {
    const csl = CONFIGURATORS.find((c) => c.code === 'CSL')!;
    // The worked example is a 60W tube.
    expect(laserModel(csl, csl.defaults)).toBe('CSL60');
    // 411 is "10W, 10.6mm, IP54 Laser".
    expect(laserModel(csl, { ...csl.defaults, 'Laser/System': '411' })).toBe('CSL10');

    const fsl = CONFIGURATORS.find((c) => c.code === 'FSL')!;
    expect(laserModel(fsl, fsl.defaults)).toBe('FSL20');
  });
});

describe('washdown', () => {
  it('rules out the CSL10, which has no IP65 option', async () => {
    const { partNo } = await configured('CSL', { 'Laser/System': '411' });
    const { grade, codes } = await gradeFor(partNo, { environment: 'washdown' });
    expect(codes).toContain('A-LSR-IP-CSL10');
    expect(grade).toBe('notRecommended');
  });

  it('rules out the fibre lasers, which are IP54', async () => {
    const { partNo } = await configured('FSL');
    const { grade, codes } = await gradeFor(partNo, { environment: 'washdown' });
    expect(codes).toContain('A-LSR-IP-FSL');
    expect(grade).toBe('notRecommended');
  });
});

describe('cold rooms', () => {
  it('stops the fibre laser at its stated 50F floor', async () => {
    const { partNo } = await configured('FSL');
    const { codes } = await gradeFor(partNo, { ambientTempMinF: 45 });
    expect(codes, 'the fibre sheet says 50-104F').toContain('A-LSR-TEMP-FSL-MIN');
  });

  it('lets a scribing laser take the same room, which is rated to 41F', async () => {
    const { partNo } = await configured('CSL');
    const { codes } = await gradeFor(partNo, { ambientTempMinF: 45 });
    expect(codes, '45F is inside 41-104F').not.toContain('A-LSR-TEMP-CSL-MIN');
  });

  it('and stops it below 41F', async () => {
    const { partNo } = await configured('CSL');
    const { codes } = await gradeFor(partNo, { ambientTempMinF: 35 });
    expect(codes).toContain('A-LSR-TEMP-CSL-MIN');
  });
});

describe('what each family marks', () => {
  it('sends corrugated to a scribing laser, not a fibre one', async () => {
    const { partNo } = await configured('FSL');
    const { grade, codes } = await gradeFor(partNo, { substrate: 'corrugated case' });
    expect(codes).toContain('A-LSR-SUB-FSL-PAPER');
    expect(grade).toBe('notRecommended');
  });

  it('endorses the fibre laser on metal', async () => {
    const { partNo } = await configured('FSL');
    const { codes } = await gradeFor(partNo, { substrate: 'anodised aluminium plate' });
    expect(codes).toContain('A-LSR-SUB-FSL');
  });

  it('asks for the 9.3um tube on PET', async () => {
    const { partNo } = await configured('CSL');
    const { codes } = await gradeFor(partNo, { substrate: 'PET bottle' });
    expect(codes).toContain('A-LSR-SUB-CSL-PET');
  });

  it('endorses the 60W tube on glass', async () => {
    const { partNo } = await configured('CSL');
    const { codes } = await gradeFor(partNo, { substrate: 'glass bottle' });
    expect(codes).toContain('A-LSR-PWR-HARD');
  });
});

describe('reach', () => {
  it('stops the fibre laser past its 2.7 m conduit', async () => {
    const { partNo } = await configured('FSL');
    const { codes } = await gradeFor(partNo, { throwDistMm: 4000 });
    expect(codes).toContain('A-LSR-CONDUIT-FSL');
  });
});
