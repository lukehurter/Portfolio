import { describe, expect, it } from 'vitest';
import { mockApi } from './mock';
import { EMPTY_PROFILE } from './types';
import { CATALOG } from './catalog';
import { APPLICATION_RULES } from './appRules';

/**
 * An item that says it needs another item has to say so on the quote too.
 *
 * REPORTED: "I added some items onto a quote that said they required another item in the
 * description but I don't see the item in the catalogue and it never gave a warning
 * about it either."
 *
 * Thirteen catalogue rows state a requirement in their own description — MUST INCLUDE
 * L6127757, Requires 9592660, Requires I/O Board 5760-392 — and there were no `require`
 * actions anywhere in the rule set. Both engines implement the action and the one-click
 * fix that goes with it; the mechanism had simply never been given any data, so the
 * sentence sat in the description where only a rep who read it and knew what it meant
 * would act on it.
 *
 * This re-derives the list from the descriptions rather than restating it, so a price
 * page that adds another "MUST INCLUDE" row fails here instead of going unnoticed.
 * See data/catalogue-requirements.md.
 */

/** The words a description uses when it is telling you to order something else. */
const STATES_A_REQUIREMENT =
  /must include|must be ordered|must order|requires?\b|required\b|order with|needs?\b/i;

/**
 * Rows that state a requirement and correctly have no rule.
 *
 * One entry, and it earns it: L6127757's description ends "(MUST INCLUDE)" with nothing
 * after it. It is the other side of the four extractor rows that name it — they require
 * it, and a hose kit quoted on its own is a spare.
 */
const NO_RULE_NEEDED = new Set(['L6127757']);

const ruleFor = (itemNo: string) =>
  APPLICATION_RULES.filter((r) => r.triggers.some(
    (t) => t.triggerType === 'item' && t.itemNo === itemNo));

describe('what an item description says it needs', () => {
  const stated = CATALOG.filter((i) => STATES_A_REQUIREMENT.test(i.description));

  it('finds the rows that state one', () => {
    // If this drops to nothing the regex has stopped matching and every assertion
    // below would pass by testing an empty list.
    expect(stated.length).toBeGreaterThanOrEqual(13);
  });

  it('has a rule for every one of them', () => {
    const silent = stated
      .filter((i) => !NO_RULE_NEEDED.has(i.itemNo) && ruleFor(i.itemNo).length === 0)
      .map((i) => `${i.itemNo} — ${i.description}`);
    expect(silent, 'these say they need something and nothing tells the rep so')
      .toEqual([]);
  });

  it('requires parts that actually exist', () => {
    /* A rule naming a part number that is not in the catalogue is worse than no rule:
       it produces a fix button that cannot add anything, and it tells the rep to go
       and find something that is not there. */
    const known = new Set(CATALOG.map((i) => i.itemNo));
    const dangling: string[] = [];
    for (const r of APPLICATION_RULES) {
      for (const a of r.actions) {
        if (a.actionType === 'require' && a.itemNo && !known.has(a.itemNo)) {
          dangling.push(`${r.ruleCode} requires ${a.itemNo}`);
        }
      }
    }
    expect(dangling).toEqual([]);
  });

  it('hands over the part number that will actually find it', () => {
    /* 1334426's description writes the I/O board as 5760-392 and the catalogue row is
       5760392. Searching for what the description says returns nothing, which is the
       half of the report that was about the catalogue rather than the warning. */
    const rule = ruleFor('1334426')[0];
    expect(rule, 'the alarm tower has no rule').toBeTruthy();
    const req = rule.actions.find((a) => a.actionType === 'require');
    expect(req?.itemNo).toBe('6870691');
    expect(CATALOG.some((i) => i.itemNo === '6870691')).toBe(true);
  });

  it('says so when the part it needs is on another book', () => {
    /* searchItems filters to the quote's technology plus ALL, so a required part filed
       elsewhere cannot be found by searching at all. The require action carries it, and
       the message says why looking for it will not work. */
    const cross: [string, string][] = [
      ['1334426', '6870691'],      // VIJ tower  -> PIJ board
      ['6727262', '9592660'],      // PIJ bracket -> VIJ kit
      ['5334300', '9592660'],
    ];
    for (const [item, needs] of cross) {
      const owner = CATALOG.find((i) => i.itemNo === item)!;
      const target = CATALOG.find((i) => i.itemNo === needs)!;
      expect(owner.technologyCode, `${item} moved book`).not.toBe(target.technologyCode);

      const action = ruleFor(item)
        .flatMap((r) => r.actions)
        .find((a) => a.actionType === 'require' && a.itemNo === needs);
      expect(action, `${item} does not require ${needs}`).toBeTruthy();
      expect(action?.message ?? '',
        `${item} requires a part from another book and does not say so`)
        .toMatch(new RegExp(target.technologyCode ?? '', 'i'));
    }
  });

  /* The whole point, end to end: put the item on a quote and see the warning the
     report said never came. */
  it('warns on a real quote, and hands over the part', async () => {
    const ev = await mockApi.evaluateDraft({
      technologyCode: 'VIJ', customerNo: null, customerName: 'Alarm Co',
      lineName: 'Line 1', profile: { ...EMPTY_PROFILE }, noConstraint: [],
      flags: {}, categoryDiscounts: {},
      lines: [{ itemNo: '1334426', quantity: 1 }],
    } as never);

    const entry = ev.trace.find((t) => t.ruleCode === 'R-REQ-ALARM-IO-BOARD');
    expect(entry, 'the alarm tower produced no trace entry').toBeTruthy();
    expect(entry!.status).toBe('action');
    // The fix carries the part, so the rep never has to search for it.
    expect(entry!.fix?.[0]?.itemNo).toBe('6870691');
    expect(entry!.headline).toMatch(/6870691|I\/O Board/i);
  });

  it('goes quiet once the required part is on the quote', async () => {
    const ev = await mockApi.evaluateDraft({
      technologyCode: 'VIJ', customerNo: null, customerName: 'Alarm Co',
      lineName: 'Line 1', profile: { ...EMPTY_PROFILE }, noConstraint: [],
      flags: {}, categoryDiscounts: {},
      lines: [{ itemNo: '1334426', quantity: 1 }, { itemNo: '6870691', quantity: 1 }],
    } as never);
    const entry = ev.trace.find((t) => t.ruleCode === 'R-REQ-ALARM-IO-BOARD');
    expect(entry?.status, 'still asking for a part that is on the quote')
      .toBe('satisfied');
  });
});
