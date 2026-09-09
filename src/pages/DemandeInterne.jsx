import { useEffect, useRef, useState } from 'react';
import { listCategories, listArticlesByCategorie, listSections } from '../lib/dataSource';
import { listPRs, savePR, deletePR, refFromPRId, markPRPourRFQ } from '../lib/prStore';
import { parseSpreadsheetFile } from '../lib/devisImport';
import { validatePRImportRows, revalidatePRRow, buildPRTemplate } from '../lib/prImport';
import { exportToExcel } from '../lib/exportExcel';

function AjoutLigneManuelle({ categories, onAdd }) {
  const [categorieId, setCategorieId] = useState('');
  const [articles, setArticles] = useState([]);
  const [articleId, setArticleId] = useState('');

  useEffect(() => {
    listArticlesByCategorie(categorieId ? Number(categorieId) : undefined).then((a) => {
      setArticles(a);
      setArticleId('');
    });
  }, [categorieId]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
      <div>
        <label className="text-xs font-medium text-slate-500 mb-1 block">Catégorie</label>
        <select className="input-field" value={categorieId} onChange={(e) => setCategorieId(e.target.value)}>
          <option value="">Toutes catégories</option>
          {categories.map((c) => (<option key={c.id} value={c.id}>{c.nom_categorie}</option>))}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500 mb-1 block">Article demandé</label>
        <select className="input-field" value={articleId} onChange={(e) => setArticleId(e.target.value)}>
          <option value="">Sélectionner un article</option>
          {articles.map((a) => (<option key={a.id} value={a.id}>{a.nom_article}</option>))}
        </select>
      </div>
      <button
        className="btn-primary"
        disabled={!articleId}
        onClick={() => {
          const article = articles.find((a) => a.id === Number(articleId));
          const categorie = categories.find((c) => c.id === article?.categorie_id);
          if (article) onAdd({ article, categorie });
          setArticleId('');
        }}
      >
        + Ajouter cet article
      </button>
    </div>
  );
}

