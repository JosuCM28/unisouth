import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Las fotos de rollo y los PDF de remisión se suben desde el celular.
      bodySizeLimit: "4mb",
    },
  },
  // Prisma usa binarios nativos: no debe pasar por el bundler del servidor.
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
