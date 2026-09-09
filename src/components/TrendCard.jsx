import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

function formatMois(mois) {
  if (!mois) return '';
  const [y, m] = mois.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

// size="sm" (defaut) : mini-sparkline compacte, chiffre + courbe cote a cote.
// size="lg" : carte "hero" — chiffre en avant, courbe pleine largeur en dessous,
// pensee pour etre la premiere chose vue sur le dashboard (impact visuel fort).
//
// sparkline attend [{ mois: 'YYYY-MM', value: number }] — le mois voyage avec
// la valeur pour pouvoir etre affiche au survol (sinon le tooltip n'a que
// l'index du point, pas une date lisible).
export default function TrendCard({ label, value, suffix, deltaPct, sparkline, size = 'sm', formatValue }) {
  const positive = deltaPct >= 0;
  const tint = positive ? '#047857' : '#DC2626';
  const data = (sparkline || []).map((d, i) => ({ i, v: d.value, mois: d.mois }));
  const fmt = formatValue || ((v) => `${v}${suffix ? ` ${suffix}` : ''}`);
  // Un id de gradient SVG avec espaces/accents casse silencieusement la
  // reference fill="url(#...)" (fragment invalide) — d'ou le slug.
  const gradientId = `spark-${size}-${label.normalize('NFD').replace(/[^a-zA-Z0-9]+/g, '-')}`;

  const DeltaBadge = typeof deltaPct === 'number' && (
    <div className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: tint }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ transform: positive ? 'none' : 'scaleY(-1)' }}>
        <path d="M4 17L10 11L14 15L20 7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 7H20V13" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {Math.abs(deltaPct).toFixed(0)}% vs période précédente
    </div>
  );

  if (size === 'lg') {
    return (
      <div
        className="dash-card p-5"
        style={{ background: `radial-gradient(220px circle at 100% -15%, ${tint}1A, transparent 65%), linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)` }}
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="text-[13px] font-semibold text-slate-600 tracking-wide">{label}</div>
          {DeltaBadge || (
            <div className="text-[10px] text-slate-300" title="Historique insuffisant sur la période précédente pour une comparaison fiable">
              vs période précédente : n/d
            </div>
          )}
        </div>
        <div className="text-3xl font-bold text-slate-800 tabular-nums tracking-tight mb-2">
          {value}
          {suffix && <span className="text-sm font-normal text-slate-400 ml-1.5">{suffix}</span>}
        </div>
        {data.length > 1 && (
          <div className="h-[130px] -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={tint} stopOpacity={0.32} />
                    <stop offset="100%" stopColor={tint} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="mois" hide />
                <Tooltip
                  cursor={{ stroke: tint, strokeWidth: 1, strokeDasharray: '3 3' }}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E2E8F0' }}
                  labelFormatter={(mois) => formatMois(mois)}
                  formatter={(v) => [fmt(v), label]}
                />
                <Area type="monotone" dataKey="v" stroke={tint} strokeWidth={2.5} fill={`url(#${gradientId})`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="dash-card flex items-center justify-between gap-3 p-4"
      style={{ background: `radial-gradient(160px circle at 100% -20%, ${tint}1A, transparent 65%), linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)` }}
    >
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-slate-500 mb-1">{label}</div>
        <div className="text-xl font-bold text-slate-800 tabular-nums tracking-tight">
          {value}
          {suffix && <span className="text-xs font-normal text-slate-400 ml-1">{suffix}</span>}
        </div>
        {DeltaBadge && <div className="mt-1">{DeltaBadge}</div>}
      </div>
      {data.length > 1 && (
        <div className="w-24 h-12 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={tint} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={tint} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={tint} strokeWidth={2} fill={`url(#${gradientId})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
