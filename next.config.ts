import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Per provare dal telefono sulla stessa rete Wi-Fi con "npm run dev" (http://IP-DEL-PC:3000):
  // in sviluppo Next.js accetta solo "localhost", qui aggiungiamo gli indirizzi delle reti di casa/negozio.
  allowedDevOrigins: [
    "192.168.*.*",
    "10.*.*.*",
    ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}.*.*`), // 172.16.x.x - 172.31.x.x
  ],
};

export default nextConfig;
