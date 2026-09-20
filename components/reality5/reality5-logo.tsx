export function Reality5Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className ?? "size-8"}
      role="img"
      aria-label="Reality5"
    >
      <rect width="32" height="32" rx="6" fill="oklch(0.2 0.03 258)" />
      <circle
        cx="16"
        cy="16"
        r="9.5"
        fill="none"
        stroke="var(--tactical)"
        strokeWidth="1.6"
      />
      <path
        d="M6.5 16h19M16 6.5c-3.6 3-3.6 16 0 19M16 6.5c3.6 3 3.6 16 0 19"
        fill="none"
        stroke="var(--tactical)"
        strokeWidth="1.1"
        strokeOpacity="0.7"
      />
      <text
        x="16"
        y="20.2"
        textAnchor="middle"
        fontSize="12"
        fontWeight="800"
        fontFamily="var(--font-mono)"
        fill="oklch(0.98 0 0)"
      >
        5
      </text>
    </svg>
  )
}
