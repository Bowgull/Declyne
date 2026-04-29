import { useState, type CSSProperties } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export type SubscriptionVerdict = 'keep' | 'kill' | 'not_a_sub';

export interface SubscriptionRow {
  merchant_id: string;
  merchant_name: string;
  amount_cents: number;
  category_group: string;
  cadence_days: number;
  months_running: number;
  verdict?: SubscriptionVerdict | null;
}

interface Props {
  subs: SubscriptionRow[];
  emptyHint?: string;
}

const mono: CSSProperties = { fontFamily: 'var(--font-mono)' };
const kicker: CSSProperties = {
  ...mono,
  fontSize: 10,
  letterSpacing: '0.28em',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
};

// Cancel instructions for the top recurring merchants. Stripped down to the
// shortest path that gets the user to the cancel button. Falls back to a
// generic line for anything not in the table.
const CANCEL_INSTRUCTIONS: Record<string, string> = {
  Netflix: 'netflix.com/youraccount → Cancel Membership',
  Spotify: 'spotify.com/account/subscription → Cancel Premium',
  'Apple iCloud': 'iPhone Settings → Apple ID → Subscriptions → iCloud+',
  'Apple One': 'iPhone Settings → Apple ID → Subscriptions',
  'Apple TV+': 'iPhone Settings → Apple ID → Subscriptions → Apple TV+',
  'Apple Music': 'iPhone Settings → Apple ID → Subscriptions → Apple Music',
  'Amazon Prime': 'amazon.ca → Account → Prime → End Membership',
  'Uber One': 'Uber app → Account → Uber One → Manage',
  'Uber Eats Pass': 'Uber app → Account → Uber One → Manage',
  'Disney+': 'disneyplus.com → Account → Subscription',
  'YouTube Premium': 'youtube.com/paid_memberships',
  'Crave': 'crave.ca → Account → Cancel Subscription',
  'Starbucks Reload': 'Starbucks app → Cards → Auto-Reload → Off',
  'Dropbox': 'dropbox.com/account/plan',
  'Google One': 'one.google.com → Settings → Cancel membership',
  'Adobe Creative Cloud': 'account.adobe.com → Plans → Manage plan',
  'Microsoft 365': 'account.microsoft.com/services',
  'PlayStation Plus': 'PlayStation Console → Settings → Subscriptions',
  'Xbox Game Pass': 'account.microsoft.com → Services & subscriptions',
  'Nintendo Switch Online': 'Nintendo eShop → Account → Subscription',
};

// Italic flavor copy. Specificity makes the cost feel real. Editorial — not
// scraped, not generated. Falls back to nothing rather than something generic.
const FLAVOR: Record<string, string> = {
  Netflix: "queue you stopped finishing",
  Spotify: "one playlist on repeat",
  'Apple iCloud': "photos you don't restore",
  'Apple One': "bundle you keep forgetting you have",
  'Amazon Prime': "free shipping you forget you have",
  'Uber One': "unlocks discounts on takeout",
  'Uber Eats Pass': "unlocks discounts on takeout",
  'Disney+': "rewatching the same shows",
  'YouTube Premium': "no ads · for now",
  'Crave': "Sundays in front of the TV",
  'Starbucks Reload': "auto top-up on your card",
  'Dropbox': "files you haven't opened",
  'Google One': "more storage than you fill",
  'Adobe Creative Cloud': "tools for the project that never starts",
  'PlayStation Plus': "free games you never download",
  'Xbox Game Pass': "library you barely browse",
  'Nintendo Switch Online': "save backups for the console in the drawer",
};

const CAT_VAR: Record<string, string> = {
  income: 'var(--cat-income)',
  essentials: 'var(--cat-essentials)',
  lifestyle: 'var(--cat-lifestyle)',
  indulgence: 'var(--cat-indulgence)',
  savings: 'var(--cat-savings)',
  debt: 'var(--cat-debt)',
};

