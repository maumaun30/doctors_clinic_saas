// Nested route transition: the (app) template only remounts when the
// top-level segment changes, so moving between pages inside this section
// (e.g. /admin/clinics → /admin/doctors) needs its own template to replay
// the .route enter animation. See globals.css.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="route">{children}</div>;
}
