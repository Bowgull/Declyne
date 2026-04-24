---
name: declyne-brand
description: Declyne visual and voice system. Four-tab nav, single mascot PNG as sigil, receipt motif, Bridge Four register.
---

# Declyne Brand Skill

Declyne sits inside the Bridge Four family (Bowgull, Bowgull). It borrows the same register: grunge plain tech. Apple, Garmin, Wealthsimple shape. No fantasy vocabulary, no RPG words, no glyphs or runes or quests, even though the mascot looks like a familiar.

## Palette

- `--bg-primary: #0D0A10` near-black, warm
- `--bg-card: #15111B`
- `--accent-purple: #6B5A9E` primary interactive
- `--accent-purple-soft: #9A8BC4` hover and focus
- `--text-primary: #E8E4EC`
- `--text-muted: #8A8294`
- `--danger: #C45B5B` for overspend, past due
- `--ok: #6F9E7A` for cleared, paid

Grain overlay 4 to 6% opacity on backgrounds. 8px card radius. 1px hairline borders at 10% white.

## Type

- Display and nav: Barlow Semibold
- Body: Barlow Regular
- Numbers: Barlow Medium, tabular figures on
- No Cinzel. Cinzel is Waymark. Declyne does not use serif display.

## Mascot

One PNG. Static. No variants, no emotions, no animation. Treat it as a sigil, not a character. Never named in-product. It appears in exactly four places:

1. App icon background, centered, muted.
2. Onboarding screen one, right of the wordmark, small.
3. Review Queue empty state, centered at 40% opacity.
4. Grow tab locked state, before Phase 4 unlocks.

Nowhere else. Do not add it to loading spinners, toasts, buttons, or empty states beyond Review Queue.

## Receipt as Motif

The receipt is the extensible visual element. Curled paper edge, perforated top, monospace-adjacent alignment. Use in three locations:

1. Sunday reconciliation summary card
2. CSV import confirmation
3. Phase transition card

Receipt is the data motif. Mascot is the identity motif. Do not combine them in one view.

## Layout Rules

- Corner brackets only on hero cards (Today top card, phase transition card). Not on every card.
- One accent per screen. Either the mascot or a receipt, never both.
- Numbers are the loudest element on any screen. Copy supports the number, not the other way around.

## Voice

Direct, dry, slightly dark. Short sentences. No em dashes ever. Use periods, colons, commas.

Range examples:
- "Paycheque landed. Route it before you do something stupid with it."
- "Three subscriptions charged this week. One is new."
- "You skipped Sunday. Tuesday is the last soft reminder."

Never:
- Cheerleading ("You got this!")
- Shaming ("You failed to...")
- Questions that make Josh decide the coaching ("Want to adjust your plan?")
- Emoji, ever
- RPG or fantasy vocabulary (quest, rune, glyph, realm, sigil-as-user-facing-word)

## Four-Tab Nav

Bottom bar, four items plus cog:

1. **Today** default
2. **Budget** includes vice dashboard
3. **Debts** includes splits with Lindsay
4. **Grow** locked until Phase 4

Cog at top right of Today. Settings is not a tab.

## Component Shapes

- Cards: 8px radius, hairline border
- Buttons: 8px radius, purple fill for primary, outline for secondary, text for tertiary
- Inputs: 8px radius, no inner shadow, focus ring is purple-soft at 2px
- Sheets: full-width modal from bottom, 16px top radius
