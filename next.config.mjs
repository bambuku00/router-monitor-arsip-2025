/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  /** Hindari bundle native/heavy deps di API route (bwip-js, dll). */
  serverExternalPackages: ["bwip-js"],
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    // Catatan: Content-Security-Policy di-set di middleware.ts (berbasis nonce per-request).
    // Header statis lain tetap di sini.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-site" },
          ...(isProd
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains",
                },
              ]
            : []),
        ],
      },
    ];
  },
  webpack: (config) => {
    config.ignoreWarnings = [
      { module: /node_modules\/web-worker/ },
      { message: /Critical dependency: the request of a dependency is an expression/ },
    ];
    return config;
  },
};

export default nextConfig;
