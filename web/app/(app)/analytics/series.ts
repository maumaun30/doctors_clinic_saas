// Status series for appointment charts — shared by the server page and
// the client charts (a "use client" module can't export plain data to a
// server component). Stack order (bottom→top) keeps green and red apart;
// colors come from the --chart-* tokens in globals.css.
export const SERIES = [
  { key: "done", label: "Completed", color: "var(--chart-done)" },
  { key: "upcoming", label: "Upcoming", color: "var(--chart-upcoming)" },
  { key: "missed", label: "Missed", color: "var(--chart-missed)" },
] as const;
export type SeriesKey = (typeof SERIES)[number]["key"];
export type DayRow = { date: string; label: string; done: number; upcoming: number; missed: number };
