import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { BadRequestError } from "../errors/bad-request-error.js";
import { env } from "../../config/env.js";

const imageTypes = {
  "image/jpeg": { extension: "jpg", matches: (bytes: Buffer) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/png": { extension: "png", matches: (bytes: Buffer) => bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/webp": { extension: "webp", matches: (bytes: Buffer) => bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" },
} as const;

export interface StoredImage {
  url: string;
  mimeType: string;
}

export interface ImageStorage {
  storeAvatar(userId: number, bytes: Buffer, mimeType: string): Promise<StoredImage>;
  storeTicketAttachment(
    ticketId: number,
    bytes: Buffer,
    mimeType: string,
  ): Promise<StoredImage>;
  deleteByUrl(url: string): Promise<void>;
}

export interface ImageStorageOptions {
  directory: string;
  publicBaseUrl: string;
  maximumBytes: number;
}

export class ImageStorageService implements ImageStorage {
  public readonly rootDirectory: string;
  private readonly avatarDirectory: string;
  private readonly publicBaseUrl: string;
  private readonly maximumBytes: number;

  public constructor(options: ImageStorageOptions = {
    directory: env.UPLOAD_DIRECTORY,
    publicBaseUrl: env.PUBLIC_BASE_URL,
    maximumBytes: env.IMAGE_UPLOAD_MAX_BYTES,
  }) {
    this.rootDirectory = path.resolve(options.directory);
    this.avatarDirectory = path.join(this.rootDirectory, "avatars");
    this.publicBaseUrl = options.publicBaseUrl;
    this.maximumBytes = options.maximumBytes;
  }

  public async storeAvatar(
    userId: number,
    bytes: Buffer,
    mimeType: string,
  ): Promise<StoredImage> {
    const normalizedMimeType = mimeType.toLowerCase().split(";", 1)[0]?.trim() ?? "";
    const imageType = imageTypes[normalizedMimeType as keyof typeof imageTypes];

    if (!imageType) {
      throw new BadRequestError(
        "Avatar must be a JPEG, PNG, or WebP image",
        "UNSUPPORTED_IMAGE_TYPE",
      );
    }
    if (bytes.length === 0) {
      throw new BadRequestError("Avatar file is empty", "EMPTY_IMAGE_FILE");
    }
    if (bytes.length > this.maximumBytes) {
      throw new BadRequestError(
        `Avatar may not exceed ${this.maximumBytes} bytes`,
        "IMAGE_TOO_LARGE",
      );
    }
    if (!imageType.matches(bytes)) {
      throw new BadRequestError(
        "Avatar content does not match its image type",
        "IMAGE_CONTENT_MISMATCH",
      );
    }

    await mkdir(this.avatarDirectory, { recursive: true });
    const fileName = `user-${userId}-${randomUUID()}.${imageType.extension}`;
    await writeFile(path.join(this.avatarDirectory, fileName), bytes, { flag: "wx" });

    return {
      url: new URL(`/uploads/avatars/${fileName}`, this.publicBaseUrl).toString(),
      mimeType: normalizedMimeType,
    };
  }

  public async storeTicketAttachment(
    ticketId: number,
    bytes: Buffer,
    mimeType: string,
  ): Promise<StoredImage> {
    const normalizedMimeType = mimeType.toLowerCase().split(";", 1)[0]?.trim() ?? "";
    const imageType = imageTypes[normalizedMimeType as keyof typeof imageTypes];

    if (!imageType) {
      throw new BadRequestError(
        "Ticket attachment must be a JPEG, PNG, or WebP image",
        "UNSUPPORTED_IMAGE_TYPE",
      );
    }
    if (bytes.length === 0) {
      throw new BadRequestError("Ticket attachment file is empty", "EMPTY_IMAGE_FILE");
    }
    if (bytes.length > this.maximumBytes) {
      throw new BadRequestError(
        `Ticket attachment may not exceed ${this.maximumBytes} bytes`,
        "IMAGE_TOO_LARGE",
      );
    }
    if (!imageType.matches(bytes)) {
      throw new BadRequestError(
        "Ticket attachment content does not match its image type",
        "IMAGE_CONTENT_MISMATCH",
      );
    }

    const ticketDirectory = path.join(this.rootDirectory, "tickets", String(ticketId));
    await mkdir(ticketDirectory, { recursive: true });
    const fileName = `ticket-${ticketId}-${randomUUID()}.${imageType.extension}`;
    await writeFile(path.join(ticketDirectory, fileName), bytes, { flag: "wx" });

    return {
      url: new URL(
        `/uploads/tickets/${ticketId}/${fileName}`,
        this.publicBaseUrl,
      ).toString(),
      mimeType: normalizedMimeType,
    };
  }

  public async deleteByUrl(url: string): Promise<void> {
    const parsedUrl = new URL(url);
    const publicUrl = new URL(this.publicBaseUrl);
    if (parsedUrl.origin !== publicUrl.origin) {
      return;
    }

    const avatarMatch = parsedUrl.pathname.match(
      /^\/uploads\/avatars\/(user-\d+-[0-9a-f-]+\.(?:jpg|png|webp))$/i,
    );
    const ticketMatch = parsedUrl.pathname.match(
      /^\/uploads\/tickets\/(\d+)\/(ticket-\1-[0-9a-f-]+\.(?:jpg|png|webp))$/i,
    );
    const targetPath = avatarMatch
      ? path.join(this.avatarDirectory, avatarMatch[1]!)
      : ticketMatch
        ? path.join(this.rootDirectory, "tickets", ticketMatch[1]!, ticketMatch[2]!)
        : null;

    if (!targetPath) {
      return;
    }

    try {
      await unlink(targetPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}

export const imageStorageService = new ImageStorageService();
