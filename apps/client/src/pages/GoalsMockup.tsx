import { useState } from 'react';

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const kickerDark: React.CSSProperties = {
  ...mono,
  fontSize: 10,
  letterSpacing: '0.28em',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
};

type GoalType =
  | 'emergency'
  | 'vacation'
  | 'rrsp'
  | 'tfsa'
  | 'fhsa'
  | 'car'
  | 'other';

const GOAL_TYPES: { id: GoalType; label: string }[] = [
  { id: 'emergency', label: 'Emergency Fund' },
  { id: 'vacation', label: 'Vacation' },
  { id: 'rrsp', label: 'Retirement (RRSP)' },
  { id: 'tfsa', label: 'Tax-Free Savings (TFSA)' },
  { id: 'fhsa', label: 'First Home (FHSA)' },
  { id: 'car', label: 'Car' },
  { id: 'other', label: 'Other' },
];

interface Suggestion {
  target_cents: number;
  per_paycheque_cents: number;
  target_label: string;
  per_paycheque_label: string;
  why_target: string;
  why_paycheque: string;
}

const SUGGESTIONS: Record<GoalType, Suggestion> = {
  emergency: {
    target_cents: 546000,
    per_paycheque_cents: 21000,
    target_label: '$5,460',
    per_paycheque_label: '$210',
    why_target:
      'three months of your essentials spend ($1,820/mo). The cushion you keep so a surprise bill doesn\'t become a credit card.',
    why_paycheque:
      '5% of your $4,250 paycheque. Reaches your target in roughly 26 paycheques (12 months).',
  },
  vacation: {
    target_cents: 300000,
    per_paycheque_cents: 11500,
    target_label: '$3,000',
    per_paycheque_label: '$115',
    why_target: 'a typical mid-range trip for one. Edit to taste.',
    why_paycheque:
      'reaches $3,000 in roughly 26 paycheques (12 months). Drop it lower to stretch the timeline.',
  },
  rrsp: {
    target_cents: 442000,
    per_paycheque_cents: 17000,
    target_label: '$4,420',
    per_paycheque_label: '$170',
    why_target:
      '4% of your $110,500 income. A starter contribution that gets you into the habit. Your room is much higher; this is what fits the budget today.',
    why_paycheque:
      'splits the target across 26 paycheques. RRSP contributions reduce your taxable income, so this also lowers your taxes next year.',
  },
  tfsa: {
    target_cents: 442000,
    per_paycheque_cents: 17000,
    target_label: '$4,420',
    per_paycheque_label: '$170',
    why_target:
      '4% of your paycheque. Your TFSA room this year is $7,000. You can go higher when the budget allows.',
    why_paycheque:
      '$170 every paycheque. Money inside a TFSA grows tax-free and you can pull it out any time, no tax.',
  },
  fhsa: {
    target_cents: 800000,
    per_paycheque_cents: 31000,
    target_label: '$8,000',
    per_paycheque_label: '$310',
    why_target:
      'your full annual FHSA limit. Combines RRSP-style tax deduction with TFSA-style tax-free withdrawal, but only for a first home.',
    why_paycheque:
      'fills the $8,000 limit across 26 paycheques. Unused room rolls forward, max $40,000 lifetime.',
  },
  car: {
    target_cents: 800000,
    per_paycheque_cents: 31000,
    target_label: '$8,000',
    per_paycheque_label: '$310',
    why_target:
      'a typical down payment on a used reliable car. Edit for what you\'re actually shopping for.',
    why_paycheque:
      'reaches $8,000 in roughly 26 paycheques. Lower it if the timeline can stretch.',
  },
  other: {
    target_cents: 100000,
    per_paycheque_cents: 5000,
    target_label: '$1,000',
    per_paycheque_label: '$50',
    why_target: 'placeholder. Set your own target.',
    why_paycheque: 'placeholder. Set your own contribution.',
  },
};

