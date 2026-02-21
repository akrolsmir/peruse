import type { Metadata } from "next";
import { Geist, Geist_Mono, STIX_Two_Text } from "next/font/google";
import { ConvexClientProvider } from "@/components/convex-provider";
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

export const metadata: Metadata = {
  title: "PTT - Podcast to Text",
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
        className={`${geistSans.variable} ${geistMono.variable} ${stixTwo.variable} antialiased`}
      >
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
