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

- Display: Fraunces 600 (literary serif, used ceremonially via the `.display` class)
- Body and nav: Geist
- Numbers: Geist Medium with tabular figures on (`.num` class)
- Mono: Geist Mono (used in `.receipt` and any thermal-paper surface)
- No Cinzel. Cinzel is Waymark.

## Mascot

One PNG. Static. No variants, no emotions, no animation. Treat it as a sigil, not a character. Never named in-product.

Primary anchors (always present here):

1. App icon background, centered, muted.
2. Onboarding screen one, right of the wordmark, small.
3. Review Queue empty state, centered at 40% opacity.
4. Grow tab locked state, before Phase 4 unlocks.

**Build-phase note:** Declyne is in active build, not in lockdown. The mascot can appear elsewhere when it earns its place — as a small inline mark in screen headers, a subtle watermark in hero cards, or a quiet anchor in empty states. Use restraint, not a checklist. Do not put it on loading spinners, toasts, buttons, or as a chrome decoration. If a screen has more than one mascot mark, cut one.

## Receipt as Motif

The receipt is the extensible visual element. Curled paper edge, perforated top, monospace-adjacent alignment.

Suggested anchors (the motif lives here without question):

1. Sunday reconciliation summary card
2. CSV import confirmation
3. Phase transition card

**Build-phase note:** The receipt motif can extend to any data-dense surface where the thermal-paper feel reinforces the "kept the receipts" voice — Today screen sections, debt cards, vice dashboard, statement lists. It is not locked to those three.

Receipt is the data motif. Mascot is the identity motif. They can share a screen when one clearly leads (e.g. mascot as a small header sigil, receipt as the body). Avoid two equally loud accents fighting in the same view.

## Layout Rules

- Corner brackets are a hero-card affordance. Don't sprinkle them on every card; reserve them for what should feel weighted.
- One *loud* accent per screen. Mascot and receipt can co-exist if one clearly supports and the other clearly leads.
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
