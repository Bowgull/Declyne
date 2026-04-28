export default function PaymentLinkMockup() {
  return (
    <div style={{
      minHeight: '100vh',
      padding: '24px 16px 48px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      background: '#1a141d',
      fontFamily: "'Geist Mono', ui-monospace, monospace",
      WebkitFontSmoothing: 'antialiased',
    }}>
      <div style={{
        fontFamily: "'Geist Mono', ui-monospace, monospace",
        fontSize: 10,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.55)',
        marginBottom: 24,
      }}>
        declyne &middot; payment request
      </div>

      <div style={{
        width: '100%',
        maxWidth: 380,
        padding: '28px 24px 24px',
        background: '#f2ece0',
        color: '#1a141d',
        position: 'relative',
        boxShadow: '0 14px 28px rgba(0,0,0,0.35), 0 4px 8px rgba(0,0,0,0.25)',
      }}>
        {/* torn top edge */}
        <div style={{
          position: 'absolute',
          left: -1, right: -1, top: -10, height: 10,
          background: '#1a141d',
          WebkitMaskImage: 'radial-gradient(circle at 4px 50%, transparent 3px, #000 3.5px)',
          WebkitMaskSize: '8px 10px',
          maskImage: 'radial-gradient(circle at 4px 50%, transparent 3px, #000 3.5px)',
          maskSize: '8px 10px',
        }} />

        {/* header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: "'Geist Mono'", fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#6b6470', marginBottom: 4 }}>from</div>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, fontWeight: 600, lineHeight: 1, color: '#1a141d', margin: '4px 0 2px' }}>Bowgull</div>
            <div style={{ fontFamily: "'Geist Mono'", fontSize: 11, color: '#6b6470' }}>2026-04-15</div>
          </div>
          <img
            style={{ width: 64, height: 64, opacity: 0.88, marginTop: 2, objectFit: 'contain' }}
            src="https://declyne-api.bocas-joshua.workers.dev/brand/mascot-head.png"
            alt=""
            aria-hidden="true"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>

        {/* perf */}
        <div style={{ borderTop: '1px dashed rgba(26,20,29,0.18)', margin: '20px 0' }} />

        {/* amount */}
        <div style={{ fontFamily: "'Geist Mono'", fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#6b6470', marginBottom: 6 }}>amount owing</div>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 600, fontSize: 44, lineHeight: 1, letterSpacing: '-0.02em', color: '#1a141d', marginBottom: 4, fontVariantNumeric: 'tabular-nums' }}>
          $47.50<span style={{ fontSize: 18, marginLeft: 4, opacity: 0.5 }}>CAD</span>
        </div>
        <div style={{ fontFamily: "'Geist Mono'", fontSize: 11, color: '#6b6470', marginBottom: 24 }}>lady marmalade brunch &middot; apr 15</div>

        {/* perf */}
        <div style={{ borderTop: '1px dashed rgba(26,20,29,0.18)', margin: '20px 0' }} />

        {/* instructions */}
        <div style={{ fontFamily: "'Geist Mono'", fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#6b6470', marginBottom: 12 }}>send via interac e-transfer</div>

        {/* email row */}
        {(['email', 'amount', 'security answer'] as const).map((label, i) => {
          const values = ['bocas.joshua@gmail.com', '47.50', 'golden turtle'];
          return (
            <div key={label} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px dashed rgba(26,20,29,0.18)',
              ...(i === 2 ? { borderBottom: '1px dashed rgba(26,20,29,0.18)', marginBottom: 24 } : {}),
              padding: '10px 0',
            }}>
              <div>
                <div style={{ fontFamily: "'Geist Mono'", fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#6b6470', marginBottom: 2 }}>{label}</div>
                <div style={{ fontFamily: "'Geist Mono'", fontSize: 13, color: '#1a141d' }}>{values[i]}</div>
              </div>
              <button style={{
                fontFamily: "'Geist Mono'",
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                background: '#f2ece0',
                color: '#1a141d',
                border: 'none',
                borderRadius: 2,
                padding: '8px 12px',
                minWidth: 64,
                boxShadow: 'inset 0 0 0 1px rgba(26,20,29,0.55), inset 0 0 0 3px #f2ece0, inset 0 0 0 4px rgba(26,20,29,0.55)',
                transform: 'rotate(-0.6deg)',
                cursor: 'pointer',
              }}>copy</button>
            </div>
          );
        })}

        <p style={{ fontFamily: "'Geist Mono'", fontSize: 11, lineHeight: 1.6, color: '#6b6470', margin: 0 }}>
          Open your bank app, send via Interac e-Transfer, paste these in.
        </p>

        {/* footer */}
        <div style={{ marginTop: 28, textAlign: 'center', fontFamily: "'Geist Mono'", fontSize: 10, letterSpacing: '0.18em', color: '#6b6470', opacity: 0.6 }}>
          ** sent via <span style={{ color: '#9e78b9', fontWeight: 600 }}>D</span>eclyne **
        </div>

        {/* torn bottom edge */}
        <div style={{
          position: 'absolute',
          left: -1, right: -1, bottom: -10, height: 10,
          background: '#1a141d',
          WebkitMaskImage: 'radial-gradient(circle at 4px 50%, transparent 3px, #000 3.5px)',
          WebkitMaskSize: '8px 10px',
          maskImage: 'radial-gradient(circle at 4px 50%, transparent 3px, #000 3.5px)',
          maskSize: '8px 10px',
          transform: 'scaleY(-1)',
        }} />
      </div>

      <div style={{
        marginTop: 16,
        fontFamily: "'Geist Mono'",
        fontSize: 10,
        color: 'rgba(255,255,255,0.4)',
        textAlign: 'center',
        maxWidth: 320,
        lineHeight: 1.6,
      }}>
        This link expires in 90 days. Once the transfer is received, it marks automatically.
      </div>
    </div>
  );
}
