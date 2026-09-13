import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { WorkspaceShell } from '@/components/workspace-shell';
import "./globals.css";
export const metadata: Metadata = {
  icons: { icon: '/product.svg' },
  title: "Haggleface — A better find.",
  description:
    "Your AI shopping agent. Search secondhand marketplaces, compare real deals, and negotiate with confidence.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers><WorkspaceShell>{children}</WorkspaceShell></Providers>
      </body>
    </html>
  );
}
