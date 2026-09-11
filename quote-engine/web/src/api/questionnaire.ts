import { AXIM_LOGO_WHITE } from '../assets/logo';
import { ENVIRONMENT_OPTIONS } from './types';
import type { ApplicationProfile } from './types';

/**
 * The form a rep sends a customer, and the answers coming back.
 *
 * ── The problem ─────────────────────────────────────────────────────────────
 *
 * The tool grades machines against 28 facts about a production line, and a rep has
 * none of them after the first phone call. So the application section gets filled
 * in from memory, or half-filled, or filled with the rep's guess at what the plant
 * probably runs — and every grade, every ranking and every price book
 * recommendation downstream inherits that guess. "13 of 28 answered" on a saved
 * quote is not a display problem; it is the tool telling you it graded on a third
 * of the evidence.
 *
 * A rep cannot fix that by asking harder. The person who knows the line speed is
 * standing next to the line, and they are not on the call.
 *
 * ── The shape of the answer ─────────────────────────────────────────────────
 *
 * One self-contained HTML file the rep emails as an attachment. The customer opens
 * it in whatever browser they have, answers what they can, and clicks a button that
 * puts a compact block on their clipboard to paste into a reply — or downloads it as
 * a small text file to attach back.
 *
 * No account, no login, no link to a server, nothing to install, and it works on a
 * plant PC with no internet. Those are not conveniences: a form that needs any of
 * them is a form that gets replaced by a phone call.
 *
 * ── Why a block of text rather than a file format ───────────────────────────
 *
 * Because email mangles things, and the failure has to be partial rather than total.
 * The block is readable by a person, so a customer who pastes it into a reply and
 * then types "actually the speed varies, 250 to 300" has produced something the
 * import reads exactly AND something a rep can read. If the markers are stripped
 * entirely by some mail client, the answers are still prose, and the existing
 * free-text parser in engine/parseApplication.ts reads most of it.
 *
 * A JSON attachment would be all-or-nothing, and would be the thing that gets
 * blocked by the customer's mail gateway.
 *
 * ── Units ───────────────────────────────────────────────────────────────────
 *
 * The customer is asked in inches and Fahrenheit, because that is what a US plant
 * uses and a form that asks for millimetres gets millimetres invented. The block
 * carries the converted canonical value, so the conversion happens once, here,
 * rather than in somebody's head.
 */

export interface QuestionnaireContext {
  quoteNo?: string | null;
  customerName?: string | null;
  lineName?: string | null;
  repName?: string | null;
  repEmail?: string | null;
}

type Kind = 'text' | 'number' | 'select' | 'checks' | 'longtext';

interface Question {
  key: keyof ApplicationProfile;
  /** What a plant engineer would call it. Never the field name. */
  ask: string;
  /** Why it is being asked. A form nobody understands is a form nobody finishes. */
  why?: string;
  kind: Kind;
  unit?: string;
  options?: { value: string; label: string }[];
  /** Multiply the typed number by this before it goes in the block. */
  scale?: number;
  placeholder?: string;
}

interface Section {
  title: string;
  /** Only where the title does not already say it. */
  blurb?: string;
  questions: Question[];
}

/**
 * How each environment is put to a customer.
 *
 * The value is the tool's — see ENVIRONMENT_OPTIONS — and this is only the wording.
 * A plant engineer does not describe their line as "high particulate or dust"; they
 * say it is dusty. Any value with no entry here is asked in its own words, so adding
 * one to the canonical list cannot silently drop it off the form.
 */
const ENVIRONMENT_ASKED: Partial<Record<typeof ENVIRONMENT_OPTIONS[number], string>> = {
  'washdown': 'Washdown — hosed down or steam cleaned',
  'condensation or humidity': 'Humid, or condensation on the pack',
  'refrigerated': 'Chilled or cold store',
  'open air building': 'Open building — doors open to the outside',
  'food grade': 'Food contact or food-grade area',
  'high particulate or dust': 'Dusty — flour, powder, sawdust',
  'static': 'Static build-up on the packs',
  'vibration': 'Vibration in the line or the floor',
  'air turbulence near printhead': 'Draughts or fans near where the code goes',
  'glue strands or angel hair': 'Glue strands or angel hair',
  'high temperature': 'Hot — near ovens or shrink tunnels',
  'clean room': 'Clean room',
  'outdoor': 'Outdoors',
};

