import "./globals.css";

export const metadata = {
  title: "Investor Agent",
  description: "Stock research grounded in live market data.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
