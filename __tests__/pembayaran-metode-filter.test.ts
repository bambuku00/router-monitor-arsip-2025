import { describe, expect, it } from "vitest";

import { parseMetodeBayarFilter } from "@/lib/pembayaran-metode-filter";

describe("parseMetodeBayarFilter", () => {
  it("accepts cash and transfer only", () => {
    expect(parseMetodeBayarFilter("Cash")).toBe("Cash");
    expect(parseMetodeBayarFilter("Transfer")).toBe("Transfer");
    expect(parseMetodeBayarFilter("tunai")).toBeNull();
    expect(parseMetodeBayarFilter(null)).toBeNull();
  });
});
