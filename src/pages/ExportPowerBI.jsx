import { useEffect, useState } from 'react';
import { loadTable } from '../lib/dataSource';
import { downloadCsv } from '../lib/exportCsv';
import { exportToExcel } from '../lib/exportExcel';

const TABLE_META = [
  { key: 'provinces', role: 'Dimension', desc: "Référentiel des 6 provinces RDC couvertes" },
  { key: 'sections', role: 'Dimension', desc: 'Les 6 bases opérationnelles VISIBA' },
  { key: 'categories_articles', role: 'Dimension', desc: "15 familles d'achats" },
  { key: 'articles', role: 'Dimension', desc: 'Catalogue des articles par catégorie' },
  { key: 'fournisseurs', role: 'Dimension', desc: 'Base fournisseurs centralisée' },
  { key: 'fournisseur_categories', role: 'Table de pont (N-N)', desc: 'Catégories couvertes par fournisseur' },
  { key: 'section_besoins', role: 'Table de pont (N-N)', desc: 'Besoins récurrents par section' },
  { key: 'devis', role: 'Fait — Sourcing', desc: 'Devis/quotations fournisseurs' },
  { key: 'contrats_cadres', role: 'Fait — Contrats', desc: 'Contrats-cadres fournisseur × catégorie' },
  { key: 'commandes', role: 'Fait — Cycle achat', desc: 'PR → PO → Livraison (12 mois glissants)' },
];

const ROLE_STYLES = {
  Dimension: 'bg-marine-50 text-marine-700',
  'Table de pont (N-N)': 'bg-slate-100 text-slate-600',
};

function roleClass(role) {
  if (role.startsWith('Fait')) return 'bg-or-50 text-or-700';
  return ROLE_STYLES[role] || 'bg-slate-100 text-slate-600';
}

const DAX_APERCU = [
  { nom: 'Lead Time Moyen', formule: 'AVERAGEX(FILTER(commandes, NOT ISBLANK(commandes[date_livraison_reelle])), DATEDIFF(commandes[date_pr], commandes[date_livraison_reelle], DAY))' },
  { nom: 'Taux Livraison à Temps', formule: 'DIVIDE(CALCULATE(COUNTROWS(commandes), commandes[statut]="livree_a_temps"), CALCULATE(COUNTROWS(commandes), commandes[statut] IN {"livree_a_temps","livree_en_retard"}))' },
  { nom: 'Coût Évité Cumulé', formule: 'SUMX(commandes, MAX(0, RELATED(articles[prix_moyen_marche]) - commandes[prix_unitaire]) * commandes[quantite])' },
  { nom: 'Taux Utilisation Contrats-Cadres', formule: 'AVERAGE(contrats_cadres[taux_utilisation_pct])' },
];

export default function ExportPowerBI() {
  const [rowCounts, setRowCounts] = useState({});
  const [tables, setTables] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all(TABLE_META.map((t) => loadTable(t.key).then((rows) => [t.key, rows]))).then((entries) => {
      const obj = Object.fromEntries(entries);
      setTables(obj);
      setRowCounts(Object.fromEntries(entries.map(([k, rows]) => [k, rows.length])));
      setLoading(false);
    });
  }, []);

  function handleDownloadAll() {
    exportToExcel(
      TABLE_META.map((t) => ({ name: t.key, rows: tables[t.key] || [] })),
      `VISIBA_Export_PowerBI_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Export Power BI</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Tables nettoyées, prêtes à être connectées dans Power BI Desktop (Get Data → Excel/CSV).
          </p>
        </div>
        <button className="btn-primary" onClick={handleDownloadAll} disabled={loading}>
          Télécharger toutes les tables (Excel multi-onglets)
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-6">
        <table className="w-full border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="table-th">Table</th>
              <th className="table-th">Rôle</th>
              <th className="table-th">Description</th>
              <th className="table-th text-center">Lignes</th>
              <th className="table-th text-right">Export</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {TABLE_META.map((t) => (
              <tr key={t.key}>
                <td className="table-td font-mono text-xs font-medium text-slate-800">{t.key}</td>
                <td className="table-td"><span className={`badge ${roleClass(t.role)}`}>{t.role}</span></td>
                <td className="table-td text-slate-500">{t.desc}</td>
                <td className="table-td text-center">{loading ? '…' : rowCounts[t.key]}</td>
                <td className="table-td text-right">
                  <button
                    className="text-xs text-marine-700 hover:underline"
                    disabled={loading}
                    onClick={() => downloadCsv(`${t.key}.csv`, tables[t.key])}
                  >
                    CSV
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-2">Modèle relationnel (schéma en étoile)</h2>
        <p className="text-sm text-slate-500 mb-3">
          5 dimensions (provinces, sections, categories_articles, articles, fournisseurs), 2 tables de pont N-N
          (fournisseur_categories, section_besoins) et 3 faits (devis, contrats_cadres, commandes) reliés par clé
          étrangère. Documentation complète des relations, cardinalités et recommandations Power Query dans{' '}
          <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">supabase/modele_donnees_PBI.md</code>.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Aperçu des mesures DAX suggérées</h2>
        <div className="space-y-3">
          {DAX_APERCU.map((m) => (
            <div key={m.nom}>
              <div className="text-xs font-medium text-marine-700 mb-1">{m.nom}</div>
              <pre className="text-[11px] bg-slate-50 border border-slate-100 rounded p-2 overflow-x-auto whitespace-pre-wrap">{m.formule}</pre>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Liste complète (Needs Assessment, Sourcing, Award/CBA, Contrats-cadres, Livraison, Performance fournisseur, Financier)
          dans <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">supabase/modele_donnees_PBI.md</code>.
        </p>
      </div>
    </div>
  );
}