const IN_TO_MM = 25.4;

/**
 * The questions, in the order somebody standing at the line would answer them.
 *
 * Not the order the profile declares them, and not grouped by which rule reads
 * them. Somebody filling this in walks up to the machine, looks at what is going
 * past, then at the conveyor, then at what has to be printed, then thinks about the
 * room. Asking out of that order is how a form gets abandoned halfway.
 */
export const SECTIONS: Section[] = [
  {
    title: 'What you are marking',
    questions: [
      { key: 'substrate', kind: 'text', ask: 'What is the pack made of?',
        why: 'Corrugated card takes a different ink from a plastic bottle.',
        placeholder: 'e.g. corrugated case, HDPE bottle, coated carton, PET film' },
      { key: 'porosity', kind: 'select', ask: 'Does the surface absorb ink?',
        why: 'Paper and card soak up ink. Plastic, glass and metal need an ink that dries on the surface.',
        /* The three the builder can show and the rules can read. 'semiPorous' was a
           fourth that neither could: it came back, sat in the field, and the select
           on the builder rendered blank because it has no such option. */
        options: [
          { value: 'porous', label: 'Absorbent — paper, card, kraft' },
          { value: 'nonPorous', label: 'Not absorbent — plastic, glass, metal, foil' },
          { value: 'unknown', label: 'Not sure, or somewhere in between' },
        ] },
      { key: 'productWidthMm', kind: 'number', ask: 'How wide is the pack?', unit: 'inches', scale: IN_TO_MM },
      { key: 'productLengthMm', kind: 'number', ask: 'How long is it?', unit: 'inches', scale: IN_TO_MM },
      { key: 'productTempF', kind: 'number', ask: 'Is the pack warm when it is marked?', unit: '°F',
        why: 'Ink holds differently on a warm pack — off an oven, a filler or a shrink tunnel.',
        placeholder: 'leave blank if it is at room temperature' },
      /* The label, where there is one. Asked with the pack because that is when the
         customer has it in front of them, and left blank without apology by everybody
         who is not buying a labeller. */
      { key: 'labelWidthMm', kind: 'number', ask: 'How wide is the label?', unit: 'inches',
        scale: IN_TO_MM,
        why: 'Only for print-and-apply. Every applicator and print engine states a '
          + 'label width range, and they differ — 4.5 inches on one engine, 7.1 on another.',
        placeholder: 'leave blank if you are not applying labels' },
      { key: 'labelLengthMm', kind: 'number', ask: 'How long is the label?', unit: 'inches',
        scale: IN_TO_MM,
        why: 'Only for print-and-apply. The LB5200 takes up to 22 inches and the PL6300 up to 14.',
        placeholder: 'leave blank if you are not applying labels' },
    ],
  },
  {
    title: 'The line it runs on',
    blurb: 'Speed, spacing, and what the pack sits on.',
    questions: [
      { key: 'lineSpeedFpm', kind: 'number', ask: 'How fast does the line run?', unit: 'feet per minute',
        why: 'Speed rules out more machines than anything else here; an estimate is fine.' },
      { key: 'throughputPpm', kind: 'number', ask: 'How many packs a minute?', unit: 'per minute',
        why: 'Some machines are rated by packs per minute instead of line speed.' },
      { key: 'productSpacingMm', kind: 'number', ask: 'What is the gap between packs?', unit: 'inches', scale: IN_TO_MM },
      { key: 'productMotion', kind: 'select', ask: 'Is the pack moving when it is marked?',
        options: [
          { value: 'moving', label: 'Moving past on the conveyor' },
          { value: 'stationary', label: 'Stopped, indexed into position' },
        ] },
      { key: 'conveyor', kind: 'select', ask: 'Is there already a conveyor?',
        why: 'A coder needs something to mount on. If the conveyor is part of this project, we quote that too.',
        options: [
          { value: 'existing', label: 'Yes, marking onto an existing line' },
          { value: 'new', label: 'No, the conveyor is part of this project' },
        ] },
      { key: 'guideRails', kind: 'select', ask: 'Are there guide rails holding the pack in position?',
        why: 'Print quality depends on the gap between the printhead and the pack, which packs that wander keep changing.',
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No, packs can move side to side' },
        ] },
    ],
  },
  {
    title: 'The code you need printed',
    blurb: 'What it says, how big, and where it goes.',
    questions: [
      { key: 'messageContent', kind: 'text', ask: 'What has to be printed?',
        placeholder: 'e.g. best-before date, lot code, batch number, logo' },
      { key: 'linesOfPrint', kind: 'number', ask: 'How many lines of text?' },
      { key: 'charHeightMm', kind: 'number', ask: 'How tall do the characters need to be?', unit: 'inches',
        scale: IN_TO_MM, why: 'If there is a customer or retailer specification for this, use that figure.' },
      { key: 'markingWindowMm', kind: 'number', ask: 'How much clear space is there on the pack to print into?', unit: 'inches',
        scale: IN_TO_MM, why: 'The clear area on the pack where the code can go.' },
      { key: 'throwDistMm', kind: 'number', ask: 'How far will the printhead sit from the pack?', unit: 'inches',
        scale: IN_TO_MM, why: 'We can work this out from the rest if you do not know.' },
      { key: 'barcodeRequirements', kind: 'text', ask: 'Any barcode or 2D code?',
        why: 'A barcode has to scan, so it needs a closer printhead and a cleaner print than text.',
        placeholder: 'e.g. GS1-128, Data Matrix, none' },
      { key: 'printQuality', kind: 'select', ask: 'How good does the print have to be?',
        why: 'This is the difference between a valve jet and a thermal jet — 9 x 25 dots '
          + 'against 300 x 300. Every machine trades resolution for speed, and without '
          + 'this the tool cannot say which side of that trade you need.',
        options: [
          { value: 'humanReadable', label: 'Read by a person — date, lot, batch' },
          { value: 'scannable', label: 'A barcode that has to scan' },
          { value: 'graded', label: 'A barcode checked to a grade' },
          { value: 'graphics', label: 'A logo, or retail-quality print' },
        ] },
    ],
  },
  {
    title: 'The room it lives in',
    questions: [
      /* Values from ENVIRONMENT_OPTIONS, not written again here.
         They were written again here, and drifted: this asked for 'high humidity'
         and 'cold or chilled' while every rule compares against 'condensation or
         humidity' and 'refrigerated'. A customer ticking those sent back an answer
         that imported, displayed as captured, and matched nothing. The labels are
         the customer's words; the values are the tool's. */
      { key: 'environment', kind: 'checks', ask: 'Which of these describe the area?',
        options: ENVIRONMENT_OPTIONS.map((value) => ({
          value,
          label: ENVIRONMENT_ASKED[value] ?? value,
        })) },
      { key: 'ambientTempMinF', kind: 'number', ask: 'Coldest the area gets', unit: '°F' },
      { key: 'ambientTempMaxF', kind: 'number', ask: 'Warmest the area gets', unit: '°F' },
    ],
  },
  {
    title: 'Anything else',
    questions: [
      { key: 'adhesionRequirements', kind: 'text', ask: 'Does the code have to survive anything after printing?',
        placeholder: 'e.g. freezing, hot fill, abrasion in transit, hand washing' },
      { key: 'sampleTested', kind: 'select', ask: 'Can you send us a sample pack to test on?',
        why: 'We print on your own pack and send it back, so you see the result before you buy.',
        options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
      { key: 'notes', kind: 'longtext', ask: 'Anything else we should know?',
        placeholder: 'Existing equipment, deadlines, problems with the current coder, anything at all.' },
    ],
  },
];

