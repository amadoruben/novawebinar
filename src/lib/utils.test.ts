import { describe, expect, it } from "vitest";

import { isHttpUrl, offerUrl } from "./utils";

describe("link da oferta", () => {
  it("aceita só http(s)", () => {
    expect(isHttpUrl("https://pay.hotmart.com/x")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("data:text/html,<script>")).toBe(false);
    expect(isHttpUrl(null)).toBe(false);
  });

  it("normaliza o que o editor recebe", () => {
    expect(offerUrl("  ")).toBeNull();
    expect(offerUrl(" https://pay.kiwify.com.br/abc ")).toBe("https://pay.kiwify.com.br/abc");
    expect(offerUrl("pay.hotmart.com/x?off=1")).toBe("https://pay.hotmart.com/x?off=1");
    expect(offerUrl("javascript:alert(document.cookie)")).toBeNull();
    expect(offerUrl("JavaScript:alert(1)")).toBeNull();
    expect(offerUrl("ftp://site.com")).toBeNull();
  });
});
