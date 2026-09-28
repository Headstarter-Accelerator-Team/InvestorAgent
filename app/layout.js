import "./globals.css";

export const metadata = {
  title: "Investor Agent",
  description: "Stock research grounded in live market data.",
};

// Dark by default; applies a saved "light" choice before first paint so the
// page doesn't flash.
const themeScript = `try{if(localStorage.getItem("investor-agent-theme")==="light")document.documentElement.classList.remove("dark")}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-background text-foreground">{children}</body>
    </html>
  );
}
