import type { MetadataRoute } from "next";

// Installable app ("Add to Home Screen"). Opens on Today, full screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Doctors Clinic",
    short_name: "Clinic",
    description: "Appointments, patients and records for your clinic.",
    id: "/",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#3b82f6",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
