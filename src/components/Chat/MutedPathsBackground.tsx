const PATHS = [
  'M-120 170C38 128 118 228 256 208C394 188 458 74 620 90C782 106 866 252 1028 252C1190 252 1264 124 1520 148',
  'M-60 320C122 246 192 404 376 392C560 380 650 220 820 236C990 252 1050 426 1228 434C1406 442 1458 298 1550 270',
  'M-90 478C92 420 204 598 408 588C612 578 690 418 894 414C1098 410 1194 566 1392 562C1590 558 1658 422 1720 386',
  'M-140 644C58 556 214 756 446 754C678 752 738 586 956 596C1174 606 1306 790 1538 776C1770 762 1844 612 1910 560',
  'M-180 822C40 726 230 890 482 888C734 886 854 708 1118 708C1382 708 1510 862 1758 852C2006 842 2108 708 2220 642',
]

export function MutedPathsBackground() {
  return (
    <div className="new-chat-paths" aria-hidden="true">
      <div className="new-chat-paths__glow new-chat-paths__glow--top" />
      <div className="new-chat-paths__glow new-chat-paths__glow--bottom" />
      <svg viewBox="0 0 1440 900" preserveAspectRatio="none">
        {PATHS.map((path, index) => (
          <path
            key={path}
            d={path}
            style={{
              animationDuration: `${18 + index * 2.4}s`,
              animationDelay: `${-index * 1.6}s`,
            }}
          />
        ))}
      </svg>
    </div>
  )
}
