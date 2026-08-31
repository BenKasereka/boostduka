import { useEffect, useMemo, useState } from 'react';
import { listPriceRows, listProvinces, listCategories } from '../lib/dataSource';
import { exportToExcel } from '../lib/exportExcel';
import { convertPourAffichage, formatMoney } from '../lib/currency';
import { useDevisePreference } from '../lib/DevisePreferenceContext';

const PAGE_SIZE = 25;

function MontantAffiche({ montant, devise }) {
  const { devisePrincipale, deviseSecondaire } = useDevisePreference();
  const { principal, principalCode, secondaire, secondaireCode } = convertPourAffichage(montant, devise, devisePrincipale, deviseSecondaire);
  return (
    <>
      {formatMoney(principal, principalCode)}
      {secondaire != null && (
        <div className="text-[10px] text-slate-400 font-normal">≈ {formatMoney(secondaire, secondaireCode)}</div>
      )}
    </>
  );
}

export default function ListePrix() {
  const [rows, setRows] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [provinceId, setProvinceId] = useState('');
  const [categorieId, setCategorieId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

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
    listPriceRows({
      provinceId: provinceId ? Number(provinceId) : undefined,
      categorieId: categorieId ? Number(categorieId) : undefined,
      search: search || undefined,
    })
      .then((r) => {
        setRows(r);
        setPage(1);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [provinceId, categorieId, search]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = useMemo(
    () => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [rows, page]
  );

  const nbArticlesDistincts = useMemo(() => new Set(rows.map((r) => r.article_id)).size, [rows]);
  const nbFournisseursDistincts = useMemo(() => new Set(rows.map((r) => r.fournisseur_id)).size, [rows]);

  function handleExport() {
    exportToExcel(
      [
        {
          name: 'Liste de prix',
          rows: rows.map((r) => ({
            Fournisseur: r.fournisseur_nom,
            Province: r.province_nom,
            Catégorie: r.categorie_nom,
            Article: r.article_nom,
            'Description & Spécification': r.description_specification || '',
            Unité: r.unite_mesure,
            'Qté (référence prix)': r.quantite_reference,
            'Prix unitaire': r.prix_unitaire,
            Devise: r.devise,
            'Délai livraison (j)': r.delai_livraison_jours,
            'Transport inclus': r.transport_inclus ? 'Oui' : 'Non',
            'Qté Min-Stock': r.stock_disponible,
            'Date soumission': r.date_soumission,
            'Validité offre': r.validite_offre_date,
            'Modalité de paiement': r.conditions_paiement,
          })),
        },
      ],
      `VISIBA_Liste_de_Prix_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Liste de Prix</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Fournisseur × Catégorie × Article × Prix — {rows.length} devis, {nbArticlesDistincts} articles, {nbFournisseursDistincts} fournisseurs
          </p>
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
          <label className="text-xs font-medium text-slate-500 mb-1 block">Catégorie</label>
          <select className="input-field" value={categorieId} onChange={(e) => setCategorieId(e.target.value)}>
            <option value="">Toutes les catégories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.nom_categorie}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-slate-500 mb-1 block">Recherche (article ou fournisseur)</label>
          <input
            className="input-field"
            placeholder="ex: gants, ciment, Kivu Trading..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3 mb-4">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="table-th">Article</th>
                <th className="table-th">Catégorie</th>
                <th className="table-th">Fournisseur</th>
                <th className="table-th">Province</th>
                <th className="table-th text-center">Qté</th>
                <th className="table-th text-right">Prix unitaire</th>
                <th className="table-th">Délai (j)</th>
                <th className="table-th text-center">Transport inclus</th>
                <th className="table-th text-center">Qté Min-Stock</th>
                <th className="table-th">Validité offre</th>
                <th className="table-th">Modalité paiement</th>
                <th className="table-th">Soumis le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr><td className="table-td text-slate-400" colSpan={12}>Chargement…</td></tr>
              )}
              {!loading && pageRows.length === 0 && (
                <tr><td className="table-td text-slate-400" colSpan={12}>Aucun devis ne correspond aux filtres.</td></tr>
              )}
              {!loading && pageRows.map((r) => (
                <tr key={r.devis_id} className="hover:bg-slate-50">
                  <td className="table-td font-medium text-slate-800" title={r.description_specification || undefined}>
                    {r.article_nom}
                    {r.description_specification && <span className="text-slate-300 ml-1" title={r.description_specification}>ⓘ</span>}
                  </td>
                  <td className="table-td text-slate-500">{r.categorie_nom}</td>
                  <td className="table-td">{r.fournisseur_nom}</td>
                  <td className="table-td text-slate-500">{r.province_nom}</td>
                  <td className="table-td text-center">{r.quantite_reference}</td>
                  <td className="table-td text-right font-medium">
                    <MontantAffiche montant={r.prix_unitaire} devise={r.devise} />
                  </td>
                  <td className="table-td text-center">{r.delai_livraison_jours}</td>
                  <td className="table-td text-center">
                    <span className={`badge ${r.transport_inclus ? 'bg-emeraude-50 text-emeraude-700' : 'bg-slate-100 text-slate-500'}`}>
                      {r.transport_inclus ? 'Oui' : 'Non'}
                    </span>
                  </td>
                  <td className="table-td text-center">
                    {r.stock_disponible === 0 ? (
                      <span className="badge bg-red-50 text-red-700">Rupture</span>
                    ) : r.stock_disponible}
                  </td>
                  <td className="table-td text-slate-500">{r.validite_offre_date}</td>
                  <td className="table-td text-slate-500 text-xs">{r.conditions_paiement}</td>
                  <td className="table-td text-slate-500">{r.date_soumission}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && rows.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 text-sm text-slate-500">
            <span>Page {page} / {totalPages}</span>
            <div className="flex gap-2">
              <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</button>
              <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Suivant</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
