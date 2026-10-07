// Settings-style section: short title + description on the left, content
// card on the right (stacks on narrow screens). `flush` drops the card
// padding for edge-to-edge rows; `bare` renders children without a card.
export function Section({
  title, description, children, flush = false, bare = false, id,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  flush?: boolean;
  bare?: boolean;
  id?: string;
}) {
  return (
    <section className="settings-section" id={id}>
      <div className="settings-intro">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {bare
        ? <div className="settings-bare">{children}</div>
        : <div className={`card settings-card${flush ? " flush" : ""}`}>{children}</div>}
    </section>
  );
}
