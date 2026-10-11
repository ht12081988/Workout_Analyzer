// IMPORTANT: Replace this IP address with your computer's local Wi-Fi IP address!
// 'localhost' will NOT work on a physical device, because 'localhost' points to the phone itself.
// Example: If your PC is 192.168.1.68, use 'http://192.168.1.68:5002'

const rawUrl = (process.env.EXPO_PUBLIC_API_URL || 'https://workout-analyzer-eight.vercel.app/api').trim();

// Normalize URL: ensure protocol is present so Android native networking doesn't throw MalformedURLException
export const API_BASE_URL = (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))
  ? rawUrl.replace(/\/+$/, '')
  : `http://${rawUrl}`.replace(/\/+$/, '');
