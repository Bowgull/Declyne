/**
 * Sub-category detection for discretionary merchants.
 *
 * Scope: lifestyle + indulgence groups only. Essentials/debt/savings/income
 * stay coarse (the moral split is enough for those — sub-categories are a
 * habit-observation tool).
 *
 * Approach: pure name-pattern matching against a `normalized_key` (lowercased,
 * collapsed merchant name). No ML, no learning beyond merchant stickiness —
 * once a user approves a sub-category for a merchant, the row stays put and
 * every future txn flowing through that normalized_key inherits.
 *
 * Returns null when nothing matches confidently. The Habits queue surfaces
 * unconfirmed merchants either way (null guess included), letting the user
 * pick from the dropdown.
 */

export type LifestyleSub =
  | 'food'
  | 'transit'
  | 'shopping'
  | 'home'
  | 'personal_care'
  | 'entertainment'
  | 'health';

export type IndulgenceSub =
  | 'bars'
  | 'takeout'
  | 'fast_food'
  | 'weed'
  | 'streaming'
  | 'gaming'
  | 'treats';

export type SubCategory = LifestyleSub | IndulgenceSub;

export const LIFESTYLE_SUBS: readonly LifestyleSub[] = [
  'food',
  'transit',
  'shopping',
  'home',
  'personal_care',
  'entertainment',
  'health',
];

export const INDULGENCE_SUBS: readonly IndulgenceSub[] = [
  'bars',
  'takeout',
  'fast_food',
  'weed',
  'streaming',
  'gaming',
  'treats',
];

export const ALL_SUBS: readonly SubCategory[] = [
  ...LIFESTYLE_SUBS,
  ...INDULGENCE_SUBS,
];

export function isSubCategory(v: unknown): v is SubCategory {
  return typeof v === 'string' && (ALL_SUBS as readonly string[]).includes(v);
}

export function isValidForGroup(
  sub: SubCategory,
  group: 'lifestyle' | 'indulgence',
): boolean {
  return group === 'lifestyle'
    ? (LIFESTYLE_SUBS as readonly string[]).includes(sub)
    : (INDULGENCE_SUBS as readonly string[]).includes(sub);
}

// Patterns are checked in order; first match wins. Longer/more-specific
// keywords come first to avoid generic words capturing branded ones
// (e.g. "starbucks" before "coffee").
interface Rule {
  sub: SubCategory;
  patterns: readonly string[];
}

const INDULGENCE_RULES: readonly Rule[] = [
  // streaming first — these are subscription brands, can't be confused with food
  { sub: 'streaming', patterns: ['netflix', 'spotify', 'disney+', 'disney plus', 'crave', 'prime video', 'apple music', 'apple tv', 'youtube premium', 'hulu', 'paramount+', 'paramount plus', 'hbo'] },
  { sub: 'gaming', patterns: ['steam', 'playstation', 'xbox', 'nintendo', 'epic games', 'riot games', 'blizzard', 'twitch'] },
  { sub: 'weed', patterns: ['tokyo smoke', 'ocs.ca', 'value buds', 'fire & flower', 'fire and flower', 'one plant', 'spiritleaf', 'canna cabana', 'cannabis', 'dispensary'] },
  { sub: 'bars', patterns: ['bar raval', 'pub', ' lcbo', 'lcbo ', 'beer store', 'wine rack', ' bar ', 'tavern', 'cocktail', 'brewery', 'brewing', 'distillery'] },
  { sub: 'fast_food', patterns: ['mcdonald', 'tim hortons', 'tim horton', 'burger king', 'wendy', 'a&w', 'subway', 'kfc', 'popeyes', 'taco bell', 'pizza pizza', 'dominos', "domino's", 'little caesars'] },
  { sub: 'takeout', patterns: ['uber eats', 'ubereats', 'doordash', 'skipthedishes', 'skip the dishes', 'foodora', 'banh mi', 'pho ', 'sushi', 'thai express', 'chipotle'] },
  { sub: 'treats', patterns: ['starbucks', 'second cup', 'aroma', 'dq', 'dairy queen', 'baskin', 'menchie', 'mcvities', 'cinnabon', 'tim ho'] },
];

