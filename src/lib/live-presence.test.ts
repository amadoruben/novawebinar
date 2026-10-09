import { describe, expect, it } from "vitest";
import { deviceOf } from "./live-presence";

const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  ipadOld: "Mozilla/5.0 (iPad; CPU OS 12_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1",
  // O iPadOS 13+ diz-se Mac; só o toque o distingue.
  ipadOs: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  androidPhone: "Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36",
  androidTablet: "Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  firefoxTablet: "Mozilla/5.0 (Android 13; Tablet; rv:127.0) Gecko/127.0 Firefox/127.0",
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
};

describe("deviceOf", () => {
  it("separa telemóvel, tablet e computador", () => {
    expect(deviceOf(UA.iphone, 5)).toBe("mobile");
    expect(deviceOf(UA.androidPhone, 5)).toBe("mobile");
    expect(deviceOf(UA.ipadOld, 5)).toBe("tablet");
    expect(deviceOf(UA.ipadOs, 5)).toBe("tablet");
    expect(deviceOf(UA.androidTablet, 10)).toBe("tablet");
    expect(deviceOf(UA.firefoxTablet, 10)).toBe("tablet");
    expect(deviceOf(UA.windows, 0)).toBe("desktop");
  });

  it("um Mac sem toque é computador; um ecrã de toque pequeno sem pistas é telemóvel", () => {
    expect(deviceOf(UA.ipadOs, 0)).toBe("desktop");
    expect(deviceOf(UA.windows, 10, true)).toBe("mobile");
  });
});
