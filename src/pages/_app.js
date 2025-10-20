// pages/_app.js
import "@/styles/globals.css";
import { Analytics } from "@vercel/analytics/next";
import SocketErrorBoundary from '../components/SocketErrorBoundary';
import { useEffect } from 'react';

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    // Suppress React error overlay for socket timeout errors
    if (process.env.NODE_ENV === 'development') {
      const originalConsoleError = console.error;
      console.error = (...args) => {
        if (args[0] && typeof args[0] === 'string' && args[0].includes('timeout')) {
          return; // Suppress timeout errors
        }
        originalConsoleError.apply(console, args);
      };

      return () => {
        console.error = originalConsoleError;
      };
    }
  }, []);

  return (
    <SocketErrorBoundary>
      <Analytics />
      <Component {...pageProps} />
    </SocketErrorBoundary>
  );
}

export default MyApp;