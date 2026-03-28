import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin", "@distube/ytdl-core"],
};

export default nextConfig;
