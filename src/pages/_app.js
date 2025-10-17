import "@/styles/globals.css";
import { Analytics } from "@vercel/analytics/next"

export default function App({ Component, pageProps }) {
  <Analytics/>
  return <Component {...pageProps} />;
}
