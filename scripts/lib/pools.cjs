'use strict';
// =====================================================================
// Référentiels utilisés par generate-dataset.js
// Noms d'entreprises et de personnes 100% fictifs (aucune marque réelle).
// =====================================================================

const PROVINCES = [
  'Kinshasa',
  'Nord-Kivu',
  'Sud-Kivu',
  'Haut-Katanga',
  'Ituri',
  'Kasai-Central',
];

// Une base VISIBA par province, avec une ville de rattachement plausible
const SECTIONS = [
  { nom_base: 'Base VISIBA Kinshasa', province: 'Kinshasa', ville: 'Kinshasa' },
  { nom_base: 'Base VISIBA Goma', province: 'Nord-Kivu', ville: 'Goma' },
  { nom_base: 'Base VISIBA Bukavu', province: 'Sud-Kivu', ville: 'Bukavu' },
  { nom_base: 'Base VISIBA Lubumbashi', province: 'Haut-Katanga', ville: 'Lubumbashi' },
  { nom_base: 'Base VISIBA Bunia', province: 'Ituri', ville: 'Bunia' },
  { nom_base: 'Base VISIBA Kananga', province: 'Kasai-Central', ville: 'Kananga' },
];

// Villes secondaires par province pour varier la localisation des fournisseurs
const VILLES_PAR_PROVINCE = {
  'Kinshasa': ['Kinshasa', 'Kinshasa - Limete', 'Kinshasa - Gombe', 'Kinshasa - Ngaliema'],
  'Nord-Kivu': ['Goma', 'Butembo', 'Beni'],
  'Sud-Kivu': ['Bukavu', 'Uvira', 'Kamituga'],
  'Haut-Katanga': ['Lubumbashi', 'Likasi', 'Kasumbalesa'],
  'Ituri': ['Bunia', 'Mahagi', 'Aru'],
  'Kasai-Central': ['Kananga', 'Tshikapa', 'Luiza'],
};

const PRENOMS = [
  'Jean-Pierre', 'Marie', 'Patrick', 'Grace', 'Emmanuel', 'Chantal', 'Joseph',
  'Bijou', 'Trésor', 'Espérance', 'Bienvenu', 'Christelle', 'Dieudonné', 'Nadège',
  'Papy', 'Rachel', 'Gloire', 'Fiston', 'Aline', 'Guelord', 'Prisca', 'Alain',
  'Solange', 'Yves', 'Justine', 'Bertin', 'Clarisse', 'Serge', 'Divine', 'Moïse',
];

const NOMS = [
  'Mukendi', 'Kabongo', 'Tshisekedi', 'Kalala', 'Ilunga', 'Mwamba', 'Kasongo',
  'Lukusa', 'Ngoyi', 'Kayembe', 'Mbayo', 'Nkulu', 'Kazadi', 'Muyej', 'Ntumba',
  'Bakajika', 'Lubaki', 'Mande', 'Cirhuza', 'Byaene', 'Mapendo', 'Kahindo',
  'Amisi', 'Lokombe', 'Bofasa', 'Mputu', 'Tshibangu', 'Kongolo', 'Wetshi',
];

// Fragments pour composer des raisons sociales fictives plausibles
const ENTREPRISE_PREFIXES = [
  'Kivu', 'Congo', 'Elikya', 'Mbote', 'Tembo', 'Simba', 'Uzima', 'Malaika',
  'Nzuri', 'Amani', 'Bomoko', 'Lokole', 'Kasai', 'Lualaba', 'Virunga',
  'Ruwenzori', 'Zamani', 'Bonsomi', 'Esengo', 'Tumaini', 'Bakuba', 'Lomami',
  'Katanga Plus', 'Mont Ngaliema', 'Fleuve', 'Lac Kivu', 'Boyoma', 'Salongo',
];

