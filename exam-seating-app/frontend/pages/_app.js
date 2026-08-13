import { Outfit, Inter } from "next/font/google";
import "../styles/globals.css";
import "../styles/templates.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export default function App({ Component, pageProps }) {
  return (
    <div className={`${outfit.variable} ${inter.variable}`}>
      <Component {...pageProps} />
    </div>
  );
}
