import type { Metadata } from "next";
import { Geist, Geist_Mono, STIX_Two_Text, Quicksand, Exo, Outfit } from "next/font/google";
import { ConvexClientProvider } from "@/components/convex-provider";
import { FontProvider } from "@/components/font-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const stixTwo = STIX_Two_Text({
  variable: "--font-stix-two",
  subsets: ["latin"],
});

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
});

const exo = Exo({
  variable: "--font-exo",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "peruse — podcast transcripts worth reading",
  description: "Convert podcast episodes into high-quality transcripts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${stixTwo.variable} ${quicksand.variable} ${exo.variable} ${outfit.variable} antialiased`}
      >
        <FontProvider>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </FontProvider>
      </body>
    </html>
  );
}
