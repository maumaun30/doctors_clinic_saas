import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Dashboard number tile: small muted label over a large value.
// The size variant is repeated because CardTitle's own
// group-data-[size=sm] text-sm would otherwise win over text-2xl.
export function StatCard({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums group-data-[size=sm]/card:text-2xl">
          {children}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}
