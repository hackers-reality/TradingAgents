import type { Metadata } from "next";
import Link from "next/link";
import Tape from "../components/Tape";
import GlobalActivity from "../components/GlobalActivity";
import "./globals.css";

export const metadata: Metadata = {
  title: "TradingAgents",
  description: "TradingAgents web console",
};

const links = [
  ["Dashboard", "/dashboard"],
  ["Live", "/live"],
  ["Reports", "/reports"],
  ["History", "/history"],
  ["Tables", "/tables"],
  ["Settings", "/settings"],
] as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="bar">
          <span className="brand">TradingAgents</span>
          <nav>
            {links.map(([label, href]) => (
              <Link key={href} href={href}>
                {label}
              </Link>
            ))}
          </nav>
        </header>
        <main style={{ paddingBottom: 56 }}>{children}</main>
        <GlobalActivity />
        <Tape />
      </body>
    </html>
  );
}
