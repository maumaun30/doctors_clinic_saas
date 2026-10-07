import { PageHeader } from "@/app/_components/page-header";
import { Section } from "@/app/_components/section";

export default function PendingPage() {
  return (
    <>
      <PageHeader icon="clock" title="Account awaiting approval" sub="You’re signed in — almost there." />
      <Section title="What happens next" description="An admin at your clinic gives you a role (doctor, secretary or admin).">
        <p style={{ margin: 0, color: "var(--fg-muted)" }}>
          Your sign-in was successful, but an administrator hasn&apos;t assigned
          you to a clinic yet. Ask them to approve you under <strong>Pending users</strong>,
          then refresh this page.
        </p>
      </Section>
    </>
  );
}
