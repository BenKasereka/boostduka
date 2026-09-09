import { useEffect, useMemo, useState } from 'react';
import { listSections, listProvinces, listCategories } from '../lib/dataSource';
import { computeKpis } from '../lib/kpis';
import KpiCard from '../components/KpiCard';
import TrendCard from '../components/TrendCard';
import DonutChart from '../components/DonutChart';
import GaugeChart from '../components/GaugeChart';
import { IconClock, IconCheckCircle, IconTag, IconWallet, IconFileCheck, IconUsers } from '../components/icons';

const MARINE = '#1E3A8A';
const EMERAUDE = '#047857';
const OR = '#B45309';
const ROUGE = '#DC2626';

const MARINE_RAMP = ['#0F1C42', '#172C68', '#1E3A8A', '#3B5FC0', '#A9BCE8'];
const CATEGORIE_RAMP = ['#172C68', '#3B5FC0', '#047857', '#B45309', '#CBD5E1'];

function fmtPct(v) {
  return `${v.toFixed(1)}%`;
}
function fmtUsd(v) {
  return `$${Math.round(v).toLocaleString('fr-FR')}`;
}
function fmtUsdShort(v) {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(0)}k`;
  return `$${Math.round(v)}`;
}

function Panel({ title, subtitle, action, children, className = '' }) {
  return (
    <div
      className={`dash-card p-5 ${className}`}
      style={{ background: `radial-gradient(220px circle at 100% -20%, rgba(30,58,138,0.05), transparent 65%), linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)` }}
    >
      <div className="flex items-start justify-between mb-4 gap-3">
        <div>
          <h3 className="text-[13px] font-semibold text-slate-800 tracking-wide">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function LegendRow({ color, label, value, sub }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
        <span className="text-[12px] text-slate-600 truncate">{label}</span>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[12px] font-semibold text-slate-800 tabular-nums">{value}</div>
        {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
      </div>
    </div>
  );
}

function ProgressRow({ label, value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between text-[12px] mb-1.5">
        <span className="text-slate-600 truncate pr-2">{label}</span>
        <span className="font-semibold text-slate-800 tabular-nums shrink-0">{value}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${MARINE} 0%, #3B5FC0 100%)` }}
        />
      </div>
    </div>
  );
}

const PERIOD_PRESETS = [
  { key: 'all', label: '12 derniers mois', months: 12 },
  { key: '6m', label: '6 derniers mois', months: 6 },
  { key: '3m', label: '3 derniers mois', months: 3 },
];

function shiftedRange(dateFrom, dateTo) {
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  const durationMs = to - from;
  const prevTo = new Date(from.getTime() - 24 * 60 * 60 * 1000);
  const prevFrom = new Date(prevTo.getTime() - durationMs);
  return { dateFrom: prevFrom.toISOString().slice(0, 10), dateTo: prevTo.toISOString().slice(0, 10) };
}

// Ratio minimum (echantillon periode precedente / periode courante) en-dessous
// duquel une comparaison n'a pas de sens statistique : le dataset ne couvre
// qu'une fenetre glissante de ~12 mois, donc la "periode precedente" du
// filtre par defaut (12 derniers mois) tombe presque entierement avant le
// debut reel des donnees (quelques dizaines de commandes contre plusieurs
// centaines) — un delta calcule sur un si petit echantillon serait trompeur
// plutot qu'informatif (ex: +16900% releve sur un cout evite cumulatif).
const MIN_ECHANTILLON_RATIO = 0.25;

function improvementPct(current, previous, higherIsBetter, { curSample, prevSample } = {}) {
  if (!previous) return null;
  if (curSample != null && prevSample != null && prevSample < curSample * MIN_ECHANTILLON_RATIO) return null;
  const raw = ((current - previous) / previous) * 100;
  return higherIsBetter ? raw : -raw;
}

