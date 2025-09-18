import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Auth0Provider } from "@auth0/nextjs-auth0";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Volta",
  description: "Parallel AI Coding Agents",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
	  {children}
        {/* <Auth0Provider></Auth0Provider> */}
      </body>
    </html>
  );
}
