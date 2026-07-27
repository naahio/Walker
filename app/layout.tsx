import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("host") || "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const description =
    "A playable hand-painted side-scrolling metroidvania prototype starring the Silent Warrior.";
  return {
    metadataBase: new URL(`${protocol}://${host}`),
    title: "Abyss Walker — The Whispering Grove",
    description,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "Abyss Walker",
      description,
      images: [{ url: "/og.png", width: 1536, height: 896, alt: "Abyss Walker playable prototype" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Abyss Walker",
      description,
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