export default function Dashboard() {
  const [sections, setSections] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [categories, setCategories] = useState([]);

  const [sectionId, setSectionId] = useState('');
  const [provinceId, setProvinceId] = useState('');
  const [categorieId, setCategorieId] = useState('');
  const [period, setPeriod] = useState('all');

  const [kpis, setKpis] = useState(null);
  const [prevKpis, setPrevKpis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listSections(), listProvinces(), listCategories()]).then(([s, p, c]) => {
      setSections(s);
      setProvinces(p);
      setCategories(c);
    });
  }, []);

  const dateRange = useMemo(() => {
    const preset = PERIOD_PRESETS.find((p) => p.key === period);
    const today = new Date();
    const from = new Date(today);
    from.setMonth(from.getMonth() - preset.months);
    return { dateFrom: from.toISOString().slice(0, 10), dateTo: today.toISOString().slice(0, 10) };
  }, [period]);

  useEffect(() => {
    setLoading(true);
    const filters = {
      sectionId: sectionId || undefined,
      provinceId: provinceId ? Number(provinceId) : undefined,
      categorieId: categorieId ? Number(categorieId) : undefined,
    };
    const prevRange = shiftedRange(dateRange.dateFrom, dateRange.dateTo);
    Promise.all([
      computeKpis({ ...filters, ...dateRange }),
      computeKpis({ ...filters, ...prevRange }),
    ])
      .then(([cur, prev]) => {
        setKpis(cur);
        setPrevKpis(prev);
      })
      .finally(() => setLoading(false));
  }, [sectionId, provinceId, categorieId, dateRange]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard KPI Procurement</h1>
        <p className="text-sm text-slate-300 mt-1">Needs Assessment → Sourcing → Award/CBA → Contrats-cadres → Livraison → Performance → Financier</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Section / base</label>
          <select className="input-field" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            <option value="">Toutes les sections</option>
            {sections.map((s) => (<option key={s.id} value={s.id}>{s.nom_base}</option>))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Province (fournisseurs)</label>
          <select className="input-field" value={provinceId} onChange={(e) => setProvinceId(e.target.value)}>
            <option value="">Toutes les provinces</option>
            {provinces.map((p) => (<option key={p.id} value={p.id}>{p.nom_province}</option>))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Catégorie</label>
          <select className="input-field" value={categorieId} onChange={(e) => setCategorieId(e.target.value)}>
            <option value="">Toutes les catégories</option>
            {categories.map((c) => (<option key={c.id} value={c.id}>{c.nom_categorie}</option>))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Période</label>
          <select className="input-field" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIOD_PRESETS.map((p) => (<option key={p.key} value={p.key}>{p.label}</option>))}
          </select>
        </div>
      </div>

      {loading && <div className="text-sm text-slate-300 py-16 text-center">Calcul des indicateurs…</div>}

      {!loading && kpis && (
        <>
          {/* Rangée héro — la visibilité sur le volume d'achats (exposition
              budgétaire + performance livraison) passe avant tout le reste :
              c'est la première chose qui doit se voir. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
            <Panel title="Répartition budgétaire par catégorie" subtitle="Top 4 catégories + reste, sur la période filtrée">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                {(() => {
                  const top = kpis.financier.parCategorie.slice(0, 4);
                  const reste = kpis.financier.parCategorie.slice(4).reduce((a, b) => a + b.montant, 0);
                  const total = kpis.financier.expositionTotale;
                  const data = [...top.map((c, i) => ({ name: c.nom, value: c.montant, color: CATEGORIE_RAMP[i] }))];
                  if (reste > 0) data.push({ name: 'Autres catégories', value: reste, color: CATEGORIE_RAMP[4] });
                  return (
                    <>
                      <DonutChart data={data} centerValue={fmtUsdShort(total)} centerLabel="Exposition totale" height={190} />
                      <div>
                        {data.map((d) => (
                          <LegendRow key={d.name} color={d.color} label={d.name} value={fmtUsdShort(d.value)} sub={total ? `${((d.value / total) * 100).toFixed(0)}%` : ''} />
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            </Panel>

            <Panel title="Performance livraison" subtitle="Commandes livrées sur la période filtrée">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                {(() => {
                  const aTemps = kpis.livraison.tauxLivraisonATemps;
                  const enRetard = 100 - aTemps;
                  const data = [
                    { name: 'Livré à temps', value: aTemps, color: EMERAUDE },
                    { name: 'Livré en retard', value: enRetard, color: ROUGE },
                  ];
                  return (
                    <>
                      <DonutChart data={data} centerValue={fmtPct(aTemps)} centerLabel="Livré à temps" height={190} />
                      <div>
                        {data.map((d) => (
                          <LegendRow key={d.name} color={d.color} label={d.name} value={fmtPct(d.value)} />
                        ))}
                        <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                          <div>PR traités : <span className="font-semibold text-slate-600">{kpis.needsAssessment.nbPR}</span></div>
                          <div>Annulation post-PR : <span className="font-semibold text-slate-600">{fmtPct(kpis.livraison.tauxAnnulation)}</span></div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </Panel>
          </div>

          {/* Tendances (courbes) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <TrendCard
              size="lg"
              label="Lead time moyen"
              value={kpis.livraison.leadTimeMoyen.toFixed(1)}
              suffix="j"
              deltaPct={improvementPct(kpis.livraison.leadTimeMoyen, prevKpis?.livraison.leadTimeMoyen, false, { curSample: kpis.needsAssessment.nbPR, prevSample: prevKpis?.needsAssessment.nbPR })}
              sparkline={kpis.livraison.leadTimeParMois.map((m) => ({ mois: m.mois, value: m.leadTime }))}
              formatValue={(v) => `${v.toFixed(1)} j`}
            />
            <TrendCard
              size="lg"
              label="Coût évité cumulé"
              value={fmtUsdShort(kpis.financier.coutEvite)}
              deltaPct={improvementPct(kpis.financier.coutEvite, prevKpis?.financier.coutEvite, true, { curSample: kpis.needsAssessment.nbPR, prevSample: prevKpis?.needsAssessment.nbPR })}
              sparkline={kpis.financier.coutEviteParMois.map((m) => ({ mois: m.mois, value: m.montant }))}
              formatValue={fmtUsdShort}
            />
          </div>

          {/* Cartes KPI a badges icones */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
            <KpiCard icon={IconClock} color="marine" label="Lead time moyen" value={kpis.livraison.leadTimeMoyen.toFixed(1)} suffix="j" />
            <KpiCard icon={IconCheckCircle} color="emeraude" label="Livraison à temps" value={fmtPct(kpis.livraison.tauxLivraisonATemps)} />
            <KpiCard icon={IconTag} color="or" label="Écart prix vs marché" value={fmtPct(kpis.award.ecartPrixMoyen)} hint="Positif = sous le prix moyen" />
            <KpiCard icon={IconWallet} color="noir" label="Coût évité cumulé" value={fmtUsdShort(kpis.financier.coutEvite)} />
            <KpiCard icon={IconFileCheck} color="rouge" label="Utilisation contrats-cadres" value={fmtPct(kpis.contratsCadres.tauxUtilisationMoyen)} />
            <KpiCard icon={IconUsers} color="marine" label="Mise en concurrence" value={fmtPct(kpis.sourcing.tauxMiseEnConcurrence)} hint="Articles avec ≥3 devis" />
          </div>

          <Panel title="Échéances contrats-cadres" subtitle="90 prochains jours" className="mb-5">
            {kpis.contratsCadres.echeancesProches.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">Aucune échéance dans les 90 prochains jours.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6">
                {kpis.contratsCadres.echeancesProches.map((e, i) => {
                  const jours = Math.round((new Date(e.date_fin) - new Date()) / (1000 * 60 * 60 * 24));
                  const urgent = jours <= 30;
                  return (
                    <div key={i} className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${urgent ? 'bg-red-600' : 'bg-or-600'}`} />
                        <div className="min-w-0">
                          <div className="text-[12px] font-medium text-slate-700 truncate">{e.fournisseur_nom}</div>
                          <div className="text-[10px] text-slate-400 truncate">{e.categorie_nom}</div>
                        </div>
                      </div>
                      <span className={`badge shrink-0 ${urgent ? 'bg-red-50 text-red-700' : 'bg-or-50 text-or-700'}`}>{jours} j</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* Rangée basse : sourcing / top fournisseurs / gauge contrats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Panel title="Sourcing par catégorie" subtitle="Fournisseurs consultés, top 6">
              {kpis.sourcing.parCategorieChart.slice(0, 6).map((c) => (
                <ProgressRow key={c.categorie} label={c.categorie} value={c.fournisseurs} max={kpis.sourcing.parCategorieChart[0]?.fournisseurs || 1} />
              ))}
            </Panel>

            <Panel title="Top fournisseurs par exposition" subtitle="Montant total commandé, période filtrée">
              {(() => {
                const top = kpis.financier.topFournisseurs.slice(0, 5);
                const data = top.map((f, i) => ({ name: f.nom, value: f.montant, color: MARINE_RAMP[i] }));
                const total = data.reduce((a, b) => a + b.value, 0);
                return (
                  <div className="flex flex-col items-center">
                    <DonutChart data={data} centerValue={fmtUsdShort(total)} centerLabel="Top 5 cumulé" height={170} />
                    <div className="w-full mt-2">
                      {data.map((d) => (
                        <LegendRow key={d.name} color={d.color} label={d.name} value={fmtUsdShort(d.value)} />
                      ))}
                    </div>
                  </div>
                );
              })()}
            </Panel>

            <Panel title="Contrats-cadres" subtitle="Taux d'utilisation moyen du portefeuille">
              <div className="flex flex-col items-center">
                <GaugeChart value={kpis.contratsCadres.tauxUtilisationMoyen} gradientFrom={EMERAUDE} gradientTo={MARINE} />
                <div className="text-2xl font-bold text-slate-800 -mt-2 tabular-nums">{fmtPct(kpis.contratsCadres.tauxUtilisationMoyen)}</div>
                <div className="text-[11px] text-slate-400 mb-3">Taux d'utilisation moyen</div>
                <div className="grid grid-cols-2 gap-3 w-full pt-3 border-t border-slate-100">
                  <div className="text-center">
                    <div className="text-base font-semibold text-slate-800">{kpis.contratsCadres.nbContratsActifs}</div>
                    <div className="text-[10px] text-slate-400">Contrats actifs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-base font-semibold text-slate-800">{fmtPct(kpis.contratsCadres.couvertureCategorielle)}</div>
                    <div className="text-[10px] text-slate-400">Couverture catégorielle</div>
                  </div>
                </div>
              </div>
            </Panel>
          </div>

          {/* Performance fournisseur */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <Panel title="Performance fournisseur — Top 5" subtitle="Fournisseurs avec ≥3 commandes sur la période">
              {kpis.performanceFournisseur.top5.map((f) => (
                <div key={f.fournisseur_id} className="flex items-center justify-between gap-3 py-2 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0 bg-emeraude-600" />
                    <span className="text-[12px] font-medium text-slate-700 truncate">{f.fournisseur_nom}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-[11px]">
                    <span className="text-emeraude-700 font-semibold">{f.tauxATemps?.toFixed(0)}% à temps</span>
                    <span className="text-slate-400">{f.leadTimeMoyen.toFixed(1)} j</span>
                  </div>
                </div>
              ))}
            </Panel>
            <Panel title="Performance fournisseur — À surveiller" subtitle="Fournisseurs avec ≥3 commandes sur la période">
              {kpis.performanceFournisseur.bottom5.map((f) => (
                <div key={f.fournisseur_id} className="flex items-center justify-between gap-3 py-2 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0 bg-red-600" />
                    <span className="text-[12px] font-medium text-slate-700 truncate">{f.fournisseur_nom}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-[11px]">
                    <span className="text-red-600 font-semibold">{f.tauxATemps?.toFixed(0)}% à temps</span>
                    <span className="text-slate-400">{f.leadTimeMoyen.toFixed(1)} j</span>
                  </div>
                </div>
              ))}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
