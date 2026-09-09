const BADGE_STYLES = {
  marine: { gradient: 'linear-gradient(135deg, #3B5FC0 0%, #1E3A8A 60%, #172C68 100%)', shadow: 'rgba(30,58,138,0.38)', glow: 'rgba(30,58,138,0.14)' },
  emeraude: { gradient: 'linear-gradient(135deg, #0E9A72 0%, #047857 60%, #035C43 100%)', shadow: 'rgba(4,120,87,0.36)', glow: 'rgba(4,120,87,0.14)' },
  or: { gradient: 'linear-gradient(135deg, #D97A1F 0%, #B45309 60%, #8A3F07 100%)', shadow: 'rgba(180,83,9,0.36)', glow: 'rgba(180,83,9,0.14)' },
  rouge: { gradient: 'linear-gradient(135deg, #F87171 0%, #DC2626 60%, #B91C1C 100%)', shadow: 'rgba(220,38,38,0.34)', glow: 'rgba(220,38,38,0.14)' },
  noir: { gradient: 'linear-gradient(135deg, #334155 0%, #0F172A 65%, #020617 100%)', shadow: 'rgba(15,23,42,0.4)', glow: 'rgba(15,23,42,0.12)' },
};

export default function KpiCard({ icon: Icon, color = 'marine', label, value, suffix, hint }) {
  const badge = BADGE_STYLES[color] || BADGE_STYLES.marine;
  return (
    <div
      className="dash-card group relative flex items-center gap-3.5 p-4 transition-all duration-200 hover:shadow-[0_12px_28px_-8px_rgba(15,23,42,0.14)] hover:-translate-y-0.5 overflow-hidden"
      style={{ background: `radial-gradient(180px circle at 100% -20%, ${badge.glow}, transparent 65%), linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)` }}
    >
      {Icon && (
        <div
          className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-white"
          style={{ background: badge.gradient, boxShadow: `0 8px 16px -4px ${badge.shadow}` }}
        >
          <Icon className="w-5 h-5" strokeWidth={2} />
        </div>
      )}
      <div className="min-w-0">
        <div className="text-lg font-bold text-slate-800 tabular-nums leading-snug tracking-tight">
          {value}
          {suffix && <span className="text-xs font-medium text-slate-400 ml-1">{suffix}</span>}
        </div>
        <div className="text-[12px] font-medium text-slate-500 leading-tight">{label}</div>
        {hint && <div className="text-[10px] text-slate-400 mt-0.5">{hint}</div>}
      </div>
    </div>
  );
}
