import { normalizeText } from './devisImport';

// =====================================================================
// Import PDF de devis — extraction heuristique cote navigateur.
//
// Important — transparence methodologique :
// Il n'y a PAS de veritable comprehension de document ici (pas de LLM).
// Faire cela correctement necessiterait d'envoyer le contenu a un modele
// (Claude, GPT...) via une API, ce qui exigerait une cle d'API detenue
// cote serveur — cette application est un frontend statique sans backend,
// et exposer une cle d'API dans le bundle client serait une faille de
// securite (meme logique que pour la conversion de devises OANDA).
//
// A la place : extraction du texte du PDF (pdfjs-dist, 100% local, sans
// cle), puis reconnaissance de motifs (regex) ligne par ligne pour
// retrouver un article du catalogue + un prix + une devise + un delai.
// C'est un "meilleur effort" qui fonctionne bien sur des devis simples
// (une ligne = un article), mais qui doit toujours etre verifie avant
// confirmation — d'ou la reutilisation du meme ecran de validation que
// l'import Excel/CSV, avec les memes erreurs si une ligne est ambigue.
// =====================================================================

async function loadPdfjs() {
  const pdfjsLib = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjsLib;
}

// Reconstruit des "lignes" de texte a partir des items positionnes du PDF
// (pdfjs ne fournit que des fragments de texte positionnes, pas des lignes).
export async function extractLinesFromPdf(file) {
  const pdfjsLib = await loadPdfjs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const lines = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const byY = new Map();
    content.items.forEach((item) => {
      const y = Math.round(item.transform[5] / 3) * 3; // tolerance verticale
      if (!byY.has(y)) byY.set(y, []);
      byY.get(y).push(item);
    });
    const sortedYs = Array.from(byY.keys()).sort((a, b) => b - a);
    sortedYs.forEach((y) => {
      const items = byY.get(y).sort((a, b) => a.transform[4] - b.transform[4]);
      const line = items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
      if (line) lines.push(line);
    });
  }
  return lines;
}

function parseNumber(raw) {
  let s = raw.trim().replace(/\s/g, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
  else if (lastDot > lastComma) s = s.replace(/,/g, '');
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

function detectDevise(line) {
  if (/CDF|\bFC\b/i.test(line)) return 'CDF';
  if (/EUR|€/i.test(line)) return 'EUR';
  if (/USD|\$/i.test(line)) return 'USD';
  return undefined;
}

// Retourne { formatted, raw } pour pouvoir a la fois afficher la date ISO
// et retirer sa correspondance brute de la ligne avant de chercher le prix
// (sinon les nombres d'une date comme "2026-12-31" sont pris pour un prix).
function detectDate(line) {
  const iso = line.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return { formatted: iso[0], raw: iso[0] };
  const eu = line.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (eu) {
    const [, d, m, y] = eu;
    return { formatted: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`, raw: eu[0] };
  }
  return undefined;
}

const ANNEE_RE = /^(19|20)\d{2}$/;

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Transforme des lignes de texte en "rawRows" au format canonique attendu
// par validateImportRows() de devisImport.js (memes cles que les alias
// d'en-tete Excel : article, prix_unitaire, devise, delai_livraison_jours,
// quantite_min, validite_offre_date) — permet de reutiliser exactement le
// meme pipeline de validation/apercu que l'import Excel/CSV.
export function parseQuoteLinesToRawRows(lines, articles) {
  const articlesTries = [...articles].sort((a, b) => b.nom_article.length - a.nom_article.length);

  return lines
    .map((line) => {
      const norm = normalizeText(line);
      const article = articlesTries.find((a) => {
        const an = normalizeText(a.nom_article);
        return an.length >= 4 && norm.includes(an);
      });
      if (!article) return null;

      // Le nom du catalogue peut lui-meme contenir des chiffres (ex: "70%",
      // "(boite 100)") : on le retire de la ligne avant de chercher le prix,
      // sinon ces chiffres sont pris pour le montant.
      const ligneSansArticle = line.replace(new RegExp(escapeRegex(article.nom_article), 'i'), ' ');

      let delai;
      let quantite;
      const delaiMatch = ligneSansArticle.match(/(\d{1,3})\s*(?:jours?|jrs?|days?|j\b)/i);
      if (delaiMatch) delai = Number(delaiMatch[1]);
      const qteMatch = ligneSansArticle.match(/(?:qte|quantit[ée]|moq|min)\D{0,5}(\d{1,5})/i);
      if (qteMatch) quantite = Number(qteMatch[1]);

      const dateInfo = detectDate(ligneSansArticle);

      // Retire aussi les segments delai/quantite/date deja identifies avant
      // de chercher les nombres restants, pour ne pas les reprendre comme
      // prix (comparaison textuelle, pas par valeur, pour eviter d'exclure a
      // tort un prix qui coinciderait numeriquement avec le delai/quantite).
      let lignePourPrix = ligneSansArticle;
      if (delaiMatch) lignePourPrix = lignePourPrix.replace(delaiMatch[0], ' ');
      if (qteMatch) lignePourPrix = lignePourPrix.replace(qteMatch[0], ' ');
      if (dateInfo) lignePourPrix = lignePourPrix.replace(dateInfo.raw, ' ');

      const numberTokens = lignePourPrix.match(/\d{1,3}(?:[\s.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?/g) || [];
      const candidatsPrix = numberTokens
        .map((t) => ({ raw: t, value: parseNumber(t) }))
        .filter((n) => n.value !== null && !ANNEE_RE.test(n.raw));
      const prix = candidatsPrix.length > 0
        ? candidatsPrix.reduce((max, n) => (n.value > max.value ? n : max), candidatsPrix[0]).value
        : undefined;

      return {
        article: article.nom_article,
        prix_unitaire: prix,
        devise: detectDevise(line),
        delai_livraison_jours: delai,
        quantite_min: quantite,
        validite_offre_date: dateInfo?.formatted,
        _ligneSource: line,
      };
    })
    .filter(Boolean);
}

export async function extractRowsFromPdf(file, articles) {
  const lines = await extractLinesFromPdf(file);
  return parseQuoteLinesToRawRows(lines, articles);
}
