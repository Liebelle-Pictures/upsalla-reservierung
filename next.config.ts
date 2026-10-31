import type { NextConfig } from "next";

// Online-Buchung: darf nur auf upsalla-kinderpark.de (und von uns selbst) per iframe
// eingebettet werden. frame-ancestors ersetzt X-Frame-Options.
const BUCHEN_FRAME_ANCESTORS = "frame-ancestors 'self' https://upsalla-kinderpark.de https://www.upsalla-kinderpark.de";

const nextConfig: NextConfig = {
  serverExternalPackages: ['googleapis'],
  async headers() {
    return [
      {
        // :path* deckt /buchen/upsalla, /buchen/upsalla/erfolg und /abgebrochen ab
        source: '/buchen/:path*',
        headers: [{ key: 'Content-Security-Policy', value: BUCHEN_FRAME_ANCESTORS }],
      },
    ]
  },
};

export default nextConfig;
