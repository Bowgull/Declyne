export const CATEGORY_GROUPS = ['essentials', 'lifestyle', 'vice', 'income', 'transfer', 'debt'] as const;
export type CategoryGroup = (typeof CATEGORY_GROUPS)[number];

export const DEFAULT_CATEGORIES: Array<{ name: string; group: CategoryGroup }> = [
  { name: 'Rent', group: 'essentials' },
  { name: 'Utilities', group: 'essentials' },
  { name: 'Groceries', group: 'essentials' },
  { name: 'Transit', group: 'essentials' },
  { name: 'Insurance', group: 'essentials' },
  { name: 'Phone', group: 'essentials' },
  { name: 'Internet', group: 'essentials' },
  { name: 'Medical', group: 'essentials' },

  { name: 'Dining', group: 'lifestyle' },
  { name: 'Shopping', group: 'lifestyle' },
  { name: 'Entertainment', group: 'lifestyle' },
  { name: 'Subscriptions', group: 'lifestyle' },
  { name: 'Travel', group: 'lifestyle' },
  { name: 'Fitness', group: 'lifestyle' },

  { name: 'Alcohol', group: 'vice' },
  { name: 'Cannabis', group: 'vice' },
  { name: 'Tobacco', group: 'vice' },
  { name: 'Gambling', group: 'vice' },
  { name: 'Fast food', group: 'vice' },

  { name: 'Paycheque', group: 'income' },
  { name: 'Side income', group: 'income' },
  { name: 'Refund', group: 'income' },

  { name: 'Transfer', group: 'transfer' },

  { name: 'CC Payment', group: 'debt' },
  { name: 'Loan Payment', group: 'debt' },
];
