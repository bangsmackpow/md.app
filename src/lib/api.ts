import { Capacitor } from '@capacitor/core';

export async function apiFetch(path: string, options: any = {}) {
  let apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://markdownapp.pages.dev';
  
  if (!Capacitor.isNativePlatform() && 
      typeof window !== 'undefined' &&
      window.location.hostname !== 'localhost' && 
      !window.location.hostname.includes('127.0.0.1')) {
    apiBase = ''; 
  }
  
  const url = path.startsWith('http') ? path : `${apiBase}${path}`;
  return fetch(url, options);
}