function SectionLabel({ n, title, note }: { n: string; title: string; note: string }) {
  return (
    <div style={{ margin: '44px 0 16px' }}>
      <div style={{ ...kickerDark, marginBottom: 6 }}>
        <span style={{ color: 'var(--color-accent-gold, #c8a96a)', marginRight: 8 }}>§ {n}</span>
        {title}
      </div>
      <div style={{ ...mono, fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
        {note}
      </div>
    </div>
  );
}

function GoalSheet({ type }: { type: GoalType }) {
  const s = SUGGESTIONS[type];
  const label = GOAL_TYPES.find((g) => g.id === type)!.label;
  return (
    <div className="receipt stub-top stub-bottom" style={{ padding: '20px 22px 22px' }}>
      <div style={{ ...mono, fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--color-ink-muted)', marginBottom: 6 }}>
        new goal
      </div>
      <div className="display" style={{ fontSize: 22, color: 'var(--color-ink)', marginBottom: 16 }}>
        {label}
      </div>

      {/* Type field (the dropdown) */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-ink-muted)', marginBottom: 6 }}>
          Type
        </div>
        <div
          style={{
            ...mono,
            fontSize: 13,
            color: 'var(--color-ink)',
            padding: '10px 12px',
            borderTop: '1px solid var(--color-hairline-ink)',
            borderBottom: '1px solid var(--color-hairline-ink)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{label}</span>
          <span style={{ color: 'var(--color-ink-muted)' }}>▾</span>
        </div>
      </div>

      {/* Target field with smart suggestion */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ ...mono, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-ink-muted)' }}>
            Target
          </span>
          <span style={{ ...mono, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-accent-gold)' }}>
            ✦ suggested
          </span>
        </div>
        <div className="display" style={{ fontSize: 28, color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>
          {s.target_label}
        </div>
        <div style={{ ...mono, fontSize: 11, fontStyle: 'italic', color: 'var(--color-ink-muted)', lineHeight: 1.5, marginTop: 4 }}>
          based on {s.why_target}
        </div>
      </div>

      {/* Per-paycheque field with smart suggestion */}
      <div style={{ marginBottom: 18, paddingTop: 14, borderTop: '1px dashed var(--color-hairline-ink)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ ...mono, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-ink-muted)' }}>
            Per paycheque
          </span>
          <span style={{ ...mono, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-accent-gold)' }}>
            ✦ suggested
          </span>
        </div>
        <div className="display" style={{ fontSize: 28, color: 'var(--color-ink)' }}>
          {s.per_paycheque_label}
        </div>
        <div style={{ ...mono, fontSize: 11, fontStyle: 'italic', color: 'var(--color-ink-muted)', lineHeight: 1.5, marginTop: 4 }}>
          {s.why_paycheque}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="stamp stamp-purple" style={{ flex: 1 }}>
          Open the goal
        </button>
        <button type="button" className="stamp stamp-square">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function GoalsMockup() {
  const [type, setType] = useState<GoalType>('emergency');

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ ...kickerDark, marginBottom: 4 }}>§ MOCKUP · GOALS</div>
        <div className="display" style={{ fontSize: 30, color: 'var(--color-text-primary)' }}>
          Smart suggestion. Teaching copy.
        </div>
        <div style={{ ...mono, fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.6 }}>
          Pick a type. The app fills target + per-paycheque with a sensible number and explains why.
          User edits over the top. The explanation stays so they learn what the number means.
        </div>
      </div>

      {/* 01. Type selector (lives on this mockup page so you can flip through suggestions) */}
      <SectionLabel
        n="01"
        title="Type selector · flip through to see each suggestion"
        note="In the real sheet this is the dropdown at the top. Here we render it as a mono pill row so you can switch contexts on this page."
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {GOAL_TYPES.map((g) => {
          const active = type === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setType(g.id)}
              style={{
                ...mono,
                fontSize: 11,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                padding: '7px 11px',
                borderRadius: 2,
                border: `1px solid ${active ? 'var(--color-accent-purple)' : 'var(--rule-ink-strong)'}`,
                background: active ? 'var(--color-accent-purple)' : 'transparent',
                color: active ? 'var(--color-paper)' : 'var(--color-text-primary)',
                cursor: 'pointer',
              }}
            >
              {g.label}
            </button>
          );
        })}
      </div>

      {/* 02. Goal sheet for the selected type */}
      <SectionLabel
        n="02"
        title="The goal sheet · suggested values + italic teaching caption"
        note="Both fields show ✦ SUGGESTED in muted gold. Italic mono caption underneath explains the math. User can type over either number. The caption stays."
      />
      <GoalSheet type={type} />

      {/* 03. All seven types side-by-side, condensed */}
      <SectionLabel
        n="03"
        title="All seven types, condensed · see the teaching copy at a glance"
        note="The italic caption changes per type. This is the substance of the feature: the user learns what an emergency fund is, what FHSA actually does, why a TFSA is different from an RRSP."
      />
      <div className="receipt" style={{ padding: '18px 18px 4px' }}>
        {GOAL_TYPES.map((g, i) => {
          const s = SUGGESTIONS[g.id];
          return (
            <div
              key={g.id}
              style={{
                padding: '12px 0 14px',
                borderTop: i === 0 ? 'none' : '1px dashed var(--color-hairline-ink)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ ...mono, fontSize: 12, color: 'var(--color-ink)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {g.label}
                </div>
                <div style={{ ...mono, fontSize: 12, color: 'var(--color-ink)' }}>
                  {s.target_label}{' · '}
                  <span style={{ color: 'var(--color-ink-muted)' }}>{s.per_paycheque_label}/paycheque</span>
                </div>
              </div>
              <div style={{ ...mono, fontSize: 11, fontStyle: 'italic', color: 'var(--color-ink-muted)', lineHeight: 1.5, marginTop: 4 }}>
                target: {s.why_target}
              </div>
              <div style={{ ...mono, fontSize: 11, fontStyle: 'italic', color: 'var(--color-ink-muted)', lineHeight: 1.5 }}>
                paycheque: {s.why_paycheque}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
