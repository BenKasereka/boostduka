import { dataMode } from '../lib/dataSource';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard KPI', etape: 5, ready: true },
  { key: 'liste-prix', label: 'Liste de Prix', etape: 2, ready: true },
  { key: 'fournisseurs', label: 'Base Fournisseurs', etape: 2, ready: true },
  { key: 'demande-interne', label: 'Demande Interne (PR)', etape: 1, ready: true },
  { key: 'demande-devis', label: 'Demande de devis (RFQ)', etape: 7, ready: true },
  { key: 'import', label: 'Import de devis', etape: 7, ready: true },
  { key: 'synthese', label: 'Synthèse comparative', etape: 3, ready: true },
  { key: 'cba', label: 'CBA (Bid Analysis)', etape: 4, ready: true },
  { key: 'po', label: 'Bon de Commande (PO)', etape: 4, ready: true },
  { key: 'reception', label: 'Réception', etape: 5, ready: true },
  { key: 'configuration', label: '⚙ Configuration', etape: 8, ready: true },
];

export default function AppShell({ activePage, onNavigate, children }) {
  return (
    <div className="app-shell-root h-screen flex overflow-hidden">
      <aside className="no-print relative w-64 shrink-0 bg-marine-700 text-white flex flex-col h-full overflow-y-auto">
        {/* Bordure "bleu verdâtre" — meme degrade emeraude -> marine que la
            barre d'en-tete du Dashboard, pour que le fil conducteur de la
            charte graphique se voie sur toute l'application, pas seulement
            sur une page. Plus large + lueur plus marquee pour rester lisible
            a cote du vert vif de l'en-tete Dashboard (sinon la jonction des
            deux blocs de couleur choque au lieu de s'enchainer). */}
        <div
          className="absolute inset-y-0 right-0 w-1 pointer-events-none z-10"
          style={{
            background: 'linear-gradient(180deg, #059669 0%, #0E7C86 45%, #1E3A8A 100%)',
            boxShadow: '0 0 18px 2px rgba(14, 124, 134, 0.65)',
          }}
        />
        {/* Sur le Dashboard, une lueur emeraude en haut du sidebar fait
            l'appoint entre le bloc logo (marine plein) et le vert vif de
            l'en-tete juste a cote — sans ca, la jonction des deux blocs de
            couleur est un choc plutot qu'une transition. */}
        <div
          className="px-5 py-4 border-b border-white/10 relative"
          style={activePage === 'dashboard' ? { background: 'linear-gradient(135deg, rgba(5,150,105,0.35) 0%, transparent 70%)' } : undefined}
        >
          <div className="text-xs uppercase tracking-widest text-marine-100/70">VISIBA Logistics Group</div>
          <div className="text-lg font-semibold leading-tight mt-1">BoostDuka</div>
        </div>
        <nav className="flex-1 py-2">
          {NAV_ITEMS.map((item) => {
            const isActive = activePage === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                className={`w-full text-left px-5 py-2 text-sm flex items-center justify-between gap-2 transition-colors
                  ${isActive ? 'bg-white/10 text-white font-medium border-l-4 border-or-600' : 'text-marine-100/85 hover:bg-white/5 border-l-4 border-transparent'}`}
              >
                <span>{item.label}</span>
                {!item.ready && (
                  <span className="badge bg-white/10 text-marine-100/70 text-[10px]">Étape {item.etape}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="px-5 py-3 border-t border-white/10 text-[11px] text-marine-100/60">
          Source de données : <span className="font-medium text-marine-100">{dataMode()}</span>
        </div>
      </aside>
      <main className="flex-1 min-w-0 flex flex-col">
        <header
          className={`no-print h-14 flex items-center px-6 justify-between ${
            activePage === 'dashboard' ? 'dashboard-header' : 'border-b border-slate-200 bg-white'
          }`}
        >
          <div className={`text-sm ${activePage === 'dashboard' ? 'text-white font-medium' : 'text-slate-500'}`}>
            Intersection Procurement — 6 bases opérationnelles RDC
          </div>
          <div
            className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              activePage === 'dashboard' ? 'text-emeraude-700 bg-white' : 'text-emeraude-700 bg-emeraude-50'
            }`}
          >
            Portfolio Demo
          </div>
        </header>
        <div className={`app-main-scroll flex-1 min-w-0 p-6 overflow-auto ${activePage === 'dashboard' ? 'dashboard-backdrop' : ''}`}>{children}</div>
      </main>
    </div>
  );
}

export { NAV_ITEMS };
