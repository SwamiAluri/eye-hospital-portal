/** Canonical login selector copy — selects Tenant / Network Hospital, never Branch. */
export const AUTH_NETWORK_HOSPITAL_FIELD = {
  id: 'network-hospital',
  label: 'Network Hospital',
  placeholder: 'Select your network hospital',
  loadingText: 'Loading network hospitals…',
} as const;

/** Guard: operational branch names must not appear as Network Hospital options. */
export function isBranchNameInNetworkHospitalOptions(
  networkHospitalNames: string[],
  branchName: string,
): boolean {
  const needle = branchName.trim().toLowerCase();
  if (!needle) return false;
  return networkHospitalNames.some((n) => n.trim().toLowerCase() === needle);
}
