export default function GameSymbol({ type, className = "" }) {
  if (type === "estimate") return <span aria-hidden="true" className={`game-symbol game-symbol--estimate ${className}`}>≈</span>;
  if (type === "pixel") return <span aria-hidden="true" className={`game-symbol game-symbol--pixel ${className}`}>{Array.from({ length: 9 }, (_, i) => <i key={i} />)}</span>;
  if (type === "test") return <span aria-hidden="true" className={`game-symbol game-symbol--test ${className}`}>›_</span>;
  return (
    <svg aria-hidden="true" className={`game-symbol ${className}`} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {type === "whois" && <><circle cx="24" cy="16" r="8" fill="currentColor" stroke="none" /><path d="M9 40c0-11 6-16 15-16s15 5 15 16" fill="currentColor" stroke="none" /></>}
      {type === "whatis" && <><path d="M15 15c0-11 20-11 20 0 0 7-11 8-11 15" /><circle cx="24" cy="38" r="1.5" fill="currentColor" /></>}
      {type === "slf" && <><circle cx="24" cy="24" r="18" /><ellipse cx="24" cy="24" rx="8" ry="18" /><path d="M7 18h34M7 30h34" /></>}
      {type === "imposter" && <><path d="M7 14l17-5 17 5v13c0 8-10 13-17 16C17 40 7 35 7 27Z" /><path d="m13 23 8 2m14-2-8 2M19 34h10" /></>}
      {type === "drinking" && <><path d="M8 9h32L24 28Zm16 19v13m-9 0h18M29 9l6-6" /><path d="M13 15h22" /></>}
    </svg>
  );
}
