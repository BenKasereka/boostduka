import { useEffect, useRef, useState } from 'react';
import { loadTable, commitDevisImport } from '../lib/dataSource';
import { parseSpreadsheetFile, validateImportRows, buildDevisTemplate } from '../lib/devisImport';
import { exportToExcel } from '../lib/exportExcel';

function addDaysIso(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function ImportDevis() {
  const [fournisseurs, setFournisseurs] = useState([]);
  const [fournisseurId, setFournisseurId] = useState('');
  const [articles, setArticles] = useState([]);
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    Promise.all([loadTable('fournisseurs'), loadTable('articles')]).then(([f, a]) => {
      setFournisseurs(f.filter((x) => x.statut === 'actif').sort((a, b) => a.nom.localeCompare(b.nom)));
      setArticles(a);
    });
  }, []);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError('');
    setSuccessMessage('');
    try {
      const rawRows = await parseSpreadsheetFile(file);
      if (rawRows.length === 0) {
        setParseError('Le fichier ne contient aucune ligne de données.');
        setRows([]);
        return;
      }
      setRows(validateImportRows(rawRows, articles));
    } catch (err) {
      setParseError(`Impossible de lire ce fichier : ${err.message}`);
      setRows([]);
    }
  }

  function handleDownloadTemplate() {
    exportToExcel([{ name: 'Modele devis', rows: buildDevisTemplate() }], 'VISIBA_Modele_Import_Devis.xlsx');
  }

  const validRows = rows.filter((r) => r.ok);
  const invalidRows = rows.filter((r) => !r.ok);

  async function handleConfirm() {
    if (!fournisseurId || validRows.length === 0) return;
    setSubmitting(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const devisRows = validRows.map((r) => ({
        id: crypto.randomUUID(),
        fournisseur_id: fournisseurId,
        article_id: r.article.id,
        prix_unitaire: r.prix_unitaire,
        devise: r.devise,
        delai_livraison_jours: r.delai_livraison_jours,
        quantite_min: r.quantite_min,
        validite_offre_date: r.validite_offre_date || addDaysIso(60),
        date_soumission: today,
        source_import: 'import_excel',
      }));
      await commitDevisImport(devisRows);
      setSuccessMessage(`${devisRows.length} devis importé(s) avec succès. Visibles dans Liste de Prix, Synthèse comparative et Dashboard.`);
      setRows([]);
      setFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setParseError(`Échec de l'import : ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-slate-800">Import de devis (Excel/CSV)</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Importez une quotation reçue d'un fournisseur. Chaque ligne doit référencer un article déjà présent dans le catalogue.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">1. Fournisseur émetteur de la quotation</label>
          <select className="input-field" value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)}>
            <option value="">Sélectionner un fournisseur</option>
            {fournisseurs.map((f) => (
              <option key={f.id} value={f.id}>{f.nom}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">2. Fichier Excel/CSV</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="input-field"
            disabled={!fournisseurId}
            onChange={handleFileChange}
          />
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <button className="btn-secondary" onClick={handleDownloadTemplate}>Télécharger le modèle Excel</button>
        {fileName && <span className="text-xs text-slate-400">Fichier : {fileName}</span>}
      </div>

      {parseError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3 mb-4">{parseError}</div>}
      {successMessage && <div className="text-sm text-emeraude-700 bg-emeraude-50 border border-emeraude-200 rounded-md p-3 mb-4">{successMessage}</div>}

      {rows.length > 0 && (
        <>
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="text-sm font-medium text-slate-700">
                {validRows.length} ligne(s) valide(s) · {invalidRows.length} en erreur (non importées)
              </div>
              <button className="btn-primary" onClick={handleConfirm} disabled={submitting || validRows.length === 0 || !fournisseurId}>
                {submitting ? 'Import en cours…' : `Confirmer l'import (${validRows.length} devis)`}
              </button>
            </div>
            <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
              <table className="w-full border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="table-th">Statut</th>
                    <th className="table-th">Article (fichier)</th>
                    <th className="table-th text-right">Prix</th>
                    <th className="table-th">Devise</th>
                    <th className="table-th text-center">Délai (j)</th>
                    <th className="table-th text-center">Qté min</th>
                    <th className="table-th">Validité offre</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.index} className={r.ok ? '' : 'bg-red-50/50'}>
                      <td className="table-td">
                        {r.ok ? (
                          <span className="badge bg-emeraude-50 text-emeraude-700">Valide</span>
                        ) : (
                          <span className="badge bg-red-50 text-red-700" title={r.errors.join(', ')}>{r.errors[0]}</span>
                        )}
                      </td>
                      <td className="table-td font-medium text-slate-800">{r.articleRaw || '—'}</td>
                      <td className="table-td text-right">{isNaN(r.prix_unitaire) ? '—' : r.prix_unitaire}</td>
                      <td className="table-td">{r.devise}</td>
                      <td className="table-td text-center">{r.delai_livraison_jours ?? '—'}</td>
                      <td className="table-td text-center">{r.quantite_min}</td>
                      <td className="table-td text-slate-500">{r.validite_offre_date || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
