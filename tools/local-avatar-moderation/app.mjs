/**
 * Local-only avatar safety proof of concept.
 *
 * It deliberately has no connection to the Luvin API. A PASS or REVIEW from
 * this service must never publish an avatar or replace production SafeSearch.
 */
import http from "node:http";

import * as tf from "@tensorflow/tfjs";
import * as nsfwjs from "nsfwjs";
import sharp from "sharp";

const maxImageBytes = 5 * 1024 * 1024;
const reviewThreshold = 0.2;

await tf.ready();
const model = await nsfwjs.load();

function json(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

async function classify(payload) {
  const { data, info } = await sharp(payload)
    .rotate()
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const image = tf.tensor3d(
    new Uint8Array(data),
    [info.height, info.width, 3],
    "int32",
  );

  try {
    const predictions = await model.classify(image, 5);
    const nsfwScore = Math.max(
      0,
      ...predictions
        .filter(
          ({ className }) =>
            className === "Porn" ||
            className === "Sexy" ||
            className === "Hentai",
        )
        .map(({ probability }) => probability),
    );
    return {
      mode: "development-only",
      verdict: nsfwScore >= reviewThreshold ? "REVIEW" : "PASS",
      nsfwScore: Number(nsfwScore.toFixed(6)),
      threshold: reviewThreshold,
      predictions: predictions.map(({ className, probability }) => ({
        label: className,
        score: Number(probability.toFixed(6)),
      })),
    };
  } finally {
    image.dispose();
  }
}

http
  .createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/healthz") {
      json(response, 200, { status: "ready", mode: "development-only" });
      return;
    }
    if (request.method !== "POST" || request.url !== "/classify") {
      json(response, 404, { error: "Not found." });
      return;
    }
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(
        request.headers["content-type"]?.split(";")[0],
      )
    ) {
      json(response, 415, { error: "Use JPEG, PNG, or WebP content." });
      return;
    }

    const chunks = [];
    let byteCount = 0;
    request.on("data", (chunk) => {
      byteCount += chunk.length;
      if (byteCount > maxImageBytes) {
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", async () => {
      if (byteCount === 0 || byteCount > maxImageBytes) {
        json(response, 413, {
          error: "Image must be between 1 byte and 5 MB.",
        });
        return;
      }
      try {
        json(response, 200, await classify(Buffer.concat(chunks)));
      } catch {
        json(response, 400, { error: "Invalid image data." });
      }
    });
  })
  .listen(8089, "0.0.0.0");
