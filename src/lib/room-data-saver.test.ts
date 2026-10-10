import { describe, expect, it } from "vitest";
import { levelCap, slowConnection } from "./room-data-saver";

describe("poupar dados", () => {
  it("liga-se com a poupança do telemóvel ou numa rede 2G/3G", () => {
    expect(slowConnection({ saveData: true, effectiveType: "4g" })).toBe(true);
    expect(slowConnection({ effectiveType: "3g" })).toBe(true);
    expect(slowConnection({ effectiveType: "slow-2g" })).toBe(true);
    expect(slowConnection({ effectiveType: "4g" })).toBe(false);
    expect(slowConnection(undefined)).toBe(false);
  });

  it("no HLS fica a qualidade mais alta até 360p", () => {
    const levels = [{ height: 240 }, { height: 360 }, { height: 720 }, { height: 1080 }];
    expect(levelCap(levels)).toBe(1);
    expect(levelCap([{ height: 480 }, { height: 720 }])).toBe(0);
    expect(levelCap([])).toBe(-1);
  });
});
