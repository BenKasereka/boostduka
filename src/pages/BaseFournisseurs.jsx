import { useEffect, useState } from 'react';
import { listFournisseurRows, listProvinces, listCategories, getFournisseurDetail } from '../lib/dataSource';
import { exportToExcel } from '../lib/exportExcel';

const STATUT_STYLES = {
  actif: 'bg-emeraude-50 text-emeraude-700',
  suspendu: 'bg-or-50 text-or-700',
  blackliste: 'bg-red-50 text-red-700',
};

function ScoreBar({ score }) {
  const color = score >= 75 ? 'bg-emeraude-600' : score >= 50 ? 'bg-or-600' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-slate-500 tabular-nums">{score.toFixed(1)}</span>
    </div>
  );
}

export default function BaseFournisseurs() {
  const [rows, setRows] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [provinceId, setProvinceId] = useState('');
  const [categorieId, setCategorieId] = useState('');
  const [statut, setStatut] = useState('');
  const [search, setSearch] = useState('');

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    Promise.all([listProvinces(), listCategories()])
      .then(([p, c]) => {
        setProvinces(p);
        setCategories(c);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    listFournisseurRows({
      provinceId: provinceId ? Number(provinceId) : undefined,
      categorieId: categorieId ? Number(categorieId) : undefined,
      statut: statut || undefined,
      search: search || undefined,
    })
      .then((r) => {
        setRows(r);
        if (r.length > 0 && !r.some((x) => x.id === selectedId)) setSelectedId(r[0].id);
        if (r.length === 0) setSelectedId(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provinceId, categorieId, statut, search]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    getFournisseurDetail(selectedId)
      .then(setDetail)
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  function handleExport() {
    exportToExcel(
      [
        {
          name: 'Base fournisseurs',
          rows: rows.map((r) => ({
            Nom: r.nom,
            Province: r.province_nom,
            Ville: r.ville,
            Statut: r.statut,
            'Score fiabilité': r.score_fiabilite,
            Catégories: r.categories.join(', '),
            'Conditions paiement': r.conditions_paiement,
            'Nb devis soumis': r.nb_devis,
            'Dernière évaluation': r.date_dernier_evaluation,
            Email: r.email_contact,
            Téléphone: r.telephone_contact,
          })),
        },
      ],
      `VISIBA_Base_Fournisseurs_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Base de données Fournisseurs</h1>
          <p className="text-sm text-slate-500 mt-0.5">{rows.length} fournisseurs référencés sur 6 provinces RDC</p>
        </div>
        <button className="btn-primary" onClick={handleExport} disabled={rows.length === 0}>
          Exporter Excel
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Province</label>
          <select className="input-field" value={provinceId} onChange={(e) => setProvinceId(e.target.value)}>
            <option value="">Toutes les provinces</option>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>{p.nom_province}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Catégorie couverte</label>
          <select className="input-field" value={categorieId} onChange={(e) => setCategorieId(e.target.value)}>
            <option value="">Toutes les catégories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.nom_categorie}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Statut</label>
          <select className="input-field" value={statut} onChange={(e) => setStatut(e.target.value)}>
            <option value="">Tous statuts</option>
            <option value="actif">Actif</option>
            <option value="suspendu">Suspendu</option>
            <option value="blackliste">Blacklisté</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Recherche</label>
          <input
            className="input-field"
            placeholder="ex: Kivu, Goma..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3 mb-4">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
            <table className="w-full border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="table-th">Fournisseur</th>
                  <th className="table-th">Localisation</th>
                  <th className="table-th">Statut</th>
                  <th className="table-th">Fiabilité</th>
                  <th className="table-th">Devis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && <tr><td className="table-td text-slate-400" colSpan={5}>Chargement…</td></tr>}
                {!loading && rows.length === 0 && (
                  <tr><td className="table-td text-slate-400" colSpan={5}>Aucun fournisseur ne correspond aux filtres.</td></tr>
                )}
                {!loading && rows.map((f) => (
                  <tr
                    key={f.id}
                    onClick={() => setSelectedId(f.id)}
                    className={`cursor-pointer hover:bg-slate-50 ${selectedId === f.id ? 'bg-marine-50/60' : ''}`}
                  >
                    <td className="table-td font-medium text-slate-800">{f.nom}</td>
                    <td className="table-td text-slate-500">{f.province_nom} · {f.ville}</td>
                    <td className="table-td">
                      <span className={`badge ${STATUT_STYLES[f.statut] || 'bg-slate-100 text-slate-600'}`}>{f.statut}</span>
                    </td>
                    <td className="table-td"><ScoreBar score={f.score_fiabilite} /></td>
                    <td className="table-td text-center">{f.nb_devis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-2">
          {detailLoading && (
            <div className="bg-white border border-slate-200 rounded-lg p-6 text-sm text-slate-400">Chargement de la fiche…</div>
          )}
          {!detailLoading && !detail && (
            <div className="bg-white border border-slate-200 rounded-lg p-6 text-sm text-slate-400">
              Sélectionnez un fournisseur pour afficher sa fiche complète.
            </div>
          )}
          {!detailLoading && detail && (
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-800">{detail.nom}</h2>
                  <span className={`badge ${STATUT_STYLES[detail.statut] || 'bg-slate-100 text-slate-600'}`}>{detail.statut}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{detail.province_nom} · {detail.ville}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-slate-400">Score de fiabilité</div>
                  <ScoreBar score={detail.score_fiabilite} />
                </div>
                <div>
                  <div className="text-xs text-slate-400">Dernière évaluation</div>
                  <div>{detail.date_dernier_evaluation}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Conditions de paiement</div>
                  <div>{detail.conditions_paiement}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Contact</div>
                  <div className="truncate">{detail.email_contact}</div>
                  <div>{detail.telephone_contact}</div>
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-400 mb-1">Catégories couvertes</div>
                <div className="flex flex-wrap gap-1.5">
                  {detail.categories.map((c) => (
                    <span key={c} className="badge bg-marine-50 text-marine-700">{c}</span>
                  ))}
                </div>
              </div>

              {detail.contrats.length > 0 && (
                <div>
                  <div className="text-xs text-slate-400 mb-1">Contrats-cadres</div>
                  <ul className="space-y-1 text-sm">
                    {detail.contrats.map((c) => (
                      <li key={c.id} className="flex justify-between border-b border-slate-100 pb-1">
                        <span>{c.categorie_nom}</span>
                        <span className="text-slate-500">{c.statut} · usage {c.taux_utilisation_pct}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <div className="text-xs text-slate-400 mb-1">Derniers devis soumis ({detail.devis.length})</div>
                <ul className="space-y-1 text-sm max-h-56 overflow-y-auto">
                  {detail.devis.slice(0, 15).map((d) => (
                    <li key={d.id} className="flex justify-between gap-2 border-b border-slate-100 pb-1">
                      <span className="truncate">{d.article_nom}</span>
                      <span className="text-slate-500 shrink-0">{d.prix_unitaire.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {d.devise}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
