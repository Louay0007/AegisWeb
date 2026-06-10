import { describe, expect, it, vi, beforeEach } from "vitest";

import * as apiClient from "@/lib/api/api-client";
import { downloadEndpoint } from "@/lib/data-layer/download";

describe("downloadEndpoint", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates an anchor element, clicks it, and revokes the URL", async () => {
    const apiSpy = vi.spyOn(apiClient, "apiDownload").mockResolvedValue({
      blob: new Blob(["hello"], { type: "application/json" }),
      filename: "receipt.json",
    });

    const click = vi.fn();
    const createObjectURL = vi.fn(() => "blob:abc");
    const revokeObjectURL = vi.fn();
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true });

    const anchor = {
      href: "",
      download: "",
      click,
      remove: vi.fn(),
    } as unknown as HTMLAnchorElement;
    const createElementSpy = vi.spyOn(document, "createElement").mockReturnValue(anchor as unknown as HTMLElement);
    const appendChildSpy = vi.spyOn(document.body, "appendChild").mockReturnValue(anchor as unknown as Node);

    await downloadEndpoint("/files/123/download", "fallback.bin");

    expect(apiSpy).toHaveBeenCalledWith("/files/123/download");
    expect(createObjectURL).toHaveBeenCalled();
    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(appendChildSpy).toHaveBeenCalledWith(anchor);
    expect(anchor.download).toBe("receipt.json");
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:abc");

    // Restore
    Object.defineProperty(URL, "createObjectURL", { value: originalCreate, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: originalRevoke, configurable: true });
  });

  it("uses the fallback name when the server omits a filename", async () => {
    vi.spyOn(apiClient, "apiDownload").mockResolvedValue({
      blob: new Blob(),
      filename: "",
    });

    const anchor = {
      href: "",
      download: "",
      click: vi.fn(),
      remove: vi.fn(),
    } as unknown as HTMLAnchorElement;
    vi.spyOn(document, "createElement").mockReturnValue(anchor as unknown as HTMLElement);
    vi.spyOn(document.body, "appendChild").mockReturnValue(anchor as unknown as Node);
    Object.defineProperty(URL, "createObjectURL", { value: () => "blob:abc", configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: () => undefined, configurable: true });

    await downloadEndpoint("/files/abc/download", "fallback.bin");
    expect(anchor.download).toBe("fallback.bin");
  });
});