function fmt(cents: number) {
  return `$${(cents / 100).toLocaleString('en-CA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}
function fmtMoney(cents: number) {
  return `$${(cents / 100).toLocaleString('en-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
function monthlyCents(s: SubscriptionRow): number {
  if (s.cadence_days <= 0) return 0;
  return Math.round((s.amount_cents * 30) / s.cadence_days);
}
function annualCents(s: SubscriptionRow): number {
  if (s.cadence_days <= 0) return 0;
  return Math.round((s.amount_cents * 365) / s.cadence_days);
}
function paidToDateCents(s: SubscriptionRow): number {
  return s.amount_cents * Math.max(1, s.months_running);
}

function rubberStamp(active: boolean, color: string, tilt: number): CSSProperties {
  return {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    padding: '6px 12px',
    border: 'none',
    background: active ? color : 'transparent',
    color: active ? 'var(--color-bg-primary)' : color,
    cursor: 'pointer',
    borderRadius: 2,
    transform: active ? `rotate(${tilt}deg)` : 'rotate(0)',
    boxShadow: active
      ? `inset 0 0 0 1px ${color}, inset 0 0 0 3px var(--color-bg-primary), inset 0 0 0 4px ${color}`
      : `inset 0 0 0 1px ${color}, inset 0 0 0 3px var(--color-bg-card), inset 0 0 0 4px ${color}`,
    transition: 'transform 120ms ease',
  };
}

export default function SubscriptionVerdictLedger({ subs, emptyHint }: Props) {
  const qc = useQueryClient();
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const setVerdict = useMutation({
    mutationFn: (input: { merchant_id: string; verdict: SubscriptionVerdict | null }) =>
      api.post('/api/budget/subscriptions/verdict', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
    },
  });

  const visible = subs.filter((s) => s.verdict !== 'not_a_sub');

  if (visible.length === 0) {
    return (
      <div
        style={{
          ...mono,
          fontSize: 11,
          color: 'var(--color-text-muted)',
          padding: '14px 0',
          letterSpacing: '0.04em',
        }}
      >
        {emptyHint ?? 'Nothing detected · need 6 months of activity'}
      </div>
    );
  }

  const byMonthly = [...visible].sort((a, b) => monthlyCents(b) - monthlyCents(a));
  const totalMonthly = byMonthly.reduce((sum, s) => sum + monthlyCents(s), 0);
  const totalAnnual = totalMonthly * 12;
  const totalPaid = byMonthly.reduce((sum, s) => sum + paidToDateCents(s), 0);
  const longest = byMonthly.reduce(
    (a, s) => (s.months_running > a.months_running ? s : a),
    byMonthly[0]!,
  );
  const newest = byMonthly.reduce(
    (a, s) => (s.months_running < a.months_running ? s : a),
    byMonthly[0]!,
  );
  const biggest = byMonthly[0]!;

  function badgeFor(s: SubscriptionRow): { label: string; color: string } | null {
    if (byMonthly.length >= 2 && s.merchant_id === biggest.merchant_id) {
      return { label: 'biggest', color: 'var(--cat-indulgence)' };
    }
    if (byMonthly.length >= 3 && s.merchant_id === longest.merchant_id && s.months_running >= 12) {
      return { label: `oldest · ${s.months_running} mo`, color: 'var(--color-accent-gold)' };
    }
    if (byMonthly.length >= 3 && s.merchant_id === newest.merchant_id && s.months_running <= 3) {
      return { label: 'fresh', color: 'var(--cat-savings)' };
    }
    return null;
  }

  return (
    <div style={{ marginTop: 12 }}>
      {/* hero */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          alignItems: 'baseline',
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'Fraunces, serif',
              fontWeight: 600,
              fontSize: 48,
              color: 'var(--color-text-primary)',
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em',
            }}
          >
            {fmt(totalAnnual)}
            <span style={{ fontSize: 22, color: 'var(--color-text-muted)' }}>/yr</span>
          </div>
          <div
            style={{
              ...mono,
              fontSize: 11,
              color: 'var(--color-text-muted)',
              marginTop: 8,
              letterSpacing: '0.06em',
            }}
          >
            if you keep all of these. {fmt(totalPaid)} already gone.
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ ...kicker, marginBottom: 2 }}>monthly</div>
          <div
            style={{
              fontFamily: 'Fraunces, serif',
              fontWeight: 500,
              fontSize: 22,
              color: 'var(--color-text-primary)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fmtMoney(totalMonthly)}
          </div>
        </div>
      </div>

      {/* stack viz */}
      <div
        style={{
          marginTop: 14,
          display: 'flex',
          height: 10,
          borderRadius: 1,
          overflow: 'hidden',
          border: '1px solid var(--rule-ink)',
        }}
      >
        {byMonthly.map((s) => (
          <div
            key={s.merchant_id}
            title={`${s.merchant_name} ${fmtMoney(monthlyCents(s))}/mo`}
            style={{
              flex: monthlyCents(s),
              background: CAT_VAR[s.category_group] ?? 'var(--cat-uncategorized)',
              opacity: 0.85,
              borderRight: '1px dashed rgba(0,0,0,0.25)',
            }}
          />
        ))}
      </div>
      <div
        style={{
          ...mono,
          fontSize: 9,
          color: 'var(--color-text-muted)',
          marginTop: 6,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>← biggest</span>
        <span>
          {byMonthly.length} {byMonthly.length === 1 ? 'order' : 'orders'} · color = category
        </span>
      </div>

      {/* rows */}
      <div style={{ marginTop: 18 }}>
        {byMonthly.map((s, i) => (
          <Row
            key={s.merchant_id}
            sub={s}
            isHero={i === 0}
            badge={badgeFor(s)}
            totalMonthly={totalMonthly}
            menuOpen={openMenu === s.merchant_id}
            onToggleMenu={() =>
              setOpenMenu((cur) => (cur === s.merchant_id ? null : s.merchant_id))
            }
            onKeep={() =>
              setVerdict.mutate({
                merchant_id: s.merchant_id,
                verdict: s.verdict === 'keep' ? null : 'keep',
              })
            }
            onKill={() =>
              setVerdict.mutate({
                merchant_id: s.merchant_id,
                verdict: s.verdict === 'kill' ? null : 'kill',
              })
            }
            onNotASub={() =>
              setVerdict.mutate({
                merchant_id: s.merchant_id,
                verdict: 'not_a_sub',
              })
            }
            pending={setVerdict.isPending && setVerdict.variables?.merchant_id === s.merchant_id}
          />
        ))}
      </div>
    </div>
  );
}

interface RowProps {
  sub: SubscriptionRow;
  isHero: boolean;
  badge: { label: string; color: string } | null;
  totalMonthly: number;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onKeep: () => void;
  onKill: () => void;
  onNotASub: () => void;
  pending: boolean;
}

function Row({
  sub: s,
  isHero,
  badge,
  totalMonthly,
  menuOpen,
  onToggleMenu,
  onKeep,
  onKill,
  onNotASub,
  pending,
}: RowProps) {
  const v = s.verdict ?? null;
  const killed = v === 'kill';
  const kept = v === 'keep';
  const monthly = monthlyCents(s);
  const annual = annualCents(s);
  const paid = paidToDateCents(s);
  const sharePct = totalMonthly > 0 ? (monthly / totalMonthly) * 100 : 0;
  const catColor = CAT_VAR[s.category_group] ?? 'var(--cat-uncategorized)';
  const flavor = FLAVOR[s.merchant_name];
  const cancelHelp =
    CANCEL_INSTRUCTIONS[s.merchant_name] ?? 'check your account page on the merchant site';

  const heroBg = isHero
    ? `linear-gradient(180deg, color-mix(in oklab, ${catColor} 14%, transparent) 0%, transparent 100%)`
    : 'transparent';

  return (
    <div
      style={{
        position: 'relative',
        padding: isHero ? '20px 14px 18px 18px' : '16px 4px 14px 14px',
        marginTop: isHero ? 4 : 0,
        marginBottom: isHero ? 14 : 0,
        background: heroBg,
        borderTop: isHero
          ? `1px dashed color-mix(in oklab, ${catColor} 50%, transparent)`
          : 'none',
        borderBottom: isHero
          ? `1px dashed color-mix(in oklab, ${catColor} 50%, transparent)`
          : '1px solid var(--rule-ink)',
        opacity: killed ? 0.55 : pending ? 0.7 : 1,
        transition: 'opacity 200ms ease',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: isHero ? 14 : 12,
          bottom: isHero ? 14 : 12,
          width: 3,
          background: catColor,
          opacity: killed ? 0.4 : 0.85,
        }}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 26px',
          columnGap: 10,
          alignItems: 'baseline',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                color: catColor,
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                lineHeight: 1,
              }}
              aria-label="autopilot"
              title="autopilot"
            >
              ↻
            </span>
            <span
              style={{
                fontFamily: 'Fraunces, serif',
                fontSize: isHero ? 24 : 17,
                color: 'var(--color-text-primary)',
                textDecoration: killed ? 'line-through' : 'none',
                textDecorationThickness: '1px',
                lineHeight: 1.1,
              }}
            >
              {s.merchant_name}
            </span>
            {badge && (
              <span
                style={{
                  ...mono,
                  fontSize: 8,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: badge.color,
                  border: `1px solid ${badge.color}`,
                  padding: '2px 6px',
                  borderRadius: 1,
                }}
              >
                {badge.label}
              </span>
            )}
          </div>
          {flavor && (
            <div
              style={{
                fontFamily: 'Fraunces, serif',
                fontStyle: 'italic',
                fontSize: isHero ? 13 : 11,
                color: 'var(--color-text-muted)',
                marginTop: 4,
                marginLeft: 21,
              }}
            >
              {flavor}
            </div>
          )}
          <div
            style={{
              ...mono,
              fontSize: 10,
              color: 'var(--color-text-muted)',
              marginTop: 6,
              marginLeft: 21,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {fmt(annual)}/yr · {fmt(paid)} paid to date · {s.months_running} mo in
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontFamily: 'Fraunces, serif',
              fontWeight: 600,
              fontSize: isHero ? 36 : 22,
              color: 'var(--color-text-primary)',
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em',
            }}
          >
            {fmtMoney(monthly)}
          </div>
          <div
            style={{
              ...mono,
              fontSize: 9,
              color: 'var(--color-text-muted)',
              marginTop: 4,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            /mo · {sharePct.toFixed(0)}% of bleed
          </div>
        </div>
        <button
          type="button"
          aria-label="more"
          onClick={onToggleMenu}
          style={{
            background: 'transparent',
            border: 'none',
            color: menuOpen ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
            fontSize: 16,
            lineHeight: 1,
            cursor: 'pointer',
            padding: 6,
            margin: -6,
            alignSelf: 'start',
          }}
        >
          ⋯
        </button>
      </div>

      <div
        style={{
          marginTop: 12,
          marginLeft: 21,
          height: 4,
          background: 'var(--rule-ink)',
          position: 'relative',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${sharePct}%`,
            background: catColor,
            opacity: killed ? 0.4 : 0.9,
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          marginTop: 12,
          marginLeft: 21,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={onKeep}
          disabled={pending}
          style={rubberStamp(kept, 'var(--cat-savings)', -1.2)}
        >
          Keep
        </button>
        <button
          type="button"
          onClick={onKill}
          disabled={pending}
          style={rubberStamp(killed, 'var(--cat-indulgence)', 1.4)}
        >
          Kill
        </button>
        {kept && (
          <span
            style={{
              ...mono,
              fontSize: 9,
              color: 'var(--cat-savings)',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              marginLeft: 'auto',
            }}
          >
            kept · revisit next quarter
          </span>
        )}
        {killed && (
          <span
            style={{
              ...mono,
              fontSize: 9,
              color: 'var(--cat-indulgence)',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              marginLeft: 'auto',
            }}
          >
            waiting for next charge
          </span>
        )}
      </div>

      {killed && (
        <div
          style={{
            marginTop: 14,
            marginLeft: 21,
            padding: '10px 14px 11px',
            background: 'var(--color-paper-shade)',
            color: 'var(--color-ink)',
            transform: 'rotate(-0.6deg)',
            boxShadow: '0 8px 18px rgba(0,0,0,0.45), inset 0 -1px 0 rgba(0,0,0,0.06)',
            clipPath:
              'polygon(0 6%, 4% 0, 12% 5%, 22% 1%, 35% 4%, 50% 0, 65% 4%, 78% 0, 90% 4%, 100% 0, 100% 94%, 96% 100%, 86% 96%, 74% 100%, 60% 96%, 46% 100%, 32% 96%, 18% 100%, 8% 96%, 0 100%)',
          }}
        >
          <div
            style={{
              ...mono,
              fontSize: 9,
              color: 'var(--color-ink-muted)',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            cancel here →
          </div>
          <div style={{ ...mono, fontSize: 12, color: 'var(--color-ink)' }}>{cancelHelp}</div>
        </div>
      )}

      {menuOpen && (
        <div
          style={{
            marginTop: 12,
            marginLeft: 21,
            padding: '12px 14px',
            border: '1px solid var(--rule-ink-strong)',
            borderLeft: '3px solid var(--color-text-muted)',
            background: 'color-mix(in oklab, var(--color-bg-primary) 60%, transparent)',
          }}
        >
          <div
            style={{
              ...mono,
              fontSize: 9,
              color: 'var(--color-text-muted)',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            more
          </div>
          <button
            type="button"
            onClick={onNotASub}
            disabled={pending}
            style={{
              ...mono,
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              padding: '5px 10px',
              background: 'transparent',
              color: 'var(--color-text-muted)',
              border: '1px dashed var(--rule-ink-strong)',
              cursor: 'pointer',
            }}
          >
            not a sub
          </button>
          <div
            style={{
              ...mono,
              fontSize: 10,
              color: 'var(--color-text-muted)',
              marginTop: 8,
              letterSpacing: '0.04em',
              lineHeight: 1.5,
            }}
          >
            drops this off the standing-orders tape forever. the merchant keeps its category
            everywhere else.
          </div>
        </div>
      )}
    </div>
  );
}
