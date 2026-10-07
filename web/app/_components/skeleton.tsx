// Skeleton placeholders shown via Next App Router loading.tsx files.
// Each page-level skeleton mirrors its page's layout so content swaps in
// without the layout jumping. Wrapped in role="status" for screen readers.

export function Skeleton({
  w = "100%",
  h = 14,
  r,
  style,
}: {
  w?: number | string;
  h?: number | string;
  r?: number;
  style?: React.CSSProperties;
}) {
  return <span className="skeleton" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

/** Announces loading to assistive tech; the shimmer itself is decorative. */
function Busy({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-label="Loading" className="skeleton-page">
      {children}
    </div>
  );
}

function HeadSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="page-head">
      <div>
        <Skeleton w={170} h={24} />
        <Skeleton w={240} h={14} style={{ marginTop: 9 }} />
      </div>
      {action && <Skeleton w={120} h={34} r={8} />}
    </div>
  );
}

function FiltersSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <div className="filters">
      {Array.from({ length: fields }).map((_, i) => (
        <Skeleton key={i} w={i === 0 ? 220 : 150} h={34} r={8} />
      ))}
      <Skeleton w={84} h={34} r={8} />
    </div>
  );
}

function FieldsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="field">
          <Skeleton w={90} h={12} />
          <Skeleton w="100%" h={36} r={8} style={{ marginTop: 8 }} />
        </div>
      ))}
    </>
  );
}

function KvSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "12px 16px" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <span key={i} style={{ display: "contents" }}>
          <Skeleton w={80} h={13} />
          <Skeleton w={`${55 - i * 8}%`} h={13} />
        </span>
      ))}
    </div>
  );
}

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="stats">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card stat">
          <Skeleton w={80} h={12} />
          <Skeleton w={56} h={26} style={{ marginTop: 12 }} />
        </div>
      ))}
    </div>
  );
}

function Rows({ count = 6, avatar = false }: { count?: number; avatar?: boolean }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "14px 18px",
            borderBottom: i === count - 1 ? "none" : "1px solid var(--border)",
          }}
        >
          {avatar && <Skeleton w={36} h={36} r={999} />}
          <div style={{ flex: 1 }}>
            <Skeleton w="38%" h={14} />
            <Skeleton w="22%" h={11} style={{ marginTop: 8 }} />
          </div>
          <Skeleton w={84} h={28} r={6} />
        </div>
      ))}
    </>
  );
}

export function ListSkeleton({ rows = 6, avatar = true }: { rows?: number; avatar?: boolean }) {
  return (
    <Busy>
      <HeadSkeleton action />
      <div className="card">
        <Rows count={rows} avatar={avatar} />
      </div>
    </Busy>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <Busy>
      <HeadSkeleton action />
      <FiltersSkeleton />
      <div className="card">
        <div className="section-bar"><Skeleton w={120} h={12} /></div>
        <Rows count={rows} />
      </div>
    </Busy>
  );
}

export function StatsListSkeleton() {
  return (
    <Busy>
      <HeadSkeleton />
      <StatsSkeleton count={4} />
      <div className="card">
        <div className="section-bar"><Skeleton w={120} h={12} /></div>
        <Rows count={5} avatar />
      </div>
    </Busy>
  );
}

export function DetailSkeleton() {
  return (
    <Busy>
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Skeleton w={36} h={36} r={6} />
          <Skeleton w={44} h={44} r={999} />
          <div>
            <Skeleton w={180} h={22} />
            <Skeleton w={150} h={13} style={{ marginTop: 8 }} />
          </div>
        </div>
      </div>
      <div className="stack">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card" style={{ padding: 20 }}>
            <Skeleton w={120} h={12} />
            <Skeleton w="100%" h={14} style={{ marginTop: 14 }} />
            <Skeleton w="80%" h={14} style={{ marginTop: 10 }} />
          </div>
        ))}
      </div>
    </Busy>
  );
}

/** Head + filter bar + rows: audit log, pending users. */
export function FilteredListSkeleton({ rows = 8, filters = 3 }: { rows?: number; filters?: number }) {
  return (
    <Busy>
      <HeadSkeleton />
      <FiltersSkeleton fields={filters} />
      <div className="card">
        <Rows count={rows} />
      </div>
    </Busy>
  );
}

/** Several titled cards of rows: library, assignments, clinics. */
export function SectionsSkeleton({ sections = 3, rows = 3 }: { sections?: number; rows?: number }) {
  return (
    <Busy>
      <HeadSkeleton />
      <div className="stack">
        {Array.from({ length: sections }).map((_, i) => (
          <div key={i} className="card">
            <div className="section-bar"><Skeleton w={140} h={12} /></div>
            <Rows count={rows} />
          </div>
        ))}
      </div>
    </Busy>
  );
}

/** Table card plus an "add" form card: availability. */
export function TableFormSkeleton({ rows = 5, fields = 4 }: { rows?: number; fields?: number }) {
  return (
    <Busy>
      <HeadSkeleton />
      <div className="card">
        <Rows count={rows} />
      </div>
      <div className="card" style={{ maxWidth: 560, padding: 24, marginTop: 24 }}>
        <FieldsSkeleton count={fields} />
      </div>
    </Busy>
  );
}

/** Stack of key/value cards: doctors, billing. */
export function CardsSkeleton({ cards = 3, rows = 4, maxWidth }: { cards?: number; rows?: number; maxWidth?: number }) {
  return (
    <Busy>
      <HeadSkeleton />
      <div className="stack">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="card" style={{ padding: 24, maxWidth }}>
            <KvSkeleton rows={rows} />
          </div>
        ))}
      </div>
    </Busy>
  );
}

/** Centered card used by the public booking page (/book/<slug>). */
export function BookingCardSkeleton() {
  return (
    <div className="auth-screen">
      <div className="card auth-card book-card">
        <Busy>
          <div className="auth-brand">
            <Skeleton w={34} h={34} r={7} />
            <Skeleton w={150} h={16} />
          </div>
          <Skeleton w={200} h={20} style={{ margin: "0 auto" }} />
          <Skeleton w={160} h={13} style={{ margin: "10px auto 24px" }} />
          <FieldsSkeleton count={2} />
          <div className="slot-grid" style={{ marginBottom: 18 }}>
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={30} r={6} />)}
          </div>
          <FieldsSkeleton count={2} />
          <Skeleton w="100%" h={38} r={8} style={{ marginTop: 8 }} />
        </Busy>
      </div>
    </div>
  );
}
