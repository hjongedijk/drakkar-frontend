import "@/app/global.css";

import SearchDialog from "fumadocs-ui/components/dialog/search-default";
import { RootProvider } from "fumadocs-ui/provider/next";
import { Inter } from "next/font/google";

import type { ReactNode } from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: {
    default: "Drakkar Docs",
    template: "%s | Drakkar Docs"
  },
  description: "Drakkar documentation, setup guides, API usage, storage layout, and upgrade instructions."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider search={{ SearchDialog, options: { type: "static" } }}>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
