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
  title: "LivingBrush WebAR Viewer",
  description: "Experience 3D art in AR - Scan QR codes to view immersive artworks",
  keywords: "WebAR, 3D art, augmented reality, QR code, livingbrush",
  viewport: "width=device-width, initial-scale=1.0, user-scalable=no",
  openGraph: {
    title: "LivingBrush WebAR Viewer",
    description: "Experience 3D art in AR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
