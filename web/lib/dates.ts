// Calendar dates in clinic time (Asia/Manila) as YYYY-MM-DD.
//
// Don't build these with `new Date(y, m, d).toISOString()`: that is local
// midnight converted to UTC, which lands on the previous day anywhere
// east of UTC — i.e. for every user in the Philippines.
const PH = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" });

/** Manila calendar date of `at` (default: now), e.g. "2026-10-12". */
export const phYmd = (at: Date | number = Date.now()) => PH.format(at);

/** Manila calendar date `days` from now (negative for the past). */
export const phYmdOffset = (days: number) => phYmd(Date.now() + days * 86_400_000);
