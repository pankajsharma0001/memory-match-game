// lib/pusher-client.js
import Pusher from 'pusher-js';

let pusherClient = null;

export function getPusherClient() {
  if (typeof window === 'undefined') return null;
  
  if (!pusherClient) {
    // Enable pusher logging - don't include this in production
    Pusher.logToConsole = process.env.NODE_ENV === 'development';
    
    pusherClient = new Pusher(process.env.NEXT_PUBLIC_PUSHER_APP_KEY, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
      forceTLS: true,
      authEndpoint: '/api/pusher-auth', // If you need authentication
      enabledTransports: ['ws', 'wss'] // Force WebSocket first
    });
  }
  
  return pusherClient;
}