export const BLOCK_START = '=== AXIM APPLICATION ANSWERS v1 ===';
export const BLOCK_END = '=== END AXIM ANSWERS ===';

/* ------------------------------------------------------------------ reading */

/**
 * Read a returned questionnaire.
 *
 * Deliberately forgiving, because this text has been through at least one mail
 * client and possibly three. It survives quote markers (`>`), wrapped lines, changed
 * case, smart quotes, and a customer typing extra prose above and below the block.
 *
 * Returns only what it actually found. A field the customer left blank stays absent
 * rather than becoming null, so importing never overwrites something the rep already
 * established on the phone with an empty answer.
 */
export function parseQuestionnaire(text: string): {
  profile: Partial<ApplicationProfile>;
  found: (keyof ApplicationProfile)[];
  quoteNo: string | null;
} {
  const profile: Partial<ApplicationProfile> = {};
  const found: (keyof ApplicationProfile)[] = [];
  let quoteNo: string | null = null;
  if (!text) return { profile, found, quoteNo };

  const clean = text
    .replace(/\r/g, '')
    // Mail clients quote replies with '>' and sometimes several.
    .split('\n').map((l) => l.replace(/^[>\s]+/, '')).join('\n')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"');

  const from = clean.indexOf(BLOCK_START);
  if (from < 0) return { profile, found, quoteNo };
  const to = clean.indexOf(BLOCK_END, from);
  const body = clean.slice(from + BLOCK_START.length, to < 0 ? undefined : to);

  const known = new Map<string, Question>();
  for (const s of SECTIONS) for (const q of s.questions) known.set(q.key.toLowerCase(), q);

  for (const line of body.split('\n')) {
    const at = line.indexOf('=');
    if (at < 0) continue;
    const key = line.slice(0, at).trim().toLowerCase();
    const raw = line.slice(at + 1).trim();
    if (!raw) continue;

    if (key === 'quote') { quoteNo = raw; continue; }

    const q = known.get(key);
    if (!q) continue;

    if (q.kind === 'number') {
      // The block carries the converted value, but a customer editing by hand will
      // type "300 fpm" or "1,200". Take the first number and ignore the rest.
      const n = Number(raw.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)?.[0]);
      if (Number.isNaN(n)) continue;
      (profile as Record<string, unknown>)[q.key] = n;
    } else {
      (profile as Record<string, unknown>)[q.key] = raw;
    }
    found.push(q.key);
  }

  return { profile, found, quoteNo };
}

