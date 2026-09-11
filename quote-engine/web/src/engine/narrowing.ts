import type { ApplicationProfile, Item, Rule, RuleAction } from '../api/types';

/**
 * What the application rules out before anything is graded.
 *
 * ASKED: "Do the rules drive the application fit logic or is there a hidden layer in
 * code?" Grading was always entirely rule-driven — gradeFit reads only
 * `applicationFit` rules and acts only on `grade` actions, and every grade a rep sees
 * carries the rule code, author and citation that produced it.
 *
 * This was the hidden layer. It lived in `narrowFromProfile` in the mock API, it
 * removed candidates before any rule saw them, and it said nothing: a machine the
 * application ruled out was simply absent. On a porous, black-ink enquiry that was
 * 284 of 947 CIJ printer configurations and half the VIJ book.
 *
 * It is driven by rules now — see data/narrowing-rules.json and the judgement they
 * cite in data/application-narrowing.md — and it reports what each rule took, so the
 * screen can say so and offer to show it.
 *
 * It still narrows rather than grades. Grading 284 ruled-out rows would put back the
 * noise the narrowing exists to remove, and would re-break the counts that "VIJ says
 * 8 good when there's only 4" was reported about.
 */

/** What one narrowing rule did, so a screen can say it out loud. */
export interface NarrowingApplied {
  ruleCode: string;
  summary: string;
  detail: string | null;
  sourceRef: string | null;
  author: string | null;
  /** The attribute it narrowed on — Surface, Color. */
  attribute: string;
  /** The values it kept. Empty when the book states the fact only in words. */
  kept: string[];
  /** The word the application supplied: 'porous', 'black'. For the message. */
  matched: string;
  /** How many candidates it removed, filled in by the caller that counts. */
  removed?: number;
}

export interface Narrowing {
  /** attribute -> the values still allowed. Passed to suggest(). */
  narrow: Record<string, string[]>;
  /** Description patterns to deny, for the roles that name the fact in words. */
  deny?: { roles: string[]; patterns: string[] };
  /** One entry per rule that engaged. */
  applied: NarrowingApplied[];
}

/**
 * The colours a matcher knows, in the order a rule lists them.
 *
 * By word rather than by substring throughout: "black ink" names black,
 * "blackcurrant juice" does not, and "Black Thermo" is a black ink.
 */
function colourNamed(text: string, words: string[]): string | null {
  const low = text.toLowerCase();
  return words.find((c) => new RegExp(`\\b${c}\\b`).test(low)) ?? null;
}

/** Grey and gray are one colour spelt two ways; asking for one never denies the other. */
function sameColour(a: string, b: string): boolean {
  const norm = (c: string) => (c === 'gray' ? 'grey' : c);
  return norm(a) === norm(b);
}

function engages(rule: Rule, profile: ApplicationProfile): string | null {
  for (const t of rule.triggers) {
    if (t.triggerType !== 'profile' || !t.profileField) return null;
    const raw = (profile as unknown as Record<string, unknown>)[t.profileField];
    const value = raw == null ? '' : String(raw);
    const allowed = (t.compareValue ?? '').split(',').map((v) => v.trim()).filter(Boolean);
    if (t.compareOp === 'matchesColour') {
      const hit = colourNamed(value, allowed);
      if (!hit) return null;
      return hit;
    }
    if (t.compareOp === 'in') {
      if (!allowed.includes(value)) return null;
      return value;
    }
    // A narrowing rule with a trigger nobody implemented must not narrow silently.
    return null;
  }
  return null;
}

/**
 * Apply the narrowing rules to a profile.
 *
 * `items` is the whole catalogue: the values a rule keeps are read off the book
 * rather than written down, so a book that has never carried a Surface attribute is
 * narrowed on words alone instead of being emptied.
 */
export function narrowingFor(
  profile: ApplicationProfile | undefined,
  items: Item[],
  technologyCode: string,
  rules: Rule[],
): Narrowing {
  const narrow: Record<string, string[]> = {};
  const patterns: string[] = [];
  const applied: NarrowingApplied[] = [];
  const roles = new Set<string>();
  if (!profile) return { narrow, applied };

  const valuesOf = (name: string) => [...new Set(
    items.filter((i) => i.technologyCode === technologyCode)
      .map((i) => i.attributes[name]).filter(Boolean) as string[])];

  for (const rule of rules) {
    if (rule.ruleType !== 'narrowing' || !rule.isActive) continue;
    if (rule.technologyCode && rule.technologyCode !== technologyCode) continue;
    const matched = engages(rule, profile);
    if (matched == null) continue;

    for (const action of rule.actions as RuleAction[]) {
      if (action.actionType !== 'narrow' || !action.attribute) continue;
      const attribute = action.attribute;
      let kept: string[] = [];
      const mine: string[] = [];

      if (action.matcher === 'porosity') {
        // Exact on the attribute. "Non-porous" contains the word "porous", so
        // anything looser keeps precisely the inks the application rules out.
        const want = matched === 'porous' ? 'porous' : 'non-porous';
        kept = valuesOf(attribute).filter((v) => v.toLowerCase() === want);
        // In descriptions the lookbehind is the whole point.
        mine.push(matched === 'porous'
          ? String.raw`\bnon-?porous\b`
          : String.raw`(?<!non-)(?<!non)\bporous\b`);
      } else if (action.matcher === 'inkColour') {
        const words = (rule.triggers[0]?.compareValue ?? '')
          .split(',').map((v) => v.trim()).filter(Boolean);
        kept = valuesOf(attribute)
          .filter((v) => new RegExp(`\\b${matched}\\b`, 'i').test(v));
        for (const other of words) {
          if (sameColour(other, matched)) continue;
          mine.push(String.raw`\b` + other + String.raw`\b`);
        }
      } else {
        continue;
      }

      if (kept.length) narrow[attribute] = kept;
      patterns.push(...mine);
      for (const r of (action.denyRoles ?? '').split(',').map((v) => v.trim())) {
        if (r) roles.add(r);
      }
      applied.push({
        ruleCode: rule.ruleCode,
        summary: rule.summary,
        detail: rule.detail ?? null,
        sourceRef: rule.sourceRef ?? null,
        author: rule.author ?? null,
        attribute,
        kept,
        matched,
      });
    }
  }

  return {
    narrow,
    deny: patterns.length ? { roles: [...roles], patterns } : undefined,
    applied,
  };
}
