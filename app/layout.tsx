import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | KPM - Kapuletu Project Management",
    default: "KPM - Enterprise Project Management System",
  },
  description: "Enterprise Project Management System for modern software teams. Manage projects, sprints, and engineering standards with seamless RBAC and beautiful UI.",
  keywords: ["project management", "kapuletu", "enterprise", "sprints", "software development", "collaboration"],
  authors: [{ name: "Kapuletu" }],
  creator: "Kapuletu",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://kpm.kapuletu.com",
    title: "KPM - Enterprise Project Management System",
    description: "Enterprise Project Management System for modern software teams.",
    siteName: "KPM",
    images: [
      {
        url: "/logos/kpm/kpm-primary-black.svg",
        width: 1200,
        height: 630,
        alt: "KPM Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KPM - Enterprise Project Management System",
    description: "Enterprise Project Management System for modern software teams.",
    images: ["/logos/kpm/kpm-primary-black.svg"],
    creator: "@kapuletu",
  },
  icons: {
    icon: "/logos/kpm/kpm-icon.svg",
    shortcut: "/logos/kpm/kpm-icon.svg",
    apple: "/logos/kpm/kpm-icon.svg",
  },
};

import QueryProvider from "@/lib/react-query/QueryProvider";
import { AuthProvider } from "@/store/AuthContext";
import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
        <Toaster />
      </body>
    </html>
  );
}
