import { loadTable } from './dataSource';
import { toUsd } from './currency';

// =====================================================================
// Agregation des KPIs du dashboard, par phase du cycle procurement.
//
// Deux KPIs du brief n'ont pas de donnee source dediee dans ce dataset
// (pas de workflow d'approbation de besoin, pas de journal des RFQ
// envoyees vs recues) : ils sont remplaces par un proxy calculable et
// clairement etiquete comme tel dans l'UI plutot que d'etre fabriques.
// =====================================================================

const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));

function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function daysBetween(a, b) {
  return (new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24);
}

export async function computeKpis(filters = {}) {
  const { sectionId, provinceId, categorieId, dateFrom, dateTo } = filters;

  const [devis, commandes, fournisseurs, articles, categories, contrats, sections, fournisseurCategories] =
    await Promise.all([
      loadTable('devis'),
      loadTable('commandes'),
      loadTable('fournisseurs'),
      loadTable('articles'),
      loadTable('categories_articles'),
      loadTable('contrats_cadres'),
      loadTable('sections'),
      loadTable('fournisseur_categories'),
    ]);

  const fournisseursById = byId(fournisseurs);
  const articlesById = byId(articles);
  const categoriesById = byId(categories);
  const sectionsById = byId(sections);

  const inRange = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (dateFrom && d < new Date(dateFrom)) return false;
    if (dateTo && d > new Date(dateTo)) return false;
    return true;
  };

  const matchesCategorie = (articleId) => !categorieId || articlesById[articleId]?.categorie_id === categorieId;
  const matchesProvinceFournisseur = (fournisseurId) =>
    !provinceId || fournisseursById[fournisseurId]?.province_id === provinceId;

  // ---------------------------------------------------------------------
  // Prix moyen marche par article — calcule sur TOUS les devis (baseline
  // stable), independamment des filtres periode/section, pour comparer
  // un achat filtre a un marche non biaise par la fenetre choisie.
  // Converti en USD avant moyenne : des devis en CDF et en USD ne sont
  // pas comparables sans conversion (les commandes, elles, sont toujours
  // en USD dans ce dataset, donc directement comparables a cette moyenne).
  // ---------------------------------------------------------------------
  const pricesByArticle = {};
  devis.forEach((d) => {
    (pricesByArticle[d.article_id] ||= []).push(toUsd(d.prix_unitaire, d.devise));
  });
  const avgPriceByArticle = Object.fromEntries(
    Object.entries(pricesByArticle).map(([aid, arr]) => [Number(aid), avg(arr)])
  );

  // ---------------------------------------------------------------------
  // Commandes filtrees (cote demande)
  // ---------------------------------------------------------------------
  let cmd = commandes.filter((c) => inRange(c.date_pr));
  if (sectionId) cmd = cmd.filter((c) => c.section_id === sectionId);
  if (categorieId) cmd = cmd.filter((c) => matchesCategorie(c.article_id));
  if (provinceId) cmd = cmd.filter((c) => matchesProvinceFournisseur(c.fournisseur_id));

  // ---------------------------------------------------------------------
  // Devis filtres (cote sourcing / offre) — non filtre par section (les
  // devis ne sont pas rattaches a une section demandeuse dans le schema)
  // ---------------------------------------------------------------------
  let dev = devis.filter((d) => inRange(d.date_soumission));
  if (categorieId) dev = dev.filter((d) => matchesCategorie(d.article_id));
  if (provinceId) dev = dev.filter((d) => matchesProvinceFournisseur(d.fournisseur_id));

  // =====================================================================
  // 1) Needs Assessment (proxy)
  // =====================================================================
  const nbPR = cmd.length;
  const nbAnnulees = cmd.filter((c) => c.statut === 'annulee').length;
  const needsAssessment = {
    nbPR,
    tauxAnnulationBesoin: nbPR ? (nbAnnulees / nbPR) * 100 : 0,
  };

  // =====================================================================
  // 2) Sourcing / RFQ
  // =====================================================================
  const fournisseursParArticle = {};
  dev.forEach((d) => {
    (fournisseursParArticle[d.article_id] ||= new Set()).add(d.fournisseur_id);
  });
  const articlesAvecDevis = Object.keys(fournisseursParArticle);
  const articlesBienConcurrences = articlesAvecDevis.filter((aid) => fournisseursParArticle[aid].size >= 3);

  const fournisseursParCategorie = {};
  dev.forEach((d) => {
    const catId = articlesById[d.article_id]?.categorie_id;
    if (!catId) return;
    (fournisseursParCategorie[catId] ||= new Set()).add(d.fournisseur_id);
  });
  const nbFournisseursParCategorieMoyen = avg(
    Object.values(fournisseursParCategorie).map((s) => s.size)
  );
  const parCategorieChart = Object.entries(fournisseursParCategorie)
    .map(([catId, set]) => ({ categorie: categoriesById[catId]?.nom_categorie ?? '—', fournisseurs: set.size }))
    .sort((a, b) => b.fournisseurs - a.fournisseurs);

  const sourcing = {
    nbFournisseursParCategorieMoyen,
    tauxMiseEnConcurrence: articlesAvecDevis.length ? (articlesBienConcurrences.length / articlesAvecDevis.length) * 100 : 0,
    parCategorieChart,
  };

  // =====================================================================
  // 3) Award / CBA — ecart prix vs moyenne marche sur les commandes reelles
  // =====================================================================
  const ecarts = cmd
    .filter((c) => avgPriceByArticle[c.article_id] > 0)
    .map((c) => ((avgPriceByArticle[c.article_id] - c.prix_unitaire) / avgPriceByArticle[c.article_id]) * 100);
  const award = {
    ecartPrixMoyen: avg(ecarts),
    nbCommandesEvaluees: ecarts.length,
  };

  // =====================================================================
  // 4) Contrats-cadres
  // =====================================================================
  let contratsFiltres = contrats;
  if (provinceId) contratsFiltres = contratsFiltres.filter((c) => matchesProvinceFournisseur(c.fournisseur_id));
  if (dateFrom || dateTo) {
    contratsFiltres = contratsFiltres.filter((c) => {
      if (dateTo && new Date(c.date_debut) > new Date(dateTo)) return false;
      if (dateFrom && new Date(c.date_fin) < new Date(dateFrom)) return false;
      return true;
    });
  }
  const contratsActifs = contratsFiltres.filter((c) => c.statut === 'actif');
  const contratsPourTaux = categorieId ? contratsFiltres.filter((c) => c.categorie_id === categorieId) : contratsFiltres;
  const today = new Date();
  const dans90j = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
  const echeancesProches = contratsActifs
    .filter((c) => new Date(c.date_fin) <= dans90j && new Date(c.date_fin) >= today)
    .map((c) => ({
      fournisseur_nom: fournisseursById[c.fournisseur_id]?.nom ?? '—',
      categorie_nom: categoriesById[c.categorie_id]?.nom_categorie ?? '—',
      date_fin: c.date_fin,
    }))
    .sort((a, b) => new Date(a.date_fin) - new Date(b.date_fin));

  const categoriesCouvertes = new Set(contratsActifs.map((c) => c.categorie_id));
  const contratsCadres = {
    tauxUtilisationMoyen: avg(contratsPourTaux.map((c) => c.taux_utilisation_pct)),
    couvertureCategorielle: (categoriesCouvertes.size / categories.length) * 100,
    nbContratsActifs: contratsActifs.length,
    echeancesProches,
  };

  // =====================================================================
  // 5) Commande -> Livraison
  // =====================================================================
  const livrees = cmd.filter((c) => c.date_livraison_reelle);
  const leadTimes = livrees.map((c) => daysBetween(c.date_pr, c.date_livraison_reelle));
  const livreesATemps = cmd.filter((c) => c.statut === 'livree_a_temps').length;

  const parMois = {};
  livrees.forEach((c) => {
    const mois = c.date_livraison_reelle.slice(0, 7);
    (parMois[mois] ||= []).push(daysBetween(c.date_pr, c.date_livraison_reelle));
  });
  const leadTimeParMois = Object.entries(parMois)
    .map(([mois, arr]) => ({ mois, leadTime: Math.round(avg(arr) * 10) / 10 }))
    .sort((a, b) => a.mois.localeCompare(b.mois));

  const livraison = {
    leadTimeMoyen: avg(leadTimes),
    tauxLivraisonATemps: livrees.length ? (livreesATemps / livrees.length) * 100 : 0,
    tauxAnnulation: nbPR ? (nbAnnulees / nbPR) * 100 : 0,
    leadTimeParMois,
  };

  // =====================================================================
  // 6) Performance fournisseur (classement, sur commandes livrees, min 3)
  // =====================================================================
  const parFournisseur = {};
  cmd.forEach((c) => {
    (parFournisseur[c.fournisseur_id] ||= []).push(c);
  });
  const classement = Object.entries(parFournisseur)
    .map(([fid, list]) => {
      const liv = list.filter((c) => c.date_livraison_reelle);
      const aTemps = list.filter((c) => c.statut === 'livree_a_temps').length;
      return {
        fournisseur_id: fid,
        fournisseur_nom: fournisseursById[fid]?.nom ?? '—',
        score_fiabilite: fournisseursById[fid]?.score_fiabilite ?? 0,
        nbCommandes: list.length,
        tauxATemps: liv.length ? (aTemps / liv.length) * 100 : null,
        leadTimeMoyen: avg(liv.map((c) => daysBetween(c.date_pr, c.date_livraison_reelle))),
      };
    })
    .filter((r) => r.nbCommandes >= 3);
  const classementParPerformance = [...classement].sort((a, b) => (b.tauxATemps ?? 0) - (a.tauxATemps ?? 0));

  const performanceFournisseur = {
    top5: classementParPerformance.slice(0, 5),
    bottom5: [...classementParPerformance].reverse().slice(0, 5),
  };

  // =====================================================================
  // 7) Financier
  // =====================================================================
  let coutEvite = 0;
  const expositionParFournisseur = {};
  const expositionParCategorie = {};
  const coutEviteParMoisMap = {};
  cmd.forEach((c) => {
    const montant = c.prix_unitaire * c.quantite;
    const prixMarche = avgPriceByArticle[c.article_id];
    const mois = c.date_pr.slice(0, 7);
    if (prixMarche > 0 && c.prix_unitaire < prixMarche) {
      const evite = (prixMarche - c.prix_unitaire) * c.quantite;
      coutEvite += evite;
      coutEviteParMoisMap[mois] = (coutEviteParMoisMap[mois] || 0) + evite;
    } else {
      coutEviteParMoisMap[mois] = coutEviteParMoisMap[mois] || 0;
    }
    const fNom = fournisseursById[c.fournisseur_id]?.nom ?? '—';
    expositionParFournisseur[fNom] = (expositionParFournisseur[fNom] || 0) + montant;
    const catNom = categoriesById[articlesById[c.article_id]?.categorie_id]?.nom_categorie ?? '—';
    expositionParCategorie[catNom] = (expositionParCategorie[catNom] || 0) + montant;
  });
  const financier = {
    coutEvite,
    expositionTotale: Object.values(expositionParFournisseur).reduce((a, b) => a + b, 0),
    topFournisseurs: Object.entries(expositionParFournisseur)
      .map(([nom, montant]) => ({ nom, montant }))
      .sort((a, b) => b.montant - a.montant)
      .slice(0, 8),
    parCategorie: Object.entries(expositionParCategorie)
      .map(([nom, montant]) => ({ nom, montant }))
      .sort((a, b) => b.montant - a.montant),
    coutEviteParMois: Object.entries(coutEviteParMoisMap)
      .map(([mois, montant]) => ({ mois, montant }))
      .sort((a, b) => a.mois.localeCompare(b.mois)),
  };

  return {
    filteredCounts: { commandes: cmd.length, devis: dev.length },
    needsAssessment,
    sourcing,
    award,
    contratsCadres,
    livraison,
    performanceFournisseur,
    financier,
  };
}
