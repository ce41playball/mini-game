export function PatisserieTitleLockup() {
  return (
    <div className="flex flex-col items-center text-center select-none">
      <svg
        viewBox="0 0 320 132"
        className="w-[290px] sm:w-[310px] h-auto drop-shadow-[0_2px_8px_rgba(45,30,24,0.08)]"
        role="img"
        aria-label="Pâtisserie Stack 法式甜點疊疊樂"
      >
        {/* Delicate ornamental divider with playfully crooked tiered cake crest */}
        <g transform="translate(160, 22)">
          <line x1="-88" y1="0" x2="-28" y2="0" stroke="#C79646" strokeWidth="1.2" strokeOpacity="0.7" />
          <line x1="28" y1="0" x2="88" y2="0" stroke="#C79646" strokeWidth="1.2" strokeOpacity="0.7" />
          {/* Crooked 3-tier cake crest */}
          <g transform="translate(-1, 1) rotate(-3.5)">
            <rect x="-15" y="-3.5" width="30" height="7" rx="2" fill="#D94E67" />
          </g>
          <g transform="translate(3.5, -5.5) rotate(5.5)">
            <rect x="-11" y="-3" width="22" height="6" rx="2" fill="#F3D19C" />
          </g>
          <g transform="translate(-2.5, -11.5) rotate(-7.5)">
            <rect x="-7.5" y="-2.5" width="15" height="5" rx="1.5" fill="#FFF9F4" stroke="#D94E67" strokeWidth="1" />
            <circle cx="1.2" cy="-5.2" r="2.4" fill="#D94E67" />
          </g>
        </g>

        {/* French subtitle in Playfair Display */}
        <text
          x="160"
          y="50"
          textAnchor="middle"
          fill="#8C5B3C"
          fontSize="13"
          fontWeight="700"
          letterSpacing="3.8"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          PÂTISSERIE STACK
        </text>

        {/* Main Traditional Chinese Lockup */}
        <text
          x="160"
          y="96"
          textAnchor="middle"
          fill="#2D1E18"
          fontSize="36"
          fontWeight="900"
          letterSpacing="2"
          style={{ fontFamily: "'Noto Sans TC', sans-serif" }}
        >
          法式甜點疊疊樂
        </text>

        {/* Warm gold underline flourish */}
        <path
          d="M 78 112 Q 160 120 242 112"
          fill="none"
          stroke="#D94E67"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeOpacity="0.8"
        />
      </svg>
    </div>
  );
}
