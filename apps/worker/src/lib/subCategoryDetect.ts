/**
 * Sub-category detection across essentials, lifestyle, and indulgence groups.
 *
 * Three buckets, three cadences:
 *   essentials   = needs (variable cadence within essentials, on top of fixed
 *                  bills like rent/utilities/phone). Groceries, transit/fuel.
 *                  The user can flex these but cannot skip them.
 *   lifestyle    = wants you regularly choose. Shopping, personal care
 *                  (incl. pharmacy/health), entertainment. Discretionary cadence.
 *   indulgence   = the watched bucket. Alcohol, restaurants, delivery, weed,
 *                  streaming, treats.
 *
 * Returns null when nothing matches confidently. The Habits queue surfaces
 * unconfirmed merchants either way (null guess included), letting the user
 * pick from the dropdown.
 */

export type EssentialsSub = 'groceries' | 'transit';

export type LifestyleSub =
  | 'shopping'
  | 'personal_care'
  | 'entertainment';

export type IndulgenceSub =
  | 'alcohol'
  | 'restaurants'
  | 'delivery'
  | 'weed'
  | 'streaming'
  | 'treats';

export type SubCategory = EssentialsSub | LifestyleSub | IndulgenceSub;

export type SubGroup = 'essentials' | 'lifestyle' | 'indulgence';

export const ESSENTIALS_SUBS: readonly EssentialsSub[] = [
  'groceries',
  'transit',
];

export const LIFESTYLE_SUBS: readonly LifestyleSub[] = [
  'shopping',
  'personal_care',
  'entertainment',
];

export const INDULGENCE_SUBS: readonly IndulgenceSub[] = [
  'alcohol',
  'restaurants',
  'delivery',
  'weed',
  'streaming',
  'treats',
];

export const ALL_SUBS: readonly SubCategory[] = [
  ...ESSENTIALS_SUBS,
  ...LIFESTYLE_SUBS,
  ...INDULGENCE_SUBS,
];

// Cadence per sub-category. Essentials are 'variable' (you must spend, the
// amount flexes); lifestyle and indulgence are 'discretionary' (you choose to
// spend at all). 'fixed' is reserved for the recurring-bill detector — bills
// don't carry a sub-category, so this enum value isn't returned by SUB_CADENCE
// today; it exists for the kernel's vocabulary to match.
export type Cadence = 'fixed' | 'variable' | 'discretionary';

export const SUB_CADENCE: Record<SubCategory, Cadence> = {
  groceries: 'variable',
  transit: 'variable',
  shopping: 'discretionary',
  personal_care: 'discretionary',
  entertainment: 'discretionary',
  alcohol: 'discretionary',
  restaurants: 'discretionary',
  delivery: 'discretionary',
  weed: 'discretionary',
  streaming: 'discretionary',
  treats: 'discretionary',
};

export function isSubCategory(v: unknown): v is SubCategory {
  return typeof v === 'string' && (ALL_SUBS as readonly string[]).includes(v);
}

export function isValidForGroup(sub: SubCategory, group: SubGroup): boolean {
  if (group === 'essentials') return (ESSENTIALS_SUBS as readonly string[]).includes(sub);
  if (group === 'lifestyle') return (LIFESTYLE_SUBS as readonly string[]).includes(sub);
  return (INDULGENCE_SUBS as readonly string[]).includes(sub);
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
  { sub: 'weed', patterns: ['tokyo smoke', 'ocs.ca', 'value buds', 'fire & flower', 'fire and flower', 'one plant', 'spiritleaf', 'canna cabana', 'cannabis', 'dispensary'] },
  { sub: 'alcohol', patterns: ['bar raval', 'pub', ' lcbo', 'lcbo ', 'beer store', 'wine rack', ' bar ', 'tavern', 'cocktail', 'brewery', 'brewing', 'distillery'] },
  // delivery = app-based food delivery (Uber Eats, DoorDash, Skip)
  { sub: 'delivery', patterns: ['uber eats', 'ubereats', 'doordash', 'skip the dishes', 'skipthedishes', 'foodora'] },
  // restaurants = food you bought outside the home, in person — fast food
  // and sit-down both land here. Delivery apps stay separate.
  { sub: 'restaurants', patterns: ['mcdonald', 'tim hortons', 'tim horton', 'burger king', 'wendy', 'a&w', 'subway', 'kfc', 'popeyes', 'taco bell', 'pizza pizza', 'dominos', "domino's", 'little caesars', 'banh mi', 'pho ', 'sushi', 'thai express', 'chipotle', 'pai northern'] },
  { sub: 'treats', patterns: ['starbucks', 'second cup', 'aroma', 'dq', 'dairy queen', 'baskin', 'menchie', 'mcvities', 'cinnabon'] },
];

