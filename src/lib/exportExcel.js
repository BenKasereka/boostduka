// sheets: [{ name: 'Liste de prix', rows: [...] }, ...]
// xlsx est charge dynamiquement pour ne pas alourdir le bundle initial
// (uniquement necessaire au moment d'un export).
export async function exportToExcel(sheets, filename) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, rows }) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  });
  XLSX.writeFile(wb, filename);
}
