import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ImageStorageService } from "../src/common/services/image-storage.service.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })));
});

async function storage() {
  const directory = await mkdtemp(path.join(tmpdir(), "electronic-fixer-images-"));
  directories.push(directory);
  return {
    directory,
    service: new ImageStorageService({
      directory,
      publicBaseUrl: "http://localhost:3000",
      maximumBytes: 1_024,
    }),
  };
}

describe("ImageStorageService", () => {
  it("stores a signature-validated image under a random avatar name and removes it", async () => {
    const { directory, service } = await storage();
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const stored = await service.storeAvatar(7, png, "image/png");
    const files = await readdir(path.join(directory, "avatars"));

    expect(stored.url).toMatch(/^http:\/\/localhost:3000\/uploads\/avatars\/user-7-.+\.png$/);
    expect(stored.mimeType).toBe("image/png");
    expect(files).toHaveLength(1);

    await service.deleteByUrl(stored.url);
    await expect(readdir(path.join(directory, "avatars"))).resolves.toEqual([]);
  });

  it("rejects a file whose bytes do not match the declared image type", async () => {
    const { service } = await storage();

    await expect(
      service.storeAvatar(7, Buffer.from("not-an-image"), "image/png"),
    ).rejects.toMatchObject({ code: "IMAGE_CONTENT_MISMATCH" });
  });

  it("stores and removes a ticket image in its ticket-owned directory", async () => {
    const { directory, service } = await storage();
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const stored = await service.storeTicketAttachment(12, png, "image/png");
    const ticketDirectory = path.join(directory, "tickets", "12");
    const files = await readdir(ticketDirectory);

    expect(stored).toMatchObject({
      url: expect.stringMatching(
        /^http:\/\/localhost:3000\/uploads\/tickets\/12\/ticket-12-.+\.png$/,
      ),
      mimeType: "image/png",
    });
    expect(files).toHaveLength(1);

    await service.deleteByUrl(stored.url);
    await expect(readdir(ticketDirectory)).resolves.toEqual([]);
  });
});