const ESSENTIALS_RULES: readonly Rule[] = [
  // groceries = eat-at-home grocery stores
  { sub: 'groceries', patterns: ['loblaws', 'no frills', 'metro ', 'sobeys', 'farm boy', 'whole foods', 'longo', 'fortinos', 'food basics', 'freshco', 'rabba', 'costco wholesale', 'walmart supercentre', 'walmart supercenter', 'grocer', 'market '] },
  // transit covers gas + transit + rideshare
  { sub: 'transit', patterns: ['ttc', 'presto', 'go transit', ' uber ', 'uber*', 'lyft', 'parking', 'green p', 'shell', 'esso', 'petro-canada', 'petro canada', 'ultramar', 'husky', 'mobil', 'chevron'] },
];

const LIFESTYLE_RULES: readonly Rule[] = [
  // personal_care folds in pharmacy/dental/physio/optometry — body upkeep
  { sub: 'personal_care', patterns: ['sephora', 'mac cosmetics', 'lush', 'salon', 'barber', 'hair ', 'nails', 'spa', 'beauty', 'shoppers drug', 'rexall', 'pharmaprix', 'pharmacy', 'dental', 'dentist', 'physio', 'chiropractor', 'massage', 'optom', 'lenscrafters'] },
  // entertainment folds in gaming brands — anything you do for fun
  { sub: 'entertainment', patterns: ['cineplex', 'imax', 'tiff', 'theatre', 'theater', 'concert', 'ticketmaster', 'stubhub', 'rogers centre', 'scotiabank arena', 'museum', 'steam', 'playstation', 'xbox', 'nintendo', 'epic games', 'riot games', 'blizzard', 'twitch'] },
  // shopping folds in home goods — anything you buy. Keep last, broadest.
  { sub: 'shopping', patterns: ['ikea', 'home depot', "lowe's", 'lowes', 'rona', 'canadian tire', 'home hardware', 'best buy', 'staples', 'wayfair', 'structube', 'amazon', 'aritzia', 'zara', 'h&m', 'uniqlo', 'lululemon', 'roots', 'gap', 'old navy', 'nike', 'adidas', 'winners', 'marshalls', 'simons', 'hudson', 'value village'] },
];

/**
 * Guess a sub-category from a merchant name.
 *
 * @param name Merchant display name or normalized key. Case-insensitive.
 * @param group The merchant's category group, if known. Constrains which rule
 *              set runs. When null/undefined, all three are tried in order:
 *              indulgence (most specific brands), then essentials (groceries
 *              are unambiguous), then lifestyle (broadest catch-alls last).
 */
export function detectSubCategory(
  name: string,
  group?: SubGroup | string | null,
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

  if (group === 'essentials') return tryRules(ESSENTIALS_RULES);
  if (group === 'lifestyle') return tryRules(LIFESTYLE_RULES);
  if (group === 'indulgence') return tryRules(INDULGENCE_RULES);
  return tryRules(INDULGENCE_RULES) ?? tryRules(ESSENTIALS_RULES) ?? tryRules(LIFESTYLE_RULES);
}

export const SUB_LABELS: Record<SubCategory, string> = {
  groceries: 'groceries',
  transit: 'transit',
  shopping: 'shopping',
  personal_care: 'personal care',
  entertainment: 'entertainment',
  alcohol: 'alcohol',
  restaurants: 'restaurants',
  delivery: 'delivery',
  weed: 'weed',
  streaming: 'streaming',
  treats: 'treats',
};
