// Skeleton placeholders shown via Next App Router loading.tsx files.

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

function HeadSkeleton() {
  return (
    <div className="page-head">
      <div>
        <Skeleton w={170} h={24} />
        <Skeleton w={240} h={14} style={{ marginTop: 9 }} />
      </div>
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
    <>
      <HeadSkeleton />
      <div className="card">
        <Rows count={rows} avatar={avatar} />
      </div>
    </>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <>
      <HeadSkeleton />
      <div className="card">
        <div className="section-bar"><Skeleton w={120} h={12} /></div>
        <Rows count={rows} />
      </div>
    </>
  );
}

export function StatsListSkeleton() {
  return (
    <>
      <HeadSkeleton />
      <StatsSkeleton count={4} />
      <div className="card">
        <div className="section-bar"><Skeleton w={120} h={12} /></div>
        <Rows count={5} avatar />
      </div>
    </>
  );
}

export function DetailSkeleton() {
  return (
    <>
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
    </>
  );
}
