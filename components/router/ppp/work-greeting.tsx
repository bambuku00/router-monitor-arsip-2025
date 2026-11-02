export default function PppWorkGreeting() {
  return (
    <div className="ppp-mascot-slot" aria-hidden>
      <style>{`
        .ppp-mascot-slot {
          --mascot-body: oklch(72% 0.16 40);
          --mascot-blush: oklch(80% 0.12 20);
          --mascot-ink: oklch(25% 0.05 40);
          --mascot-shine: oklch(99% 0 0);
          pointer-events: none;
          position: absolute;
          top: 0;
          left: 1.5rem;
          right: 1.5rem;
          height: 22px;
          display: flex;
          justify-content: flex-start;
          align-items: flex-start;
          overflow: hidden;
        }
        .ppp-mascot {
          position: absolute;
          top: 0;
          left: 0;
          width: 32px;
          height: 22px;
          margin: 0;
          animation: ppp-mascot-relocate 30s linear infinite;
        }
        .ppp-mascot--next {
          --mascot-body: oklch(68% 0.12 220);
          --mascot-blush: oklch(80% 0.1 10);
          animation-delay: -15s;
        }
        .ppp-mascot--next .ppp-mascot-head,
        .ppp-mascot--next .ppp-mascot-jumper,
        .ppp-mascot--next .ppp-mascot-hands,
        .ppp-mascot--next .ppp-mascot-eyes {
          animation-delay: -15s;
        }
        .ppp-mascot-head {
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          z-index: 1;
          animation: ppp-mascot-head 30s ease-in-out infinite;
        }
        .ppp-mascot-jumper {
          transform-origin: 50% 100%;
          animation: ppp-mascot-wiggle 30s ease-in-out infinite;
        }
        .ppp-mascot-hands {
          position: absolute;
          left: 1px;
          right: 1px;
          bottom: 5px;
          z-index: 3;
          height: 6px;
          animation: ppp-mascot-hands 30s ease-in-out infinite;
        }
        .ppp-mascot-svg {
          width: 100%;
          height: auto;
          display: block;
        }
        .ppp-mascot-eyes {
          transform-origin: 60px 54px;
          animation: ppp-mascot-eyes 30s ease-in-out infinite;
        }
        .ppp-mascot-shadow {
          background: oklch(0.5 0.1 40 / 0.18);
          border-radius: 999px;
          width: 40px;
          height: 8px;
          margin-top: 3px;
        }
        @keyframes ppp-mascot-hands {
          0%, 2% { transform: translateY(10px); }
          6%, 18% { transform: translateY(0); }
          22%, 32% { transform: translateY(10px); }
          36%, 48% { transform: translateY(0); }
          52%, 62% { transform: translateY(10px); }
          66%, 78% { transform: translateY(0); }
          82%, 100% { transform: translateY(10px); }
        }
        @keyframes ppp-mascot-head {
          0%, 8% { transform: translateY(24px); }
          14%, 16% { transform: translateY(-4px); }
          17% { transform: translateY(-6px); }
          18% { transform: translateY(-4px); }
          22% { transform: translateY(24px); }
          26%, 28% { transform: translateY(7px); }
          30% { transform: translateY(9px); }
          32% { transform: translateY(7px); }
          40%, 46% { transform: translateY(-4px); }
          47% { transform: translateY(-6px); }
          48% { transform: translateY(-4px); }
          52% { transform: translateY(24px); }
          56%, 58% { transform: translateY(7px); }
          60% { transform: translateY(9px); }
          62% { transform: translateY(7px); }
          70%, 76% { transform: translateY(-4px); }
          77% { transform: translateY(-6px); }
          78% { transform: translateY(-4px); }
          82%, 100% { transform: translateY(24px); }
        }
        @keyframes ppp-mascot-relocate {
          0%, 24% { margin-left: 0; }
          34%, 52% { margin-left: 33%; }
          64%, 82% { margin-left: 66%; }
          100% { margin-left: 0; }
        }
        @keyframes ppp-mascot-wiggle {
          0%, 12% { transform: rotate(0deg); }
          15% { transform: rotate(-3deg); }
          17% { transform: rotate(3deg); }
          20%, 38% { transform: rotate(0deg); }
          42% { transform: rotate(-3deg); }
          45% { transform: rotate(3deg); }
          48%, 68% { transform: rotate(0deg); }
          72% { transform: rotate(-3deg); }
          75% { transform: rotate(3deg); }
          78%, 100% { transform: rotate(0deg); }
        }
        @keyframes ppp-mascot-eyes {
          0%, 12% { transform: translate(0); }
          15% { transform: translate(-2px) scaleY(0.08); }
          16%, 38% { transform: translate(0) scaleY(1); }
          42% { transform: translate(2px); }
          45% { transform: translate(2px) scaleY(0.08); }
          46%, 68% { transform: translate(0) scaleY(1); }
          72% { transform: translate(-2px); }
          75% { transform: translate(-2px) scaleY(0.08); }
          78%, 100% { transform: translate(0) scaleY(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ppp-mascot,
          .ppp-mascot-head,
          .ppp-mascot-hands,
          .ppp-mascot-jumper,
          .ppp-mascot-eyes {
            animation: none;
          }
          .ppp-mascot { margin-left: 0; }
          .ppp-mascot-head { transform: none; }
          .ppp-mascot-hands { transform: none; }
        }
      `}</style>
      <div className="ppp-mascot">
        <MascotBody />
      </div>
      <div className="ppp-mascot ppp-mascot--next">
        <MascotBody />
      </div>
    </div>
  );
}

