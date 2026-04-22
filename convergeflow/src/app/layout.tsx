import type { Metadata } from "next";
import { Archivo, Chivo, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["700", "900"],
  variable: "--font-archivo",
  display: "swap",
});

const chivo = Chivo({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-chivo",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ConvergeFlow",
  description: "5 clicks to a booked call - cold email made simple",
  icons: {
    icon: "/icon",
    apple: "/apple-icon",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${archivo.variable} ${chivo.variable} ${jetbrainsMono.variable} font-body antialiased`}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
