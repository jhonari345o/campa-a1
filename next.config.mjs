/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: process.cwd(),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // PayPhone valida que el enlace se abra desde el dominio registrado.
          { key: "Referrer-Policy", value: "origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
