export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="31" fill="#0f1c1f" stroke="#f97316" strokeWidth="2" />
      <circle cx="32" cy="32" r="24" fill="#c0392b" />
      <circle cx="32" cy="32" r="20" fill="#e8dcc0" />
      <circle cx="32" cy="32" r="14" fill="#1e7a4c" />
      <circle cx="32" cy="32" r="10" fill="#e8dcc0" />
      <circle cx="32" cy="32" r="5" fill="#1e7a4c" />
      <circle cx="32" cy="32" r="2.5" fill="#c0392b" />
      <path d="M52 10 L35 29" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
      <path d="M52 10 l2 -6 M52 10 l6 -2" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