/* ------------------------------------------------------------------ writing */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Build the file the customer opens.
 *
 * Self-contained by necessity rather than by preference: it is opened from an email
 * attachment on a machine that may have no internet, so a CDN stylesheet or a web
 * font is a form that renders as unstyled text on the one occasion it matters.
 */
export function buildQuestionnaire(ctx: QuestionnaireContext = {}): string {
  const title = ['Axim — coding and marking questionnaire', ctx.lineName]
    .filter(Boolean).join(' · ');

  const fields = SECTIONS.map((sec) => `
    <section>
      <h2>${esc(sec.title)}</h2>
      ${sec.blurb ? `<p class="blurb">${esc(sec.blurb)}</p>` : ''}
      ${sec.questions.map((q) => {
        const id = `f_${q.key}`;
        const why = q.why ? `<span class="why">${esc(q.why)}</span>` : '';
        const unit = q.unit ? `<span class="unit">${esc(q.unit)}</span>` : '';
        let input = '';
        if (q.kind === 'select') {
          input = `<select id="${id}" data-key="${q.key}">
            <option value="">—</option>
            ${(q.options ?? []).map((o) =>
              `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}
          </select>`;
        } else if (q.kind === 'checks') {
          input = `<div class="checks" id="${id}" data-key="${q.key}">
            ${(q.options ?? []).map((o, i) => `
              <label class="check"><input type="checkbox" value="${esc(o.value)}"
                     id="${id}_${i}"> ${esc(o.label)}</label>`).join('')}
          </div>`;
        } else if (q.kind === 'longtext') {
          input = `<textarea id="${id}" data-key="${q.key}" rows="4"
                    placeholder="${esc(q.placeholder ?? '')}"></textarea>`;
        } else {
          input = `<input id="${id}" data-key="${q.key}"
                    type="${q.kind === 'number' ? 'number' : 'text'}"
                    ${q.scale ? `data-scale="${q.scale}"` : ''}
                    step="any" placeholder="${esc(q.placeholder ?? '')}">`;
        }
        return `<div class="q">
          <label for="${id}">${esc(q.ask)} ${unit}</label>
          ${why}
          ${input}
        </div>`;
      }).join('')}
    </section>`).join('');

  /* The script is small on purpose. Someone at the customer's IT department may
     well open this file and read it before letting it through, and "what does this
     attachment do" should be answerable in under a minute. It reads its own form
     and writes text. It has no network access and asks for nothing. */
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { --navy:#023B74; --blue:#006298; --cyan:#00AFD7; --rule:#DCE1E5;
          --ink:#1B2226; --quiet:#4F585F; --bg:#F5F7F8; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
         font:15px/1.55 "Trebuchet MS", "Segoe UI", system-ui, sans-serif; }
  .wrap { max-width:44rem; margin:0 auto; background:#fff;
          border-left:1px solid var(--rule); border-right:1px solid var(--rule); }
  header { background:var(--navy); color:#fff; padding:22px 26px;
           border-bottom:3px solid var(--cyan); }
  header .logo { height:44px; width:auto; display:block; margin-bottom:18px; }
  header h1 { margin:0 0 6px; font-size:19px; letter-spacing:-.01em; }
  header p { margin:0; font-size:13px; color:#D7E3EE; }
  .meta { margin-top:12px; font-size:12.5px; color:#D7E3EE; }
  .meta b { color:#fff; }
  .intro { padding:18px 26px; border-bottom:1px solid var(--rule); font-size:13.5px; }
  .intro strong { color:var(--navy); }
  section { padding:18px 26px; border-bottom:1px solid var(--rule); }
  h2 { margin:0 0 3px; font-size:15px; color:var(--navy); }
  .blurb { margin:0 0 14px; font-size:12.5px; color:var(--quiet); }
  .q { margin-bottom:14px; }
  .q label { display:block; font-size:13.5px; font-weight:600; margin-bottom:2px; }
  .unit { font-weight:400; color:var(--quiet); font-size:12px; }
  .why { display:block; font-size:12px; color:var(--quiet); margin-bottom:5px; }
  input[type=text], input[type=number], select, textarea {
    width:100%; padding:7px 9px; font:inherit; font-size:14px;
    border:1px solid #B6BEC4; border-radius:2px; background:#fff; }
  input:focus, select:focus, textarea:focus {
    outline:2px solid var(--cyan); outline-offset:1px; border-color:var(--blue); }
  .checks { display:grid; gap:5px; }
  .check { font-weight:400 !important; font-size:13.5px; display:flex;
           align-items:flex-start; gap:7px; }
  .check input { margin-top:3px; }
  footer { padding:20px 26px 28px; background:#F2F6FA; }
  .btn { font:inherit; font-size:14px; font-weight:600; padding:10px 16px;
         border:2px solid var(--navy); border-radius:2px; cursor:pointer;
         background:var(--navy); color:#fff; }
  .btn.sec { background:#fff; color:var(--navy); }
  .btns { display:flex; gap:10px; flex-wrap:wrap; }
  #out { width:100%; margin-top:14px; font:12px/1.45 ui-monospace, Consolas, monospace;
         padding:10px; border:1px solid var(--rule); background:#fff; display:none; }
  #said { margin-top:10px; font-size:13px; color:#0A6B44; font-weight:600; display:none; }
  .note { font-size:12.5px; color:var(--quiet); margin:0 0 12px; }
  @media print { .btns, #out, #said { display:none !important; } }
</style>
</head><body>
<div class="wrap">
  <header>
    <!-- Inlined as a data URI, like everything else here. A customer-facing document
         with a missing-image icon where the logo should be is worse than one with no
         logo at all, and an external image is exactly that on a plant PC. -->
    <img src="${AXIM_LOGO_WHITE}" alt="Axim" class="logo">
    <h1>Application questionnaire</h1>
    <p>So we can recommend equipment that will work on your line.</p>
    <div class="meta">
      ${ctx.customerName ? `<div>Prepared for <b>${esc(ctx.customerName)}</b></div>` : ''}
      ${ctx.lineName ? `<div>Line: <b>${esc(ctx.lineName)}</b></div>` : ''}
      ${ctx.repName ? `<div>Your contact: <b>${esc(ctx.repName)}</b>${
        ctx.repEmail ? ` · ${esc(ctx.repEmail)}` : ''}</div>` : ''}
    </div>
  </header>

  <div class="intro">
    <p style="margin:0 0 8px"><strong>Answer what you know and leave the rest
    blank.</strong> A gap we can ask about is more use to us than a guess we cannot see.</p>
    <p style="margin:0">At the bottom, <strong>Copy my answers</strong> puts them on your
    clipboard to paste into your reply. Nothing on this page is sent anywhere.</p>
  </div>

  ${fields}

  <footer>
    <p class="note">A short block of text. Type whatever else you want above it.</p>
    <div class="btns">
      <button class="btn" id="copy" type="button">Copy my answers</button>
      <button class="btn sec" id="dl" type="button">Download as a file</button>
      <button class="btn sec" id="show" type="button">Show the text</button>
    </div>
    <div id="said"></div>
    <textarea id="out" rows="14" readonly></textarea>
  </footer>
</div>
<script>
(function () {
  var QUOTE = ${JSON.stringify(ctx.quoteNo ?? '')};
  function collect() {
    var out = [${JSON.stringify(BLOCK_START)}];
    if (QUOTE) out.push('quote = ' + QUOTE);
    var els = document.querySelectorAll('[data-key]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i], key = el.getAttribute('data-key'), val = '';
      if (el.classList.contains('checks')) {
        var on = el.querySelectorAll('input:checked'), picked = [];
        for (var j = 0; j < on.length; j++) picked.push(on[j].value);
        val = picked.join(', ');
      } else {
        val = (el.value || '').trim();
        var scale = el.getAttribute('data-scale');
        if (scale && val !== '') {
          var n = parseFloat(val.replace(/,/g, ''));
          if (!isNaN(n)) val = String(Math.round(n * parseFloat(scale) * 10) / 10);
        }
      }
      if (val !== '') out.push(key + ' = ' + val.replace(/\\n/g, ' '));
    }
    out.push(${JSON.stringify(BLOCK_END)});
    return out.join('\\n');
  }
  function say(msg) {
    var s = document.getElementById('said');
    s.textContent = msg; s.style.display = 'block';
  }
  document.getElementById('copy').onclick = function () {
    var text = collect(), ta = document.getElementById('out');
    ta.value = text;
    ta.style.display = 'block';
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        say('Copied. Paste it into your reply.');
      }, function () {
        say('Select the text below and copy it, then paste it into your reply.');
      });
    } else {
      say(ok ? 'Copied. Paste it into your reply.'
             : 'Select the text below and copy it, then paste it into your reply.');
    }
  };
  document.getElementById('show').onclick = function () {
    var ta = document.getElementById('out');
    ta.value = collect(); ta.style.display = 'block'; ta.select();
  };
  document.getElementById('dl').onclick = function () {
    var blob = new Blob([collect()], { type: 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'axim-application-answers.txt';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    say('Downloaded. Attach that file to your reply.');
  };
})();
</script>
</body></html>`;
}
