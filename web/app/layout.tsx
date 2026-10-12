import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata = { title: "Doctors Clinic" };

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
      </body>
    </html>
  );
}
