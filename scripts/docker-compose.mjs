import { spawn, spawnSync } from "node:child_process";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: node scripts/docker-compose.mjs <compose arguments>");
  process.exit(1);
}

function commandExists(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    stdio: "ignore",
    windowsHide: true,
  });

  return result.status === 0;
}

function run(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      stdio: "inherit",
      windowsHide: false,
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${command} exited with ${signal ? `signal ${signal}` : `code ${code}`}.`,
        ),
      );
    });
  });
}

function output(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.status !== 0) {
    return null;
  }

  return result.stdout;
}

async function waitForComposeServices(
  composeCommand,
  composePrefix,
  composeArgs,
  supportsPsAll,
) {
  const upIndex = composeArgs.indexOf("up");
  const contextArgs = composeArgs.slice(0, upIndex);
  const timeoutAt = Date.now() + 90_000;

  while (Date.now() < timeoutAt) {
    const psArgs = [...composePrefix, ...contextArgs, "ps", "-q"];

    if (supportsPsAll) {
      psArgs.push("--all");
    }

    const ids = output(composeCommand, psArgs)
      ?.split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);

    if (ids?.length) {
      const inspect = output("docker", ["inspect", ...ids]);
      if (inspect) {
        const containers = JSON.parse(inspect);
        const failed = containers.find(
          (container) =>
            container.State.Health?.Status === "unhealthy" ||
            (container.State.Status === "exited" &&
              container.State.ExitCode !== 0),
        );

        if (failed) {
          throw new Error(
            `Compose service ${failed.Name} did not become healthy (status: ${failed.State.Status}).`,
          );
        }

        const ready = containers.every((container) =>
          container.State.Health
            ? container.State.Health.Status === "healthy"
            : container.State.Status === "running" ||
              (container.State.Status === "exited" &&
                container.State.ExitCode === 0),
        );

        if (ready) {
          return;
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(
    "Timed out waiting for Docker Compose services to become ready.",
  );
}

const hasComposeV2 = commandExists("docker", ["compose", "version"]);
const hasComposeV1 =
  !hasComposeV2 && commandExists("docker-compose", ["version"]);

if (!hasComposeV2 && !hasComposeV1) {
  console.error(
    "Docker Compose was not found. Install Docker Compose V2 or make docker-compose V1 available on PATH.",
  );
  process.exit(1);
}

const composeCommand = hasComposeV2 ? "docker" : "docker-compose";
const composePrefix = hasComposeV2 ? ["compose"] : [];
const requiresCompatibilityWait = args.includes("--wait");
const commandArgs = requiresCompatibilityWait
  ? args.filter((value) => value !== "--wait")
  : args;

await run(composeCommand, [...composePrefix, ...commandArgs]);

if (requiresCompatibilityWait && commandArgs.includes("up")) {
  await waitForComposeServices(
    composeCommand,
    composePrefix,
    commandArgs,
    hasComposeV2,
  );
}
