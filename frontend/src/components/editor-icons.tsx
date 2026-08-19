/** Toolbar glyphs for the compose rich-text editor, matching the Figma toolbar row. */
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

interface IconProps {
  className?: string;
}

export function UndoIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...stroke}>
      <path d="M4 8h10a5 5 0 010 10h-4" />
      <path d="M7 5L4 8l3 3" />
    </svg>
  );
}

export function RedoIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...stroke}>
      <path d="M20 8H10a5 5 0 000 10h4" />
      <path d="M17 5l3 3-3 3" />
    </svg>
  );
}

export function FontSizeIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...stroke}>
      <path d="M3 7V5h8v2M7 5v14" />
      <path d="M13 12v-1.5h6V12M16 10.5V19" />
    </svg>
  );
}

export function BoldIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 5h6a3.5 3.5 0 010 7H7zM7 12h7a3.5 3.5 0 010 7H7z" strokeLinejoin="round" />
    </svg>
  );
}

export function ItalicIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...stroke}>
      <path d="M15 5h-5M14 19H9M14 5l-4 14" />
    </svg>
  );
}

export function UnderlineIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...stroke}>
      <path d="M7 4v6a5 5 0 0010 0V4M5 20h14" />
    </svg>
  );
}

export function AlignIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...stroke}>
      <path d="M4 6h16M4 10h10M4 14h16M4 18h10" />
    </svg>
  );
}

export function LineHeightIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...stroke}>
      <path d="M10 6h10M10 12h10M10 18h10" />
      <path d="M5 4v16M3 6l2-2 2 2M3 18l2 2 2-2" />
    </svg>
  );
}

export function OrderedListIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...stroke}>
      <path d="M10 6h10M10 12h10M10 18h10" />
      <path d="M4 5.5h1V9M4 15h2v1.5H4V19h2" />
    </svg>
  );
}

export function BulletListIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...stroke}>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="5" cy="6" r="1.1" fill="currentColor" />
      <circle cx="5" cy="12" r="1.1" fill="currentColor" />
      <circle cx="5" cy="18" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function IndentIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...stroke}>
      <path d="M10 6h10M10 12h10M10 18h10" />
      <path d="M3 9l3 3-3 3" />
    </svg>
  );
}

export function OutdentIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...stroke}>
      <path d="M10 6h10M10 12h10M10 18h10" />
      <path d="M6 9l-3 3 3 3" />
    </svg>
  );
}

export function QuoteIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...stroke}>
      <path d="M7 15c-1.7 0-3-1.3-3-3s1.3-3 3-3 3 1.3 3 3c0 3-2 5-4.5 6" />
      <path d="M17 15c-1.7 0-3-1.3-3-3s1.3-3 3-3 3 1.3 3 3c0 3-2 5-4.5 6" />
    </svg>
  );
}

export function StrikethroughIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...stroke}>
      <path d="M4 12h16" />
      <path d="M16 7.5C15.4 6 13.9 5 12 5c-2.2 0-4 1.2-4 3s1.8 2.6 4 3M8 16.5c.6 1.5 2.1 2.5 4 2.5 2.2 0 4-1.2 4-3" />
    </svg>
  );
}
