// Icônes minimalistes (trait, style feather-icons), sans dépendance externe.
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
};

export function IconClock(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

export function IconCheckCircle(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 5-5" />
    </svg>
  );
}

export function IconTag(props) {
  return (
    <svg {...base} {...props}>
      <path d="M20 12.5L12.5 20a1.5 1.5 0 01-2.12 0l-6.38-6.38a1.5 1.5 0 010-2.12L11.5 4H19a1 1 0 011 1v7.5z" />
      <circle cx="15" cy="9" r="1.4" />
    </svg>
  );
}

export function IconWallet(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 7a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
      <path d="M16 12h3v3h-3a1.5 1.5 0 010-3z" />
    </svg>
  );
}

export function IconFileCheck(props) {
  return (
    <svg {...base} {...props}>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M9.5 13l2 2 3.5-3.5" />
    </svg>
  );
}

export function IconUsers(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20a5.5 5.5 0 0111 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15.5 13.2A5 5 0 0121 20" />
    </svg>
  );
}
