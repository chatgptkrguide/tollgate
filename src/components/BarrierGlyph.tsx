interface BarrierGlyphProps {
  size?: number;
}

// The wordmark's glyph: a post with its lamp and a striped arm. Decorative; the word beside it names the product.
export function BarrierGlyph({ size = 22 }: BarrierGlyphProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} className="shrink-0">
      <defs>
        <clipPath id="tg-arm">
          <rect x="6" y="9" width="17" height="5" rx="1.5" />
        </clipPath>
      </defs>
      <rect x="2" y="7" width="4" height="15" rx="1" fill="#12161F" />
      <circle cx="4" cy="4" r="2" fill="#D9480F" />
      <g clipPath="url(#tg-arm)">
        <rect x="6" y="9" width="17" height="5" fill="#12161F" />
        <path d="M9 9l-3 5h3l3-5zM15 9l-3 5h3l3-5zM21 9l-3 5h3l3-5z" fill="#fff" />
      </g>
      <rect x="6" y="9" width="17" height="5" rx="1.5" fill="none" stroke="#12161F" strokeWidth="1" />
    </svg>
  );
}