export default function DemandeInterne({ onNavigate }) {
  const [categories, setCategories] = useState([]);
  const [sections, setSections] = useState([]);
  const [catalogue, setCatalogue] = useState([]);

  const [sectionId, setSectionId] = useState('');
  const [demandeur, setDemandeur] = useState('');
  const [dateBesoin, setDateBesoin] = useState('');
  const [notes, setNotes] = useState('');
  const [lignes, setLignes] = useState([]);

  const [importRows, setImportRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef(null);

  const [savedPRs, setSavedPRs] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [finalizeError, setFinalizeError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    listCategories().then(setCategories);
    listSections().then(setSections);
    listArticlesByCategorie().then(setCatalogue);
    setSavedPRs(listPRs());
  }, []);

  const activePR = savedPRs.find((p) => p.id === activeId);

  function handleAddManualLigne({ article, categorie }) {
    if (lignes.some((l) => l.article_id === article.id)) return;
    setLignes((prev) => [
      ...prev,
      {
        article_id: article.id,
        article_nom: article.nom_article,
        categorie_id: article.categorie_id,
        categorie_nom: categorie?.nom_categorie ?? '—',
        unite_mesure: article.unite_mesure,
        description_specification: article.description_specification,
        quantite_demandee: 1,
        commentaire: '',
        origine: 'manuel',
      },
    ]);
  }

  function updateQuantite(articleId, value) {
    setLignes((prev) => prev.map((l) => (l.article_id === articleId ? { ...l, quantite_demandee: Math.max(1, Number(value) || 1) } : l)));
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError('');
    setParsing(true);
    try {
      const rawRows = await parseSpreadsheetFile(file);
      if (rawRows.length === 0) {
        setParseError('Le fichier ne contient aucune ligne de données.');
        setImportRows([]);
        return;
      }
      setImportRows(validatePRImportRows(rawRows, catalogue));
    } catch (err) {
      setParseError(`Impossible de lire ce fichier : ${err.message}`);
      setImportRows([]);
    } finally {
      setParsing(false);
    }
  }

  function updateImportRow(index, patch) {
    setImportRows((prev) => prev.map((r, i) => (i === index ? revalidatePRRow({ ...r, ...patch }) : r)));
  }

  function handleDownloadTemplate() {
    exportToExcel([{ name: 'Modèle demande interne', rows: buildPRTemplate() }], 'BoostDuka_Modele_Demande_Interne.xlsx');
  }

  const validImportRows = importRows.filter((r) => r.ok);
  const invalidImportRows = importRows.filter((r) => !r.ok);

  function handleMergeImport() {
    const categoriesById = Object.fromEntries(categories.map((c) => [c.id, c]));
    const nouvelles = validImportRows
      .filter((r) => !lignes.some((l) => l.article_id === r.article.id))
      .map((r) => ({
        article_id: r.article.id,
        article_nom: r.article.nom_article,
        categorie_id: r.article.categorie_id,
        categorie_nom: categoriesById[r.article.categorie_id]?.nom_categorie ?? '—',
        unite_mesure: r.article.unite_mesure,
        description_specification: r.article.description_specification,
        quantite_demandee: r.quantite,
        commentaire: r.commentaire,
        origine: 'import',
      }));
    setLignes((prev) => [...prev, ...nouvelles]);
    setImportRows([]);
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleReset() {
    setLignes([]);
    setSectionId('');
    setDemandeur('');
    setDateBesoin('');
    setNotes('');
    setImportRows([]);
    setFileName('');
    setFinalizeError('');
  }

  function handleFinaliser() {
    setFinalizeError('');
    if (!sectionId) {
      setFinalizeError('Sélectionnez la section demandeuse avant de finaliser.');
      return;
    }
    if (lignes.length === 0) {
      setFinalizeError('Ajoutez au moins un article — encodage manuel ou import — avant de finaliser.');
      return;
    }
    if (invalidImportRows.length > 0) {
      setFinalizeError(`${invalidImportRows.length} ligne(s) importée(s) sont encore en erreur — corrigez-les, ajoutez les lignes valides, ou effacez le fichier avant de finaliser.`);
      return;
    }
    const section = sections.find((s) => s.id === sectionId);
    const pr = {
      id: crypto.randomUUID(),
      section_id: sectionId,
      section_nom: section?.nom_base || null,
      demandeur: demandeur.trim() || null,
      date_besoin: dateBesoin || null,
      notes,
      lignes,
      statut: 'confirmee',
    };
    savePR(pr);
    const all = listPRs();
    setSavedPRs(all);
    setActiveId(pr.id);
    setSaveMessage(`Demande interne ${refFromPRId(pr.id)} finalisée (${lignes.length} article(s)).`);
    handleReset();
  }

  function handleGenererRFQ(pr) {
    markPRPourRFQ(pr.id);
    savePR({ ...pr, statut: 'rfq_generee' });
    setSavedPRs(listPRs());
    onNavigate?.('demande-devis');
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-slate-800">Demande Interne (PR)</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Encodez les besoins d'une section — à la main pour quelques articles, ou par import Excel pour aller vite
          sur une longue liste. Une fois la demande finalisée, générez directement la Demande de devis (RFQ) à
          adresser aux fournisseurs.
        </p>
      </div>

      {!activeId && (
        <>
          <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Section demandeuse *</label>
              <select className="input-field" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
                <option value="">Sélectionner une section</option>
                {sections.map((s) => (<option key={s.id} value={s.id}>{s.nom_base}</option>))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Demandeur (optionnel)</label>
              <input className="input-field" value={demandeur} onChange={(e) => setDemandeur(e.target.value)} placeholder="Nom du demandeur" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Date de besoin souhaitée (optionnel)</label>
              <input type="date" className="input-field" value={dateBesoin} onChange={(e) => setDateBesoin(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-sm font-medium text-slate-700 mb-3">Encodage manuel</div>
              <AjoutLigneManuelle categories={categories} onAdd={handleAddManualLigne} />
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-sm font-medium text-slate-700 mb-1">Import rapide (Excel/CSV)</div>
              <p className="text-xs text-slate-400 mb-3">Pour une longue liste : téléchargez le modèle, remplissez-le, puis importez-le.</p>
              <div className="flex items-center gap-2 mb-3">
                <button className="btn-secondary" onClick={handleDownloadTemplate}>Télécharger le modèle</button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="input-field"
                  onChange={handleFileChange}
                />
              </div>
              {fileName && <div className="text-xs text-slate-400 mb-2">Fichier : {fileName}{parsing && ' — analyse en cours…'}</div>}
              {parseError && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md p-2 mb-2">{parseError}</div>}

              {importRows.length > 0 && (
                <div className="border border-slate-200 rounded-md overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
                    <span className="text-xs text-slate-500">
                      {validImportRows.length} valide(s) · {invalidImportRows.length} en erreur
                    </span>
                    <button className="btn-primary !py-1 !px-2 text-xs" disabled={validImportRows.length === 0} onClick={handleMergeImport}>
                      Ajouter les lignes valides ({validImportRows.length})
                    </button>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    <table className="w-full border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="table-th">Statut</th>
                          <th className="table-th">Article</th>
                          <th className="table-th text-center">Qté</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importRows.map((r, idx) => (
                          <tr key={r.index} className={r.ok ? '' : 'bg-red-50/50'}>
                            <td className="table-td">
                              {r.ok ? (
                                <span className="badge bg-emeraude-50 text-emeraude-700">Valide</span>
                              ) : (
                                <span className="badge bg-red-50 text-red-700" title={r.errors.join(', ')}>{r.errors[0]}</span>
                              )}
                            </td>
                            <td className="table-td">
                              <select
                                className="min-w-[160px] text-xs border border-slate-200 rounded px-1 py-1"
                                value={r.article?.id ?? ''}
                                onChange={(e) => {
                                  const art = catalogue.find((a) => a.id === Number(e.target.value));
                                  updateImportRow(idx, { article: art, articleRaw: art?.nom_article ?? r.articleRaw });
                                }}
                              >
                                <option value="">{r.articleRaw ? `« ${r.articleRaw} » — non reconnu` : '— choisir —'}</option>
                                {catalogue.map((a) => (<option key={a.id} value={a.id}>{a.nom_article}</option>))}
                              </select>
                            </td>
                            <td className="table-td text-center">
                              <input
                                type="number" min="1" className="w-16 text-center text-xs border border-slate-200 rounded px-1 py-1"
                                value={r.quantite}
                                onChange={(e) => updateImportRow(idx, { quantite: Number(e.target.value) || 1 })}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          {lignes.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-4">
              <table className="w-full border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="table-th">Article</th>
                    <th className="table-th">Catégorie</th>
                    <th className="table-th text-center">Qté demandée</th>
                    <th className="table-th text-center">Origine</th>
                    <th className="table-th"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lignes.map((l) => (
                    <tr key={l.article_id}>
                      <td className="table-td font-medium">{l.article_nom}</td>
                      <td className="table-td text-slate-500">{l.categorie_nom}</td>
                      <td className="table-td text-center">
                        <input
                          type="number" min="1" className="w-20 text-center text-sm border border-slate-200 rounded px-1 py-0.5"
                          value={l.quantite_demandee} onChange={(e) => updateQuantite(l.article_id, e.target.value)}
                        />
                      </td>
                      <td className="table-td text-center">
                        <span className="badge bg-slate-100 text-slate-500 text-[10px]">{l.origine === 'import' ? 'Import' : 'Manuel'}</span>
                      </td>
                      <td className="table-td text-right">
                        <button className="text-xs text-red-600 hover:underline" onClick={() => setLignes((prev) => prev.filter((x) => x.article_id !== l.article_id))}>Retirer</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
            <label className="text-xs font-medium text-slate-500 mb-1 block">Notes complémentaires (optionnel)</label>
            <textarea className="input-field min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contexte, urgence, justification globale..." />
          </div>

          {finalizeError && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3 mb-4">{finalizeError}</div>
          )}

          <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6 flex items-center gap-3">
            <button className="btn-primary" onClick={handleFinaliser}>
              Confirmer et finaliser la demande interne ({lignes.length} article{lignes.length > 1 ? 's' : ''})
            </button>
            {saveMessage && <span className="text-xs text-emeraude-700">{saveMessage}</span>}
          </div>
        </>
      )}

      {activePR && (
        <div className="bg-emeraude-50 border border-emeraude-100 rounded-lg p-5 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-sm font-semibold text-emeraude-800">
                {refFromPRId(activePR.id)} finalisée — {(activePR.lignes || []).length} article(s)
              </div>
              <div className="text-xs text-emeraude-700/80 mt-0.5">
                {activePR.section_nom || 'Section non spécifiée'}{activePR.demandeur ? ` · ${activePR.demandeur}` : ''}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activePR.statut === 'rfq_generee' ? (
                <span className="text-xs text-emeraude-700 font-medium">✓ Demande de devis déjà générée</span>
              ) : (
                <button className="btn-primary" onClick={() => handleGenererRFQ(activePR)}>
                  Générer la Demande de devis (RFQ) →
                </button>
              )}
              <button className="btn-secondary" onClick={() => setActiveId('')}>Nouvelle demande</button>
            </div>
          </div>
        </div>
      )}

      {savedPRs.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-sm font-medium text-slate-700 mb-2">Demandes internes enregistrées</div>
          <ul className="divide-y divide-slate-100">
            {savedPRs.map((p) => (
              <li key={p.id} className="py-2 flex items-center justify-between text-sm gap-3">
                <div className="min-w-0">
                  <span className="font-medium">{refFromPRId(p.id)}</span>
                  <span className="text-slate-500 ml-2">{(p.lignes || []).length} article(s)</span>
                  <span className="text-slate-400 ml-2 text-xs">{p.section_nom || '—'} · {new Date(p.created_at).toLocaleString('fr-FR')}</span>
                  <span className={`badge ml-2 text-[10px] ${p.statut === 'rfq_generee' ? 'bg-emeraude-50 text-emeraude-700' : 'bg-or-50 text-or-700'}`}>
                    {p.statut === 'rfq_generee' ? 'RFQ générée' : 'Confirmée'}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {p.statut !== 'rfq_generee' && (
                    <button className="text-xs text-marine-700 hover:underline" onClick={() => handleGenererRFQ(p)}>Générer RFQ</button>
                  )}
                  <button className="text-xs text-marine-700 hover:underline" onClick={() => setActiveId(p.id)}>Ouvrir</button>
                  <button
                    className="text-xs text-red-600 hover:underline"
                    onClick={() => { deletePR(p.id); setSavedPRs(listPRs()); if (activeId === p.id) setActiveId(''); }}
                  >
                    Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
