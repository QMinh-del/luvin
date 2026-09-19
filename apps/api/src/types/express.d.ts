import "express";

declare module "express-serve-static-core" {
  interface Request {
    requestId?: string;
    auth?: {
      userId: string;
      sessionId: string;
      deviceId: string;
    };
  }
}