const ENTREPRISE_SUFFIXES = [
  'Trading Co', 'Supply Co', 'General Merchandise', 'Import-Export',
  'Logistics', 'Distribution', 'Group SARL', 'Enterprises', '& Fils',
  'Services SARL', 'Trading SPRL', 'Commercial House', 'Freight & Supply',
  'Multiservices', 'Business Group',
];

const CONDITIONS_PAIEMENT = [
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

// 15 categories, chacune avec 10-20 articles types (nom + unite de mesure)
const CATEGORIES = [
  {
    nom: 'Medical / PharMed',
    articles: [
      ['Gants latex examen (boite 100)', 'boite'],
      ['Seringues 5ml jetables', 'unite'],
      ['Paracetamol 500mg (boite 1000cp)', 'boite'],
      ['Kit de premiers secours complet', 'kit'],
      ['Amoxicilline 500mg (boite 100cp)', 'boite'],
      ['Solution de rehydratation orale (SRO)', 'sachet'],
      ['Thermometre digital', 'unite'],
      ['Compresses steriles', 'paquet'],
      ['Alcool desinfectant 70% (1L)', 'litre'],
      ['Masques chirurgicaux (boite 50)', 'boite'],
      ['Sonde urinaire', 'unite'],
      ['Kit accouchement propre', 'kit'],
      ['Perfuseur IV', 'unite'],
      ['Test de diagnostic rapide paludisme', 'unite'],
      ['Glucometre + bandelettes', 'kit'],
    ],
  },
  {
    nom: 'WASH (Eau-Hygiene-Assainissement)',
    articles: [
      ['Pastilles de purification d\'eau', 'boite'],
      ['Bidon plastique 20L', 'unite'],
      ['Savon de menage (barre 200g)', 'unite'],
      ['Filtre a eau ceramique', 'unite'],
      ['Chlore liquide (bidon 5L)', 'bidon'],
      ['Kit hygiene familial', 'kit'],
      ['Latrine mobile prefabriquee', 'unite'],
      ['Seau plastique 15L avec couvercle', 'unite'],
      ['Reservoir souple 5000L', 'unite'],
      ['Tuyau PVC 1 pouce (rouleau 50m)', 'rouleau'],
      ['Pompe manuelle a eau', 'unite'],
      ['Savon liquide desinfectant (5L)', 'bidon'],
    ],
  },
  {
    nom: 'NFI (Biens non-alimentaires)',
    articles: [
      ['Bache plastique renforcee 4x6m', 'unite'],
      ['Couverture en laine', 'unite'],
      ['Natte de couchage', 'unite'],
      ['Moustiquaire impregnee', 'unite'],
      ['Kit de cuisine familial', 'kit'],
      ['Jerrican pliable 10L', 'unite'],
      ['Lampe solaire portable', 'unite'],
      ['Tente familiale', 'unite'],
      ['Kit dignite (hygiene feminine)', 'kit'],
      ['Set de vaisselle plastique', 'set'],
    ],
  },
  {
    nom: 'Carburant / Energie',
    articles: [
      ['Gasoil (litre)', 'litre'],
      ['Essence sans plomb (litre)', 'litre'],
      ['Petrole lampant (litre)', 'litre'],
      ['Gaz butane (bouteille 12kg)', 'bouteille'],
      ['Bidon carburant 200L', 'unite'],
      ['Huile moteur 20W50 (5L)', 'bidon'],
      ['Panneau solaire 150W', 'unite'],
      ['Batterie solaire 100Ah', 'unite'],
      ['Filtre a carburant', 'unite'],
      ['Pompe a carburant manuelle', 'unite'],
    ],
  },
  {
    nom: 'Pieces detachees vehicules',
    articles: [
      ['Batterie vehicule 12V 75Ah', 'unite'],
      ['Pneu 4x4 235/85 R16', 'unite'],
      ['Plaquettes de frein (jeu)', 'jeu'],
      ['Filtre a huile', 'unite'],
      ['Filtre a air', 'unite'],
      ['Courroie de distribution', 'unite'],
      ['Amortisseur avant', 'unite'],
      ['Radiateur moteur', 'unite'],
      ['Kit embrayage', 'kit'],
      ['Ampoule phare 12V', 'unite'],
    ],
  },
  {
    nom: 'IT / Telecommunications',
    articles: [
      ['Ordinateur portable standard', 'unite'],
      ['Routeur Wi-Fi', 'unite'],
      ['Modem satellite VSAT', 'unite'],
      ['Radio VHF portable', 'unite'],
      ['Disque dur externe 1To', 'unite'],
      ['Onduleur 650VA', 'unite'],
      ['Cable reseau UTP (rouleau 300m)', 'rouleau'],
      ['Imprimante multifonction', 'unite'],
      ['Carte SIM data professionnelle', 'unite'],
      ['Camera de videosurveillance', 'unite'],
    ],
  },
  {
    nom: 'Materiaux de construction',
    articles: [
      ['Ciment (sac 50kg)', 'sac'],
      ['Fer a beton 12mm (barre 12m)', 'barre'],
      ['Tole ondulee galvanisee', 'unite'],
      ['Sable de construction (m3)', 'm3'],
      ['Gravier (m3)', 'm3'],
      ['Brique cuite', 'unite'],
      ['Peinture batiment (20L)', 'bidon'],
      ['Contreplaque 18mm', 'planche'],
      ['Clous de construction (kg)', 'kg'],
      ['Tuyau PVC evacuation 100mm', 'unite'],
    ],
  },
  {
    nom: 'Groupes electrogenes',
    articles: [
      ['Groupe electrogene 10kVA', 'unite'],
      ['Groupe electrogene 25kVA', 'unite'],
      ['Groupe electrogene 60kVA', 'unite'],
      ['Cable electrique 3x2.5mm (rouleau)', 'rouleau'],
      ['Disjoncteur 63A', 'unite'],
      ['Kit maintenance groupe electrogene', 'kit'],
      ['Regulateur de tension AVR', 'unite'],
      ['Cable de terre cuivre (rouleau)', 'rouleau'],
      ['Prise industrielle 32A', 'unite'],
      ['Compteur horaire groupe electrogene', 'unite'],
    ],
  },
  {
    nom: 'Alimentaire / Nutrition',
    articles: [
      ['Farine de mais fortifiee (sac 25kg)', 'sac'],
      ['Huile vegetale (bidon 5L)', 'bidon'],
      ['Haricots secs (sac 50kg)', 'sac'],
      ['Riz blanc (sac 50kg)', 'sac'],
      ['Sel iode (sac 25kg)', 'sac'],
      ['Plumpy\'nut (carton 150 sachets)', 'carton'],
      ['Lait therapeutique F-100 (boite)', 'boite'],
      ['Sucre (sac 50kg)', 'sac'],
      ['Sardines en conserve (carton 50)', 'carton'],
    ],
  },
  {
    nom: 'EPI (Equipement protection individuelle)',
    articles: [
      ['Casque de chantier', 'unite'],
      ['Gants de manutention cuir', 'paire'],
      ['Chaussures de securite S3', 'paire'],
      ['Gilet reflechissant', 'unite'],
      ['Lunettes de protection', 'unite'],
      ['Combinaison de protection', 'unite'],
      ['Masque anti-poussiere FFP2', 'boite'],
      ['Harnais de securite', 'unite'],
      ['Bouchons d\'oreille (boite)', 'boite'],
    ],
  },
  {
    nom: 'Mobilier / Bureau',
    articles: [
      ['Bureau de travail metallique', 'unite'],
      ['Chaise de bureau', 'unite'],
      ['Armoire metallique 2 portes', 'unite'],
      ['Table de reunion', 'unite'],
      ['Ramette papier A4 (80g)', 'ramette'],
      ['Classeur a levier', 'unite'],
      ['Cartouche imprimante', 'unite'],
      ['Chaise pliante plastique', 'unite'],
      ['Container de rangement metallique', 'unite'],
    ],
  },
  {
    nom: 'Transport / Freight',
    articles: [
      ['Transport routier 1 tonne / 100km', 'forfait'],
      ['Location camion 10 tonnes / jour', 'jour'],
      ['Transit portuaire (conteneur 20 pieds)', 'conteneur'],
      ['Transport aerien humanitaire (kg)', 'kg'],
      ['Location vehicule 4x4 / jour', 'jour'],
      ['Manutention entrepot (tonne)', 'tonne'],
      ['Assurance cargo (par expedition)', 'expedition'],
      ['Palette bois standard', 'unite'],
      ['Sangle d\'arrimage', 'unite'],
      ['Bache de protection cargo', 'unite'],
    ],
  },
  {
    nom: 'Textile / Uniformes',
    articles: [
      ['Uniforme agent de terrain (set)', 'set'],
      ['Tissu wax (piece 6 yards)', 'piece'],
      ['Bache de tente (m2)', 'm2'],
      ['Sac de couchage', 'unite'],
      ['Chemise professionnelle', 'unite'],
      ['Veste de pluie impermeable', 'unite'],
      ['Casquette brodee logo', 'unite'],
      ['Bottes en caoutchouc', 'paire'],
      ['Chapeau de brousse', 'unite'],
      ['Sous-vetements thermiques', 'set'],
    ],
  },
  {
    nom: 'Outillage / Equipement technique',
    articles: [
      ['Groupe de forage manuel', 'kit'],
      ['Boite a outils complete', 'kit'],
      ['Generateur portable essence 2kVA', 'unite'],
      ['Pompe a eau motorisee', 'unite'],
      ['Perceuse electrique', 'unite'],
      ['Echelle aluminium 6m', 'unite'],
      ['Brouette de chantier', 'unite'],
      ['Groupe soudure portable', 'unite'],
      ['Cle a molette set', 'set'],
      ['Niveau a bulle', 'unite'],
    ],
  },
  {
    nom: 'Produits d\'hygiene / Nettoyage',
    articles: [
      ['Eau de javel (bidon 5L)', 'bidon'],
      ['Detergent en poudre (sac 5kg)', 'sac'],
      ['Papier toilette (carton 48 rouleaux)', 'carton'],
      ['Gel hydroalcoolique (500ml)', 'unite'],
      ['Balai + serpillere kit', 'kit'],
      ['Poubelle avec couvercle 60L', 'unite'],
      ['Gants menagers (paire)', 'paire'],
      ['Desinfectant surfaces (5L)', 'bidon'],
      ['Chiffons de nettoyage (paquet)', 'paquet'],
      ['Desodorisant sanitaire', 'unite'],
    ],
  },
  {
    nom: 'Fourniture de Bureau',
    articles: [
      ['Stylo a bille (boite 50)', 'boite', 'Encre bleue, pointe fine 0.7mm, corps plastique transparent'],
      ['Crayon graphite HB (boite 50)', 'boite', 'Mine HB standard, bois gaine hexagonale'],
      ['Marqueur permanent (boite 12)', 'boite', 'Pointe biseautee, encre noire resistante a l\'eau'],
      ['Surligneur fluorescent (boite 10)', 'boite', 'Couleurs assorties, pointe biseautee 1-4mm'],
      ['Papier A4 80g (carton 5 ramettes)', 'carton', 'Blancheur 96%, format A4 210x297mm, 500 feuilles/ramette'],
      ['Enveloppe A4 (paquet 100)', 'paquet', 'Kraft brun, fermeture auto-adhesive, format C4'],
      ['Agrafeuse de bureau', 'unite', 'Capacite 20 feuilles, agrafes n.10'],
      ['Agrafes n.10 (boite 1000)', 'boite', 'Standard, galvanisees'],
      ['Classeur a levier (dos 8cm)', 'unite', 'Carton rigide plastifie, format A4'],
      ['Post-it 76x76mm (paquet 12 blocs)', 'paquet', 'Couleurs assorties, 100 feuilles/bloc'],
      ['Perforateur 2 trous', 'unite', 'Capacite 20 feuilles, entraxe 80mm'],
      ['Cartouche encre imprimante (noir)', 'unite', 'Compatible imprimantes jet d\'encre standard, rendement 300 pages'],
      ['Calculatrice de bureau', 'unite', 'Ecran 12 chiffres, alimentation solaire + pile'],
      ['Ciseaux de bureau', 'unite', 'Lame acier inoxydable, longueur 21cm'],
    ],
  },
  {
    nom: 'Service d\'Impression et Visibilite',
    articles: [
      ['Banderole PVC brandee (m2)', 'm2', 'Bache PVC 440g/m2, impression numerique quadrichromie, oeillets tous les 50cm'],
      ['T-shirt brande logo (unite)', 'unite', 'Coton 180g, impression serigraphie 1-3 couleurs, tailles S a XXL'],
      ['Gilet floque visibilite (unite)', 'unite', 'Tissu polyester, bandes reflechissantes, logo floque poitrine/dos'],
      ['Casquette brodee logo (unite)', 'unite', 'Coton, broderie logo avant, reglable a l\'arriere'],
      ['Autocollant vinyle logo (planche)', 'planche', 'Vinyle adhesif exterieur, decoupe a la forme, format A3'],
      ['Panneau signaletique rigide (unite)', 'unite', 'PVC expanse 5mm, impression UV, format 60x40cm'],
      ['Carte de visite (paquet 500)', 'paquet', 'Papier couche 350g, recto-verso quadrichromie, format standard 85x55mm'],
      ['Calendrier mural brande (unite)', 'unite', 'Papier couche 200g, 12 pages + couverture, format A3'],
      ['Roll-up publicitaire (unite)', 'unite', 'Structure aluminium enroulable, toile impression 85x200cm'],
      ['Impression documents A4 (page)', 'page', 'Impression noir et blanc ou couleur, papier 80g'],
      ['Badge nominatif plastifie (unite)', 'unite', 'PVC rigide, impression couleur, cordon inclus'],
    ],
  },
  {
    nom: 'Materiels Electronique et Electrique',
    articles: [
      ['Rallonge electrique 5m (unite)', 'unite', '3 prises, cable 3x1.5mm2, fiche terre'],
      ['Multiprise parafoudre 6 prises', 'unite', 'Protection surtension 250V, interrupteur lumineux'],
      ['Cable electrique souple 2x1.5mm (rouleau 100m)', 'rouleau', 'Gaine PVC, usage interieur, norme NF'],
      ['Interrupteur simple allumage', 'unite', 'Encastrable, 10A/250V, montage saillie ou encastre'],
      ['Ampoule LED culot E27 (boite 10)', 'boite', '9W equivalent 60W, lumiere blanche 6500K, 806 lumens'],
      ['Ventilateur de bureau', 'unite', '3 vitesses, oscillation automatique, diametre pales 30cm'],
      ['Batterie rechargeable AA (paquet 4)', 'paquet', 'NiMH 2000mAh, rechargeable 500 cycles'],
      ['Chargeur de batteries universel', 'unite', 'Compatible AA/AAA, alimentation secteur 220V'],
      ['Adaptateur/chargeur telephone USB', 'unite', 'Sortie 5V/2A, connecteur USB-A, cable inclus'],
      ['Regulateur de tension (stabilisateur)', 'unite', 'Puissance 1000VA, protection sous/sur-tension'],
      ['Lampe torche rechargeable', 'unite', 'LED haute intensite, batterie lithium integree, port USB de charge'],
      ['Prise multiple industrielle 16A', 'unite', 'IP44, montage mural, cable 1.5m'],
    ],
  },
];

module.exports = {
  PROVINCES,
  SECTIONS,
  VILLES_PAR_PROVINCE,
  PRENOMS,
  NOMS,
  ENTREPRISE_PREFIXES,
  ENTREPRISE_SUFFIXES,
  CONDITIONS_PAIEMENT,
  CATEGORIES,
};
