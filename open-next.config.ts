import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext adapter configuration.
 *
 * Left at defaults deliberately. The incremental cache overrides OpenNext
 * offers (R2, KV) exist to serve ISR and cached fetches; this app prerenders
 * a single static shell and computes every chart in the browser, so there is
 * nothing for an incremental cache to hold. Adding R2 here would buy a
 * dependency and a bucket for a cache that would never be read.
 */
export default defineCloudflareConfig({});
