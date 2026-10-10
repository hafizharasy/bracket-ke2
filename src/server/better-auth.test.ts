import { describe, expect, it } from "vitest";

import { publicBaseUrl } from "@/server/better-auth";

describe("publicBaseUrl", () => {
  it("menormalkan BETTER_AUTH_URL tanpa https, dengan path, atau spasi", () => {
    expect(publicBaseUrl({ BETTER_AUTH_URL: "bracket-ke2-production.up.railway.app" })).toBe("https://bracket-ke2-production.up.railway.app");
    expect(publicBaseUrl({ BETTER_AUTH_URL: " https://bracket.lrp.id/masuk/admin " })).toBe("https://bracket.lrp.id");
    expect(publicBaseUrl({ BETTER_AUTH_URL: "http://localhost:3000" })).toBe("http://localhost:3000");
  });

  it("memakai domain Railway bila BETTER_AUTH_URL kosong, dan undefined bila tidak ada/tidak valid", () => {
    expect(publicBaseUrl({ BETTER_AUTH_URL: "", RAILWAY_PUBLIC_DOMAIN: "x.up.railway.app" })).toBe("https://x.up.railway.app");
    expect(publicBaseUrl({})).toBeUndefined();
    expect(publicBaseUrl({ BETTER_AUTH_URL: "https://" })).toBeUndefined();
  });
});
