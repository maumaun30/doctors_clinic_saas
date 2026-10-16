import { notFound } from "next/navigation";
import { getPublicClinic } from "@/lib/actions/public-booking";
import BookingWidget from "./booking-widget";
import { PoweredBy } from "@/app/_components/logo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clinic = await getPublicClinic(slug);
  return { title: clinic ? `Book an appointment — ${clinic.name}` : "Online booking" };
}

export default async function PublicBookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clinic = await getPublicClinic(slug);
  if (!clinic) notFound();

  return (
    <div className="auth-screen">
      <div className="card auth-card book-card">
        <div className="auth-brand">
          <span className="mark">{clinic.name.trim()[0]?.toUpperCase() ?? "C"}</span>
          <span className="wordmark">{clinic.name}</span>
        </div>
        <h2>Book an appointment</h2>
        <p className="sub">{clinic.address ?? "Choose a doctor and a time that works for you."}</p>
        {clinic.doctors.length === 0
          ? <div className="empty">Online booking isn’t available right now. Please call the clinic.</div>
          : <BookingWidget slug={slug} clinicName={clinic.name} doctors={clinic.doctors} />}
      </div>
      <PoweredBy />
    </div>
  );
}
