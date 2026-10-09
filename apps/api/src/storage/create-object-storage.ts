import type { AppConfig } from "../config/app-config";
import { FilesystemObjectStorage } from "./filesystem-object-storage";
import { GcsObjectStorage } from "./gcs-object-storage";
import { MinioObjectStorage } from "./minio-object-storage";
import type { ObjectStoragePort } from "./object-storage.port";

export function createObjectStorage(config: AppConfig): ObjectStoragePort {
  const storage = config.objectStorage;
  if (storage.backend === "minio") {
    return MinioObjectStorage.fromConfig(storage);
  }
  if (storage.backend === "filesystem") {
    return new FilesystemObjectStorage(storage);
  }
  return GcsObjectStorage.fromConfig(storage);
}
