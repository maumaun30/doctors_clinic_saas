// Remounts on every navigation (unlike layout.tsx), so its children replay
// the enter animation in globals.css (.route). Also replays when a
// loading.tsx skeleton is swapped for the real page, since the new
// elements are freshly inserted.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="route">{children}</div>;
}
