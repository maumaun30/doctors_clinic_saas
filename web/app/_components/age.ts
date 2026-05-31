// Compute age from a date-of-birth string (YYYY-MM-DD or ISO).

function ageParts(dob: string | null | undefined): { y: number; m: number } | null {
  if (!dob) return null;
  const b = new Date(dob);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let months =
    (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months--;
  if (months < 0) months = 0;
  return { y: Math.floor(months / 12), m: months % 12 };
}

// Compact form for list/sub lines, e.g. "34y 5mo" or "8mo".
export function ageYearsMonths(dob: string | null | undefined): string | null {
  const p = ageParts(dob);
  if (!p) return null;
  return p.y <= 0 ? `${p.m}mo` : `${p.y}y ${p.m}mo`;
}

// Verbose form for detail views, e.g. "34 years, 5 months" or "8 months".
export function ageVerbose(dob: string | null | undefined): string | null {
  const p = ageParts(dob);
  if (!p) return null;
  const parts: string[] = [];
  if (p.y > 0) parts.push(`${p.y} year${p.y !== 1 ? "s" : ""}`);
  parts.push(`${p.m} month${p.m !== 1 ? "s" : ""}`);
  return parts.join(", ");
}
