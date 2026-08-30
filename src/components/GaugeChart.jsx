const SIZE = { w: 220, h: 130, cx: 110, cy: 112, r: 92, stroke: 16 };

function polarPoint(cx, cy, r, angleDeg) {
  const rad = (Math.PI / 180) * angleDeg;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function arcPath(cx, cy, r, startDeg, endDeg) {
  const start = polarPoint(cx, cy, r, startDeg);
  const end = polarPoint(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export default function GaugeChart({ value, gradientFrom = '#047857', gradientTo = '#1E3A8A', id = 'gauge' }) {
  const clamped = Math.max(0, Math.min(100, value));
  const angle = 180 - (clamped / 100) * 180; // 180deg (left) -> 0deg (right)
  const needleAngle = angle;
  const needleTip = polarPoint(SIZE.cx, SIZE.cy, SIZE.r - SIZE.stroke - 6, needleAngle);
  const arcLen = Math.PI * SIZE.r;
  const gradId = `gaugeGrad-${id}`;

  return (
    <svg viewBox={`0 0 ${SIZE.w} ${SIZE.h}`} className="w-full h-auto overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={gradientFrom} />
          <stop offset="100%" stopColor={gradientTo} />
        </linearGradient>
      </defs>
      <path
        d={arcPath(SIZE.cx, SIZE.cy, SIZE.r, 180, 0)}
        fill="none"
        stroke="#eef1f6"
        strokeWidth={SIZE.stroke}
        strokeLinecap="round"
      />
      <path
        d={arcPath(SIZE.cx, SIZE.cy, SIZE.r, 180, 0)}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={SIZE.stroke}
        strokeLinecap="round"
        strokeDasharray={arcLen}
        strokeDashoffset={arcLen * (1 - clamped / 100)}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <line
        x1={SIZE.cx}
        y1={SIZE.cy}
        x2={needleTip.x}
        y2={needleTip.y}
        stroke="#0f172a"
        strokeWidth={3}
        strokeLinecap="round"
        style={{ transition: 'all 0.6s ease' }}
      />
      <circle cx={SIZE.cx} cy={SIZE.cy} r={7} fill="#0f172a" />
      <circle cx={SIZE.cx} cy={SIZE.cy} r={3} fill="white" />
    </svg>
  );
}
