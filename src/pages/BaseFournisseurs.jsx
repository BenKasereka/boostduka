import { useRef, useEffect, useState } from 'react';
import {
  listFournisseurRows, listProvinces, listCategories, getFournisseurDetail,
  commitNouveauFournisseur, commitFournisseurPatch, commitNouveauxFournisseurs,
  commitSupprimerFournisseur,
} from '../lib/dataSource';
import { exportToExcel } from '../lib/exportExcel';
import { parseSpreadsheetFile, validateFournisseurRows, buildFournisseurTemplate } from '../lib/fournisseurImport';

const STATUT_STYLES = {
  actif: 'bg-emeraude-50 text-emeraude-700',
  suspendu: 'bg-or-50 text-or-700',
  blackliste: 'bg-red-50 text-red-700',
};

const CONDITIONS_PAIEMENT_OPTIONS = [
  'Net 30',
  'Net 45',
  'Net 60',
  '50% avance / 50% a la livraison',
  '30% avance / 70% a 30 jours',
  'Paiement comptant a la livraison',
  'Net 30 apres reception facture',
  'Paiement apres la livraison entre 15 - 30 jours',
  'Paiement apres la livraison inferieur ou egal a 15 jours',
];

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

function NouveauFournisseurForm({ provinces, categories, onCancel, onCreated }) {
  const [nom, setNom] = useState('');
  const [provinceId, setProvinceId] = useState('');
  const [ville, setVille] = useState('');
  const [conditions, setConditions] = useState(CONDITIONS_PAIEMENT_OPTIONS[0]);
  const [categorieIds, setCategorieIds] = useState([]);
  const [emailContact, setEmailContact] = useState('');
  const [telephoneContact, setTelephoneContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  function toggleCategorie(id) {
    setCategorieIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nom.trim() || !provinceId) {
      setFormError('Le nom et la province sont obligatoires.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const today = new Date().toISOString().slice(0, 10);
      const fournisseur = {
        id: crypto.randomUUID(),
        nom: nom.trim(),
        province_id: Number(provinceId),
        ville: ville.trim() || null,
        conditions_paiement: conditions,
        statut: 'actif',
        score_fiabilite: 50, // pas encore evalue : score neutre par defaut
        date_dernier_evaluation: today,
        profil_prix: 'standard',
        email_contact: emailContact.trim() || null,
        telephone_contact: telephoneContact.trim() || null,
        date_enregistrement: today,
      };
      await commitNouveauFournisseur(fournisseur, categorieIds);
      onCreated(fournisseur.id);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-4 mb-4 space-y-4">
      <div className="text-sm font-medium text-slate-700">Enregistrer un nouveau fournisseur</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Nom *</label>
          <input className="input-field" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="ex: Kivu Trading Co" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Province *</label>
          <select className="input-field" value={provinceId} onChange={(e) => setProvinceId(e.target.value)}>
            <option value="">Sélectionner</option>
            {provinces.map((p) => (<option key={p.id} value={p.id}>{p.nom_province}</option>))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Ville</label>
          <input className="input-field" value={ville} onChange={(e) => setVille(e.target.value)} placeholder="ex: Goma" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Conditions de paiement</label>
          <select className="input-field" value={conditions} onChange={(e) => setConditions(e.target.value)}>
            {CONDITIONS_PAIEMENT_OPTIONS.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Email contact</label>
          <input className="input-field" value={emailContact} onChange={(e) => setEmailContact(e.target.value)} placeholder="contact@fournisseur.cd" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Téléphone contact</label>
          <input className="input-field" value={telephoneContact} onChange={(e) => setTelephoneContact(e.target.value)} placeholder="+243..." />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500 mb-1 block">Catégories couvertes</label>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <label key={c.id} className={`text-xs px-2.5 py-1 rounded-full border cursor-pointer select-none ${categorieIds.includes(c.id) ? 'bg-marine-600 border-marine-600 text-white' : 'bg-white border-slate-300 text-slate-600'}`}>
              <input type="checkbox" className="hidden" checked={categorieIds.includes(c.id)} onChange={() => toggleCategorie(c.id)} />
              {c.nom_categorie}
            </label>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-slate-400">
        Score de fiabilité initialisé à 50 (neutre, pas encore évalué) — il évoluera au fil des livraisons et évaluations.
      </p>
      {formError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{formError}</div>}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Enregistrement…' : 'Enregistrer le fournisseur'}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}

function ImportFournisseursForm({ provinces, categories, onCancel, onImported }) {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError('');
    try {
      const rawRows = await parseSpreadsheetFile(file);
      if (rawRows.length === 0) {
        setParseError('Le fichier ne contient aucune ligne de données.');
        setRows([]);
        return;
      }
      setRows(validateFournisseurRows(rawRows, provinces, categories));
    } catch (err) {
      setParseError(`Impossible de lire ce fichier : ${err.message}`);
      setRows([]);
    }
  }

  function handleDownloadTemplate() {
    exportToExcel([{ name: 'Modele fournisseurs', rows: buildFournisseurTemplate() }], 'VISIBA_Modele_Import_Fournisseurs.xlsx');
  }

  const validRows = rows.filter((r) => r.ok);
  const invalidRows = rows.filter((r) => !r.ok);

  async function handleConfirm() {
    if (validRows.length === 0) return;
    setSubmitting(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const items = validRows.map((r) => ({
        fournisseur: {
          id: crypto.randomUUID(),
          nom: r.nom,
          province_id: r.province.id,
          ville: r.ville,
          conditions_paiement: r.conditions_paiement,
          statut: 'actif',
          score_fiabilite: 50,
          date_dernier_evaluation: today,
          profil_prix: 'standard',
          email_contact: r.email_contact,
          telephone_contact: r.telephone_contact,
          date_enregistrement: today,
        },
        categorieIds: r.categorieIds,
      }));
      await commitNouveauxFournisseurs(items);
      onImported(items.length);
    } catch (err) {
      setParseError(`Échec de l'import : ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-slate-700">
          Importer des fournisseurs existants (Excel/CSV)
        </div>
        <button className="btn-secondary" onClick={handleDownloadTemplate}>Télécharger le modèle Excel</button>
      </div>
      <p className="text-xs text-slate-500">
        Pour des fournisseurs déjà identifiés sur le terrain mais pas encore dans la base. Le fichier doit
        respecter le format du modèle (colonnes : Nom, Province, Ville, Conditions de paiement, Catégories
        couvertes, Email contact, Téléphone contact) — téléchargez-le, remplissez-le, puis importez-le ici.
      </p>
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="input-field" onChange={handleFileChange} />
      {fileName && <span className="text-xs text-slate-400">Fichier : {fileName}</span>}
      {parseError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{parseError}</div>}

      {rows.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-700">
              {validRows.length} ligne(s) valide(s) · {invalidRows.length} en erreur (non importées)
            </div>
            <button className="btn-primary" onClick={handleConfirm} disabled={submitting || validRows.length === 0}>
              {submitting ? 'Import en cours…' : `Confirmer l'import (${validRows.length} fournisseurs)`}
            </button>
          </div>
          <div className="overflow-x-auto max-h-[40vh] overflow-y-auto border border-slate-100 rounded-md">
            <table className="w-full border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="table-th">Statut</th>
                  <th className="table-th">Nom</th>
                  <th className="table-th">Province</th>
                  <th className="table-th">Ville</th>
                  <th className="table-th">Catégories</th>
                  <th className="table-th">Conditions</th>
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
                      {r.warnings.length > 0 && (
                        <div className="text-[10px] text-or-700 mt-0.5">{r.warnings.join(' · ')}</div>
                      )}
                    </td>
                    <td className="table-td font-medium text-slate-800">{r.nom || '—'}</td>
                    <td className="table-td text-slate-500">{r.provinceRaw || '—'}</td>
                    <td className="table-td text-slate-500">{r.ville || '—'}</td>
                    <td className="table-td text-xs text-slate-500">{r.categoriesLabel || '—'}</td>
                    <td className="table-td text-xs text-slate-500">{r.conditions_paiement}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div>
        <button type="button" className="btn-secondary" onClick={onCancel}>Fermer</button>
      </div>
    </div>
  );
}

function StatutEditor({ detail, onSaved, onDeleted }) {
  const [statut, setStatut] = useState(detail.statut);
  const [scoreFiabilite, setScoreFiabilite] = useState(detail.score_fiabilite);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const dirty = statut !== detail.statut || Number(scoreFiabilite) !== detail.score_fiabilite;

  async function handleSave() {
    setSaving(true);
    setMessage('');
    try {
      await commitFournisseurPatch(detail.id, {
        statut,
        score_fiabilite: Number(scoreFiabilite),
        date_dernier_evaluation: new Date().toISOString().slice(0, 10),
      });
      setMessage('Modifications enregistrées.');
      onSaved();
    } catch (err) {
      setMessage(`Erreur : ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError('');
    try {
      await commitSupprimerFournisseur(detail.id);
      onDeleted();
    } catch (err) {
      setDeleteError(err.message);
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="border-t border-slate-100 pt-3">
      <div className="text-xs text-slate-400 mb-2">Gestion du fournisseur</div>
      <div className="grid grid-cols-2 gap-3 mb-2">
        <div>
          <label className="text-[11px] text-slate-400 mb-1 block">Statut</label>
          <select className="input-field" value={statut} onChange={(e) => setStatut(e.target.value)}>
            <option value="actif">Actif</option>
            <option value="suspendu">Suspendu</option>
            <option value="blackliste">Blacklisté</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] text-slate-400 mb-1 block">Score de fiabilité</label>
          <input
            type="number" min="0" max="100" className="input-field"
            value={scoreFiabilite} onChange={(e) => setScoreFiabilite(e.target.value)}
          />
        </div>
      </div>
      <button className="btn-secondary" onClick={handleSave} disabled={!dirty || saving}>
        {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
      </button>
      {message && <span className="text-xs text-slate-500 ml-2">{message}</span>}

      <div className="mt-3 pt-3 border-t border-slate-100">
        {!confirmDelete && (
          <button
            className="text-xs text-red-600 hover:underline"
            onClick={() => { setConfirmDelete(true); setDeleteError(''); }}
          >
            Supprimer définitivement ce fournisseur
          </button>
        )}
        {confirmDelete && (
          <div className="text-xs">
            <p className="text-slate-600 mb-2">
              Confirmez-vous la suppression définitive de <strong>{detail.nom}</strong> ? Cette action est
              irréversible. Elle sera refusée si ce fournisseur a déjà des devis, commandes ou contrats-cadres.
            </p>
            <div className="flex gap-2">
              <button className="btn-secondary !text-red-700 !border-red-300" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Suppression…' : 'Oui, supprimer'}
              </button>
              <button className="btn-secondary" onClick={() => setConfirmDelete(false)} disabled={deleting}>Annuler</button>
            </div>
          </div>
        )}
        {deleteError && (
          <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-md p-2 mt-2">{deleteError}</p>
        )}
        <p className="text-[11px] text-slate-400 mt-2">
          Un fournisseur avec historique ne peut pas être supprimé (intégrité des données) — passez-le en{' '}
          <strong>suspendu</strong> ou <strong>blacklisté</strong> ci-dessus pour l'exclure des futures consultations et imports.
        </p>
      </div>
    </div>
  );
}

export default function BaseFournisseurs() {
  const [rows, setRows] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [panelMode, setPanelMode] = useState(null); // null | 'manuel' | 'import'
  const [importMessage, setImportMessage] = useState('');

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
  }, [provinceId, categorieId, statut, search, refreshKey]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    getFournisseurDetail(selectedId)
      .then(setDetail)
      .finally(() => setDetailLoading(false));
  }, [selectedId, refreshKey]);

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

  function handleCreated(newId) {
    setPanelMode(null);
    setSelectedId(newId);
    setRefreshKey((k) => k + 1);
  }

  function handleImported(count) {
    setPanelMode(null);
    setImportMessage(`${count} fournisseur(s) importé(s) avec succès.`);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Base de données Fournisseurs</h1>
          <p className="text-sm text-slate-500 mt-0.5">{rows.length} fournisseurs référencés sur 6 provinces RDC</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setPanelMode((m) => (m === 'manuel' ? null : 'manuel'))}>
            {panelMode === 'manuel' ? 'Fermer' : '+ Nouveau fournisseur'}
          </button>
          <button className="btn-secondary" onClick={() => setPanelMode((m) => (m === 'import' ? null : 'import'))}>
            {panelMode === 'import' ? 'Fermer' : 'Importer Excel/CSV'}
          </button>
          <button className="btn-primary" onClick={handleExport} disabled={rows.length === 0}>
            Exporter Excel
          </button>
        </div>
      </div>

      {importMessage && (
        <div className="text-sm text-emeraude-700 bg-emeraude-50 border border-emeraude-200 rounded-md p-3 mb-4">{importMessage}</div>
      )}

      {panelMode === 'manuel' && (
        <NouveauFournisseurForm
          provinces={provinces}
          categories={categories}
          onCancel={() => setPanelMode(null)}
          onCreated={handleCreated}
        />
      )}

      {panelMode === 'import' && (
        <ImportFournisseursForm
          provinces={provinces}
          categories={categories}
          onCancel={() => setPanelMode(null)}
          onImported={handleImported}
        />
      )}

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

              <StatutEditor
                key={detail.id}
                detail={detail}
                onSaved={() => setRefreshKey((k) => k + 1)}
                onDeleted={() => {
                  setSelectedId(null);
                  setRefreshKey((k) => k + 1);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
