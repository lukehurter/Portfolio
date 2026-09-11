import { describe, expect, it } from 'vitest';
import { BLOCK_END, BLOCK_START, SECTIONS, buildQuestionnaire, parseQuestionnaire } from './questionnaire';
import { EMPTY_PROFILE } from './types';

/**
 * The round trip has to survive email.
 *
 * A questionnaire is only worth sending if what comes back can be read, and what comes back
 * has been through at least one mail client and often three. It arrives quoted with `>`,
 * re-wrapped, with smart quotes substituted, with the customer's own paragraph above it and
 * their signature below.
 *
 * So the parser is tested against mangled input rather than against what the generator
 * emits. A test that only feeds the writer's output to the reader proves the two agree with
 * each other and nothing about whether either survives contact with Outlook.
 */

const answers = (lines: string[]) => [BLOCK_START, ...lines, BLOCK_END].join('\n');

describe('the questionnaire', () => {
  it('asks about fields the profile actually has', () => {
    // A question keyed to a field that no longer exists is a question whose answer is
    // silently dropped on import — the worst failure available here, because the customer
    // answered it and nobody finds out it went nowhere.
    const known = new Set(Object.keys(EMPTY_PROFILE));
    const asked = SECTIONS.flatMap((s) => s.questions).map((q) => q.key);
    expect(asked.filter((k) => !known.has(k))).toEqual([]);
  });

  it('asks in the customer’s words, never in field names', () => {
    for (const q of SECTIONS.flatMap((s) => s.questions)) {
      expect(q.ask, `${q.key} is asked as a field name`).not.toMatch(/[a-z][A-Z]|_/);
      expect(q.ask.length, `${q.key} has no real question`).toBeGreaterThan(8);
    }
  });

  it('builds one self-contained file, with nothing to fetch', () => {
    const html = buildQuestionnaire({ customerName: 'Midwest Foods', lineName: 'Line 3' });
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain('Midwest Foods');
    // Opened from an email attachment on a plant PC with no internet. Anything remote is
    // a form that renders as unstyled text on the one occasion it matters.
    expect(html).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
    expect(html).not.toMatch(/<link[^>]+stylesheet/i);
    expect(html).not.toMatch(/<script[^>]+src=/i);
  });
});

describe('reading a reply', () => {
  it('reads the answers a customer sent', () => {
    const r = parseQuestionnaire(answers([
      'quote = Q-2026-0731',
      'substrate = corrugated case',
      'lineSpeedFpm = 300',
      'porosity = porous',
      'linesOfPrint = 2',
    ]));
    expect(r.quoteNo).toBe('Q-2026-0731');
    expect(r.profile.substrate).toBe('corrugated case');
    expect(r.profile.lineSpeedFpm).toBe(300);
    expect(r.profile.porosity).toBe('porous');
    expect(r.found).toContain('linesOfPrint');
  });

  it('survives a quoted reply with prose around it', () => {
    const mail = [
      'Hi Dana,',
      '',
      'Answers below. The speed varies a bit, 250 to 300 depending on the product.',
      '',
      '> ' + BLOCK_START,
      '>  substrate = HDPE bottle',
      '>  lineSpeedFpm = 300',
      '> ' + BLOCK_END,
      '',
      'Thanks,',
      'Ray',
    ].join('\n');
    const r = parseQuestionnaire(mail);
    expect(r.profile.substrate).toBe('HDPE bottle');
    expect(r.profile.lineSpeedFpm).toBe(300);
  });

  it('takes the number when a customer edits one by hand', () => {
    // They will. The block says "do not edit" and somebody always does, usually to add
    // the unit back or a comma.
    const r = parseQuestionnaire(answers([
      'lineSpeedFpm = 1,200 fpm',
      'charHeightMm = about 6',
    ]));
    expect(r.profile.lineSpeedFpm).toBe(1200);
    expect(r.profile.charHeightMm).toBe(6);
  });

  it('reports nothing when there is no block, rather than guessing', () => {
    // Prose belongs to the keyword parser. This one claiming a partial read would let a
    // guess be presented as the customer's own figure, which is the distinction the whole
    // feature exists to make.
    const r = parseQuestionnaire('We run corrugated at about 300 a minute, two shifts.');
    expect(r.found).toEqual([]);
    expect(r.profile).toEqual({});
  });

  it('leaves a blank answer absent, so importing never wipes what the rep knows', () => {
    const r = parseQuestionnaire(answers([
      'substrate = corrugated case',
      'lineSpeedFpm = ',
    ]));
    expect(r.profile.substrate).toBe('corrugated case');
    expect('lineSpeedFpm' in r.profile).toBe(false);
  });

  it('ignores a key it does not recognise', () => {
    const r = parseQuestionnaire(answers([
      'substrate = glass jar',
      'favouriteColour = blue',
      'DROP TABLE quotes = 1',
    ]));
    expect(r.found).toEqual(['substrate']);
  });
});
