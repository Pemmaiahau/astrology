import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;

/**
 * Makes Cloudflare bindings (the chart-log D1 database) reachable from
 * `next dev` as well as from a deployed Worker, so a route that reads a
 * binding behaves the same in development as in production instead of only
 * working once deployed.
 */
import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
