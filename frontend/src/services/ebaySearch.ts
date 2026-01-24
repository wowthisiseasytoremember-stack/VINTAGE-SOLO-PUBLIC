/**
 * Opens eBay sold listings search for price comparison
 * @param itemTitle - The item title
 * @param year - Optional year/era to narrow search
 */
export function openEbayComps(itemTitle: string, year?: string): void {
  // Build a more specific search query
  let searchQuery = itemTitle;
  if (year && year !== 'Unknown') {
    searchQuery = `${itemTitle} ${year}`;
  }
  
  const params = new URLSearchParams({
    _nkw: searchQuery,
    LH_Sold: "1",
    LH_Complete: "1",
    _ipg: "60"
  });
  window.open(`https://www.ebay.com/sch/i.html?${params.toString()}`, '_blank');
}
