import { dataMode } from '../lib/dataSource';

const NAV_ITEMS = [
  { key: 'liste-prix', label: 'Liste de Prix', etape: 2, ready: true },
  { key: 'fournisseurs', label: 'Base Fournisseurs', etape: 2, ready: true },
  { key: 'import', label: 'Import de devis', etape: 7, ready: true },
  { key: 'synthese', label: 'Synthèse comparative', etape: 3, ready: true },
  { key: 'cba', label: 'CBA (Bid Analysis)', etape: 4, ready: true },
  { key: 'dashboard', label: 'Dashboard KPI', etape: 5, ready: true },
  { key: 'export-pbi', label: 'Export Power BI', etape: 6, ready: true },
  { key: 'configuration', label: '⚙ Configuration', etape: 8, ready: true },
];

export default function AppShell({ activePage, onNavigate, children }) {
  return (
    <div className="app-shell-root h-screen flex overflow-hidden">
      <aside className="no-print w-64 shrink-0 bg-marine-700 text-white flex flex-col h-full overflow-y-auto">
        <div className="px-5 py-6 border-b border-white/10">
          <div className="text-xs uppercase tracking-widest text-marine-100/70">VISIBA Logistics Group</div>
          <div className="text-lg font-semibold leading-tight mt-1">BoostDuka</div>
        </div>
        <nav className="flex-1 py-4">
          {NAV_ITEMS.map((item) => {
            const isActive = activePage === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                className={`w-full text-left px-5 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors
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
        <div className="px-5 py-4 border-t border-white/10 text-[11px] text-marine-100/60">
          Source de données : <span className="font-medium text-marine-100">{dataMode()}</span>
        </div>
      </aside>
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="no-print h-14 border-b border-slate-200 bg-white flex items-center px-6 justify-between">
          <div className="text-sm text-slate-500">
            Intersection Procurement — 6 bases opérationnelles RDC
          </div>
          <div className="text-xs text-emeraude-700 bg-emeraude-50 px-2.5 py-1 rounded-full font-medium">
            Portfolio Demo
          </div>
        </header>
        <div className="app-main-scroll flex-1 min-w-0 p-6 overflow-auto">{children}</div>
      </main>
    </div>
  );
}

export { NAV_ITEMS };
