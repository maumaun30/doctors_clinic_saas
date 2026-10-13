// Details that appear in the Terms of Service, Privacy Policy and the
// Help page. Fill in the [BRACKETED] values, have the documents reviewed
// by a lawyer, then set `draft` to false to remove the draft notice.
export const LEGAL = {
  draft: true,
  /** The business that operates this service (the "Provider"). */
  company: "[COMPANY NAME]",
  /** Product name as shown to clinics and patients. */
  product: "Clinic",
  address: "[REGISTERED BUSINESS ADDRESS], Philippines",
  supportEmail: "[SUPPORT EMAIL]",
  /** Data Protection Officer (required under the Data Privacy Act of 2012). */
  dpoName: "[DATA PROTECTION OFFICER NAME]",
  dpoEmail: "[DPO EMAIL]",
  effectiveDate: "[EFFECTIVE DATE]",
} as const;

/**
 * Support contact on Viber. Set NEXT_PUBLIC_SUPPORT_VIBER to a mobile
 * number in international format (e.g. +639171234567). Unset hides the
 * Viber button.
 */
export function viberSupport(): { number: string; href: string } | null {
  const raw = process.env.NEXT_PUBLIC_SUPPORT_VIBER?.replace(/[^\d+]/g, "");
  if (!raw) return null;
  const number = raw.startsWith("+") ? raw : `+${raw}`;
  return { number, href: `viber://chat?number=${encodeURIComponent(number)}` };
}