function MascotBody() {
  return (
    <>
        <div className="ppp-mascot-head">
        <div className="ppp-mascot-jumper">
          <svg viewBox="0 0 120 110" className="ppp-mascot-svg" aria-hidden>
            <path d="M30 34 C24 12, 40 8, 46 26 Z" fill="var(--mascot-body)" />
            <path d="M90 34 C96 12, 80 8, 74 26 Z" fill="var(--mascot-body)" />
            <ellipse cx="42" cy="98" rx="12" ry="8" fill="var(--mascot-body)" />
            <ellipse cx="78" cy="98" rx="12" ry="8" fill="var(--mascot-body)" />
            <ellipse cx="60" cy="62" rx="42" ry="40" fill="var(--mascot-body)" />
            <circle cx="34" cy="66" r="7" fill="var(--mascot-blush)" />
            <circle cx="86" cy="66" r="7" fill="var(--mascot-blush)" />
            <g className="ppp-mascot-eyes">
              <circle cx="45" cy="54" r="6" fill="var(--mascot-ink)" />
              <circle cx="75" cy="54" r="6" fill="var(--mascot-ink)" />
              <circle cx="47" cy="52" r="2" fill="var(--mascot-shine)" />
              <circle cx="77" cy="52" r="2" fill="var(--mascot-shine)" />
            </g>
            <path
              d="M52 68 Q60 76 68 68"
              stroke="var(--mascot-ink)"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </div>
        </div>
        <svg viewBox="0 0 84 22" className="ppp-mascot-hands" aria-hidden>
          <ellipse cx="14" cy="8" rx="3.1" ry="4.2" fill="var(--mascot-body)" />
          <ellipse cx="20" cy="6" rx="3" ry="4.4" fill="var(--mascot-body)" />
          <ellipse cx="26" cy="8" rx="2.8" ry="3.8" fill="var(--mascot-body)" />
          <ellipse cx="20" cy="14" rx="13" ry="7" fill="var(--mascot-body)" />
          <ellipse cx="58" cy="8" rx="2.8" ry="3.8" fill="var(--mascot-body)" />
          <ellipse cx="64" cy="6" rx="3" ry="4.4" fill="var(--mascot-body)" />
          <ellipse cx="70" cy="8" rx="3.1" ry="4.2" fill="var(--mascot-body)" />
          <ellipse cx="64" cy="14" rx="13" ry="7" fill="var(--mascot-body)" />
        </svg>
    </>
  );
}
