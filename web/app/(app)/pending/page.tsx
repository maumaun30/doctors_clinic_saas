export default function PendingPage() {
  return (
    <>
      <div className="page-head">
        <div><h1>Account awaiting approval</h1></div>
      </div>
      <div className="card" style={{ padding: 24, maxWidth: 560 }}>
        <p style={{ margin: 0, color: "var(--fg-muted)" }}>
          Your sign-in was successful, but an administrator hasn&apos;t assigned
          you to a clinic yet. Please check back later.
        </p>
      </div>
    </>
  );
}
