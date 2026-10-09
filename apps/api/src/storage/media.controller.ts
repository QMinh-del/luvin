import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Put,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { FilesystemObjectStorage } from "./filesystem-object-storage";
import { assertSafeObjectKey } from "./object-key";
import { OBJECT_STORAGE, type ObjectStoragePort } from "./object-storage.port";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const MAX_EXPORT_BYTES = 50 * 1024 * 1024;

@Controller("media")
export class MediaController {
  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
  ) {}

  @Get(":prefix/:id")
  async read(
    @Param("prefix") prefix: string,
    @Param("id") id: string,
    @Query("exp") exp: string,
    @Query("sig") sig: string,
    @Res() response: Response,
  ): Promise<void> {
    const opened = await this.authorize("GET", prefix, id, exp, sig);
    if (!opened) {
      response.status(HttpStatus.NOT_FOUND).end();
      return;
    }
    response.setHeader("Content-Type", opened.contentType);
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Length", String(opened.body.byteLength));
    response.status(HttpStatus.OK).end(opened.body);
  }

  @Put(":prefix/:id")
  async write(
    @Param("prefix") prefix: string,
    @Param("id") id: string,
    @Query("exp") exp: string,
    @Query("sig") sig: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const storage = this.filesystem();
    const objectKey = objectKeyFrom(prefix, id);
    if (
      !storage ||
      !objectKey ||
      !storage.verify("PUT", objectKey, expiresAt(exp), first(sig))
    ) {
      response.status(HttpStatus.NOT_FOUND).end();
      return;
    }
    const purpose = prefix === "a" ? "avatar" : "export";
    const max = purpose === "avatar" ? MAX_AVATAR_BYTES : MAX_EXPORT_BYTES;
    let body: Buffer;
    try {
      body = await readLimited(request, max);
    } catch (error) {
      if (error instanceof HttpException) {
        response.status(error.getStatus()).json(error.getResponse());
        return;
      }
      throw error;
    }
    const contentType = request.header("content-type");
    try {
      await storage.replaceBody(purpose, objectKey, body, contentType);
    } catch {
      response.status(HttpStatus.NOT_FOUND).end();
      return;
    }
    response.status(HttpStatus.NO_CONTENT).end();
  }

  private filesystem(): FilesystemObjectStorage | undefined {
    return this.storage instanceof FilesystemObjectStorage
      ? this.storage
      : undefined;
  }

  private async authorize(
    action: "GET",
    prefix: string,
    id: string,
    exp: string,
    sig: string,
  ) {
    const storage = this.filesystem();
    const objectKey = objectKeyFrom(prefix, id);
    if (
      !storage ||
      !objectKey ||
      !storage.verify(action, objectKey, expiresAt(exp), first(sig))
    ) {
      return undefined;
    }
    const purpose = prefix === "a" ? "avatar" : "export";
    const opened = await storage.open(purpose, objectKey);
    if (!opened || opened.deletedAt) {
      return undefined;
    }
    return opened;
  }
}

function objectKeyFrom(prefix: string, id: string): string | undefined {
  if (prefix !== "a" && prefix !== "e") {
    return undefined;
  }
  const objectKey = `${prefix}/${id}`;
  try {
    assertSafeObjectKey(objectKey);
  } catch {
    return undefined;
  }
  return objectKey;
}

function expiresAt(raw: string | undefined): number {
  if (!raw || !/^\d+$/.test(raw)) {
    return 0;
  }
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : 0;
}

function first(value: string | undefined): string {
  return value?.trim() ?? "";
}

async function readLimited(
  request: Request,
  maxBytes: number,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > maxBytes) {
      throw new HttpException(
        { code: "VALIDATION_FAILED", fields: { contentLength: ["invalid"] } },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    chunks.push(buffer);
  }
  if (size === 0) {
    throw new HttpException(
      { code: "VALIDATION_FAILED", fields: { contentLength: ["invalid"] } },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
  return Buffer.concat(chunks);
}
