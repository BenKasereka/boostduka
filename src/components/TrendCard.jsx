import { AreaChart, Area, ResponsiveContainer } from 'recharts';

export default function TrendCard({ label, value, suffix, deltaPct, sparkline }) {
  const positive = deltaPct >= 0;
  const tint = positive ? '#047857' : '#DC2626';
  const data = (sparkline || []).map((v, i) => ({ i, v }));

  return (
    <div className="flex items-center justify-between gap-3 bg-white rounded-2xl border border-slate-100 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-slate-500 mb-1">{label}</div>
        <div className="text-xl font-bold text-slate-800 tabular-nums tracking-tight">
          {value}
          {suffix && <span className="text-xs font-normal text-slate-400 ml-1">{suffix}</span>}
        </div>
        {typeof deltaPct === 'number' && (
          <div className="flex items-center gap-1 mt-1 text-[11px] font-semibold" style={{ color: tint }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ transform: positive ? 'none' : 'scaleY(-1)' }}>
              <path d="M4 17L10 11L14 15L20 7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 7H20V13" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {Math.abs(deltaPct).toFixed(0)}% vs période précédente
          </div>
        )}
      </div>
      {data.length > 1 && (
        <div className="w-24 h-12 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={tint} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={tint} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={tint} strokeWidth={2} fill={`url(#spark-${label})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
