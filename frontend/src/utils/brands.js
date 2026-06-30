export function sortBrandsByName(brands = []) {
  return [...brands].sort((a, b) => (
    String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' })
  ))
}
