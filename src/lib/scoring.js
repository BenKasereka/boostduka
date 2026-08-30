// =====================================================================
// Moteur de scoring pondere multicriteres — Module 3 (Synthese comparative)
//
// Methodologie (documentee car deux criteres n'existent pas tels quels
// dans le schema et sont deduits par proxy) :
//  - Prix            : normalise sur les candidats (moins cher = 100)
//  - Qualite         : proxy = fournisseurs.score_fiabilite (0-100 direct)
//  - Delai           : normalise sur les candidats (plus rapide = 100)
//  - Disponibilite   : fournisseur actif + offre encore valide = 100,
//                      actif mais offre expiree = 60, non actif = 0
//  - Conditions paiement : grille de notation fixe (voir PAYMENT_TERMS_SCORE),
//                      plus le credit accorde a l'acheteur est long, plus
//                      la note est haute
// =====================================================================

export const DEFAULT_WEIGHTS = {
  prix: 35,
  qualite: 25,
  delai: 20,
  disponibilite: 10,
  conditions: 10,
};

export const CRITERES = [
  { key: 'prix', label: 'Prix' },
  { key: 'qualite', label: 'Qualité / Fiabilité' },
  { key: 'delai', label: 'Délai de livraison' },
  { key: 'disponibilite', label: 'Disponibilité' },
  { key: 'conditions', label: 'Conditions de paiement' },
];

// Grille de notation des conditions de paiement (0-100, plus haut = plus favorable a l'acheteur)
export const PAYMENT_TERMS_SCORE = {
  'Net 60': 100,
  'Net 45': 85,
  'Net 30 apres reception facture': 75,
  'Net 30': 70,
  '30% avance / 70% a 30 jours': 45,
  'Paiement comptant a la livraison': 30,
  '50% avance / 50% a la livraison': 20,
};

function scorePaymentTerms(conditions) {
  return PAYMENT_TERMS_SCORE[conditions] ?? 50; // valeur neutre si condition non repertoriee
}

function normalize(values, value, higherIsBetter) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return 100;
  const ratio = (value - min) / (max - min);
  return Math.round((higherIsBetter ? ratio : 1 - ratio) * 100 * 100) / 100;
}

export function computeScores(candidats, weights = DEFAULT_WEIGHTS, today = new Date()) {
  // Comparaison sur l'equivalent USD : des prix bruts en devises differentes
  // (ex: CDF vs USD) ne sont pas comparables sans conversion prealable.
  const prix = candidats.map((c) => c.prix_unitaire_usd ?? c.prix_unitaire);
  const delais = candidats.map((c) => c.delai_livraison_jours);

  const weightSum = Object.values(weights).reduce((a, b) => a + b, 0) || 1;

  return candidats
    .map((c) => {
      const scorePrix = normalize(prix, c.prix_unitaire_usd ?? c.prix_unitaire, false);
      const scoreQualite = c.score_fiabilite;
      const scoreDelai = normalize(delais, c.delai_livraison_jours, false);
      const offreValide = !c.validite_offre_date || new Date(c.validite_offre_date) >= today;
      const scoreDisponibilite = c.fournisseur_statut !== 'actif' ? 0 : offreValide ? 100 : 60;
      const scoreConditions = scorePaymentTerms(c.conditions_paiement);

      const totalPondere =
        (scorePrix * weights.prix +
          scoreQualite * weights.qualite +
          scoreDelai * weights.delai +
          scoreDisponibilite * weights.disponibilite +
          scoreConditions * weights.conditions) /
        weightSum;

      return {
        ...c,
        scores: {
          prix: scorePrix,
          qualite: scoreQualite,
          delai: scoreDelai,
          disponibilite: scoreDisponibilite,
          conditions: scoreConditions,
          total: Math.round(totalPondere * 100) / 100,
        },
      };
    })
    .sort((a, b) => b.scores.total - a.scores.total);
}
