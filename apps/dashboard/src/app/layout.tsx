import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SolAgent Dashboard",
  description: "Operator dashboard for Solana AI agent wallets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
