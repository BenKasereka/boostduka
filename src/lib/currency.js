// =====================================================================
// Conversion multi-devises.
//
// Important — transparence methodologique :
// Il ne s'agit PAS d'un flux OANDA en temps reel. Cette application est
// un frontend statique (Vite SPA) sans backend a elle : appeler l'API
// OANDA directement depuis le navigateur exposerait la cle d'API de
// facon publique dans le bundle, ce qui est une faille de securite.
// Un vrai flux temps reel necessiterait un petit proxy serveur (route
// Vercel/Supabase Edge Function) qui detient la cle cote serveur.
// En attendant, les taux ci-dessous sont des taux de reference fixes,
// a mettre a jour manuellement (voir REFERENCE_DATE). Le code est
// architecture pour que brancher un vrai flux plus tard ne change que
// getRates() ci-dessous, sans toucher au reste de l'application.
// =====================================================================

export const REFERENCE_DATE = '2026-08-01';

// Taux indicatifs vers USD (1 unite de la devise = X USD)
export const CURRENCIES = [
  { code: 'USD', label: 'Dollar americain', symbole: '$', rateToUsd: 1 },
  { code: 'CDF', label: 'Franc congolais', symbole: 'FC', rateToUsd: 1 / 2800 },
  { code: 'EUR', label: 'Euro', symbole: '€', rateToUsd: 1.08 },
  // Devises secondaires — a selectionner selon le pays du fournisseur/client
  { code: 'GBP', label: 'Livre sterling', symbole: '£', rateToUsd: 1.27 },
  { code: 'XAF', label: 'Franc CFA (CEMAC)', symbole: 'FCFA', rateToUsd: 1 / 610 },
  { code: 'XOF', label: 'Franc CFA (UEMOA)', symbole: 'FCFA', rateToUsd: 1 / 610 },
  { code: 'RWF', label: 'Franc rwandais', symbole: 'FRw', rateToUsd: 1 / 1350 },
  { code: 'UGX', label: 'Shilling ougandais', symbole: 'USh', rateToUsd: 1 / 3750 },
  { code: 'KES', label: 'Shilling kenyan', symbole: 'KSh', rateToUsd: 1 / 129 },
  { code: 'ZAR', label: 'Rand sud-africain', symbole: 'R', rateToUsd: 1 / 18.3 },
];

// Les 3 devises principales de l'outil (CDF/USD/EUR), le reste est
// propose comme devises secondaires selon le contexte du fournisseur.
export const DEVISES_PRINCIPALES = ['USD', 'CDF', 'EUR'];

const CURRENCIES_BY_CODE = Object.fromEntries(CURRENCIES.map((c) => [c.code, c]));

export function getRateToUsd(code) {
  return CURRENCIES_BY_CODE[code]?.rateToUsd ?? 1;
}

export function toUsd(amount, code) {
  return amount * getRateToUsd(code);
}

export function fromUsd(amountUsd, code) {
  return amountUsd / getRateToUsd(code);
}

export function convert(amount, fromCode, toCode) {
  return fromUsd(toUsd(amount, fromCode), toCode);
}

export function formatMoney(amount, code, { decimals } = {}) {
  const c = CURRENCIES_BY_CODE[code];
  const d = decimals ?? (code === 'CDF' || code === 'UGX' || code === 'RWF' ? 0 : 2);
  const formatted = amount.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  return c ? `${formatted} ${c.symbole}` : `${formatted} ${code}`;
}

export function listCurrencies() {
  return CURRENCIES;
}

// Convertit un montant pour affichage selon la preference utilisateur :
// une devise principale (toujours affichee) et, si choisie, une devise
// secondaire de conversion affichee en complement (mode "double affichage").
export function convertPourAffichage(amount, deviseOriginale, devisePrincipale, deviseSecondaire) {
  const principal = convert(amount, deviseOriginale, devisePrincipale);
  const secondaire = deviseSecondaire && deviseSecondaire !== devisePrincipale
    ? convert(amount, deviseOriginale, deviseSecondaire)
    : null;
  return { principal, principalCode: devisePrincipale, secondaire, secondaireCode: deviseSecondaire };
}
