import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Search from "@/components/search";

vi.mock("next/navigation", () => ({
  usePathname: () => "/pembayaran/17",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function Harness() {
  const [query, setQuery] = useState("");
  return (
    <Search
      isSearchParams={false}
      queryState={query}
      handleSearch={(val) => {
        window.setTimeout(() => setQuery(val), 40);
      }}
    />
  );
}

describe("search input", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps every character when the parent search state arrives late", async () => {
    vi.useFakeTimers();
    render(<Harness />);
    const input = screen.getByRole("textbox", { name: "Cari" }) as HTMLInputElement;

    for (const char of "123456") {
      await act(async () => {
        fireEvent.change(input, { target: { value: `${input.value}${char}` } });
      });
    }

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(input.value).toBe("123456");
  });
});
