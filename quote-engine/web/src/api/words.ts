/**
 * What the enums are called when a person reads them.
 *
 * Every value in the contract is a code — `pendingApproval`, `PO_RECEIPT`, `pricePage`.
 * Codes are right in the data and wrong on a screen, and the failure is quiet: a `Tag`
 * uppercases what it is given, so `pendingApproval` came out as **PENDINGAPPROVAL** on the
 * quote header. The quote LIST had a label map and the quote DETAIL did not, which is how a
 * screen ends up shouting a variable name at somebody deciding whether to approve a
 * discount.
 *
 * So the words live here, once, and nothing renders a raw enum. The failure mode this
 * prevents is not ugliness — it is a screen that reads as unfinished at the exact moment a
 * rep is deciding whether to trust the number next to it.
 *
 * `humanise` is the backstop for a value nobody has named yet: it splits camelCase and
 * snake_case into words rather than letting the raw code through. A map entry is always
 * better, because "Awaiting approval" is not a mechanical transform of `pendingApproval`.
 */

/** Split a code into readable words. The last resort, not the first choice. */
function humanise(code: string | null | undefined): string {
  if (!code) return '—';
  const spaced = code
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Look a code up, falling back to a readable transform rather than the code. */
export const word = (map: Record<string, string>, code: string | null | undefined): string =>
  (code && map[code]) || humanise(code);

export const QUOTE_STATUS_WORD: Record<string, string> = {
  draft: 'Draft',
  pendingApproval: 'Awaiting approval',
  approved: 'Approved, ready to send',
  sent: 'Sent',
  won: 'Won',
  lost: 'Lost',
  expired: 'Expired',
};

/**
 * What the print has to be good enough for, in the customer's words.
 *
 * The codes are what the rules read; these are what a rep and a customer see. A quote
 * restating "graded" to the person who asked for a verified barcode is the failure this
 * module exists to stop.
 */
/**
 * The price books, in the words a customer would use.
 *
 * A quote can carry a coder at one station and an applicator at another, and the
 * customer's copy names each solution. "CIJ" is Axim's filing, not a heading to put
 * in front of somebody buying one.
 */
export const TECHNOLOGY_WORD: Record<string, string> = {
  CIJ: 'Continuous inkjet coder',
  TIJ: 'Thermal inkjet coder',
  TTO: 'Thermal transfer overprinter',
  PIJ: 'High-resolution inkjet coder',
  VIJ: 'Valve jet coder',
  LSR: 'Laser coder',
  PALM: 'Print and apply labeller',
};

export const PRINT_QUALITY_WORD: Record<string, string> = {
  humanReadable: 'read by a person',
  scannable: 'a barcode that has to scan',
  graded: 'a barcode checked to a grade',
  graphics: 'a logo or retail-quality print',
};

export const APPROVAL_STATUS_WORD: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  declined: 'Declined',
};

/**
 * How Planning Analytics arrived at a promise date.
 *
 * These reach a customer second-hand — a rep reads the date out and gets asked why. "From
 * stock" is an answer; `STOCK` is a column value.
 */
export const PROMISE_MODE_WORD: Record<string, string> = {
  STOCK: 'From stock',
  PO_RECEIPT: 'On a purchase order',
  LEAD_TIME: 'Made to lead time',
  BLANKET: 'Against a blanket order',
};

export const TRACE_STATUS_WORD: Record<string, string> = {
  satisfied: 'Satisfied',
  action: 'Needs action',
  warning: 'Warning',
  blocked: 'Blocked',
  info: 'For information',
};

/**
 * What a part IS, in the plural, because these label a filter.
 *
 * 'part' is the deliberately unspecific one — a thing that did not earn the machine role
 * and has not been classified further. "Other parts" says that without pretending to know
 * more than the data does.
 */
export const ITEM_ROLE_WORD: Record<string, string> = {
  printer: 'Machine',
  printhead: 'Print head',
  ink: 'Ink',
  consumable: 'Consumable',
  accessory: 'Accessory',
  spare: 'Spare',
  service: 'Service',
  warranty: 'Warranty',
  promo: 'Promotion',
  part: 'Other part',
};

export const ITEM_ROLE_PLURAL: Record<string, string> = {
  printer: 'Machines',
  printhead: 'Print heads',
  ink: 'Inks',
  consumable: 'Consumables',
  accessory: 'Accessories',
  spare: 'Spares',
  service: 'Service',
  warranty: 'Warranties',
  promo: 'Promotions',
  part: 'Other parts',
};


