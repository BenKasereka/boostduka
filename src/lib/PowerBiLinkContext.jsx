import { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'visiba_powerbi_lien_public';

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

const PowerBiLinkContext = createContext(null);

// Lien vers le rapport Power BI publie ("Publier sur le web (public)"),
// configurable une fois le rapport publie manuellement dans Power BI Desktop
// (voir supabase/modele_donnees_PBI.md section 7). Tant que ce lien n'est
// pas renseigne, le module Export Power BI se limite a l'export des tables.
export function PowerBiLinkProvider({ children }) {
  const [lienPowerBI, setLienPowerBI] = useState(readStored());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lienPowerBI);
  }, [lienPowerBI]);

  return (
    <PowerBiLinkContext.Provider value={{ lienPowerBI, setLienPowerBI }}>
      {children}
    </PowerBiLinkContext.Provider>
  );
}

export function usePowerBiLink() {
  const ctx = useContext(PowerBiLinkContext);
  if (!ctx) throw new Error('usePowerBiLink doit être utilisé sous PowerBiLinkProvider');
  return ctx;
}
