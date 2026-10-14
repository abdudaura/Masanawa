/** Only mobile data bundles may enter NEW Flutterwave bill purchases.
 * Old quotes, receipts and refund/reconciliation histories stay readable.
 * Match canonical category codes, never free-form names/item descriptions.
 */
export function isDataBundleCategory(code: string): boolean {
  return /^(?:MOBILE[_-]?DATA|DATA|INTERNET(?:[_-]?DATA)?)$/iu.test(code.trim());
}

export function requireDataBundleCategory(code: string): void {
  if (!isDataBundleCategory(code)) {
    throw new Error("financial.billing.data_only");
  }
}
