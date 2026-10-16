import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { PwaRegister } from "./_components/pwa";

export const metadata: Metadata = {
  title: "Doctors Clinic",
  applicationName: "Doctors Clinic",
  appleWebApp: { capable: true, title: "Clinic", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#3b82f6" };

// Light is the default. Only an explicit stored "dark" opts into dark mode.
const themeInit = `(function(){try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        {children}
        <Toaster position="bottom-right" />
        <PwaRegister />
      </body>
    </html>
  );
}