const LIFESTYLE_RULES: readonly Rule[] = [
  { sub: 'transit', patterns: ['ttc', 'presto', 'go transit', ' uber ', 'uber*', 'lyft', 'parking', 'green p', 'shell', 'esso', 'petro-canada', 'petro canada', 'ultramar', 'husky', 'mobil', 'chevron'] },
  { sub: 'health', patterns: ['shoppers drug', 'rexall', 'pharmaprix', 'pharmacy', 'dental', 'dentist', 'physio', 'chiropractor', 'massage', 'optom', 'lenscrafters'] },
  { sub: 'personal_care', patterns: ['sephora', 'mac cosmetics', 'lush', 'salon', 'barber', 'hair ', 'nails', 'spa', 'beauty'] },
  { sub: 'entertainment', patterns: ['cineplex', 'imax', 'tiff', 'theatre', 'theater', 'concert', 'ticketmaster', 'stubhub', 'rogers centre', 'scotiabank arena', 'museum'] },
  { sub: 'home', patterns: ['ikea', 'home depot', "lowe's", 'lowes', 'rona', 'canadian tire', 'home hardware', 'best buy', 'staples', 'wayfair', 'structube'] },
  // food = grocery (lifestyle eat-at-home, not takeout/restaurant — those land in indulgence)
  { sub: 'food', patterns: ['loblaws', 'no frills', 'metro ', 'sobeys', 'farm boy', 'whole foods', 'longo', 'fortinos', 'food basics', 'freshco', "rabba", 'costco wholesale', 'walmart supercentre', 'walmart supercenter', 'grocer', 'market '] },
  // shopping is the catch-all — keep last, broadest
  { sub: 'shopping', patterns: ['amazon', 'aritzia', 'zara', 'h&m', 'uniqlo', 'lululemon', 'roots', 'gap', 'old navy', 'nike', 'adidas', 'winners', 'marshalls', 'simons', 'hudson'] },
];

/**
 * Guess a sub-category from a merchant name.
 *
 * @param name Merchant display name or normalized key. Case-insensitive; the
 *             function lowercases and pads with spaces to make word-boundary
 *             checks straightforward.
 * @param group The merchant's category group, if known. Constrains which rule
 *              set runs — passing 'lifestyle' will never return an indulgence
 *              sub-category. When null/undefined, both rule sets are tried
 *              with indulgence first (more specific brands).
 */
export function detectSubCategory(
  name: string,
  group?: 'lifestyle' | 'indulgence' | string | null,
): SubCategory | null {
  if (!name) return null;
  const padded = ` ${name.toLowerCase()} `;

  const tryRules = (rules: readonly Rule[]): SubCategory | null => {
    for (const r of rules) {
      for (const p of r.patterns) {
        if (padded.includes(p)) return r.sub;
      }
    }
    return null;
  };

  if (group === 'lifestyle') return tryRules(LIFESTYLE_RULES);
  if (group === 'indulgence') return tryRules(INDULGENCE_RULES);
  // Unknown group: indulgence first (brands like "Netflix" are unambiguous),
  // then lifestyle. This path runs on import before category_default_id is
  // set, so the guess is intentionally conservative — null is a fine answer.
  return tryRules(INDULGENCE_RULES) ?? tryRules(LIFESTYLE_RULES);
}

export const SUB_LABELS: Record<SubCategory, string> = {
  food: 'food',
  transit: 'transit',
  shopping: 'shopping',
  home: 'home',
  personal_care: 'personal care',
  entertainment: 'entertainment',
  health: 'health',
  bars: 'bars',
  takeout: 'takeout',
  fast_food: 'fast food',
  weed: 'weed',
  streaming: 'streaming',
  gaming: 'gaming',
  treats: 'treats',
};
