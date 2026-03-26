import "./globals.css"
import { AppShell } from "@/components/app-shell"

export const metadata = {
  title: "Auction Buy Assistant",
  description: "Auction decision support dashboard",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased overflow-x-hidden">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
