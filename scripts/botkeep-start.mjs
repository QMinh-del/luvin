import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const shell = process.platform === "win32";

function run(args) {
  const result = spawnSync("npm", args, { stdio: "inherit", shell });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (
  !existsSync("node_modules/@nestjs/cli/package.json") ||
  !existsSync("node_modules/prisma/package.json") ||
  !existsSync("node_modules/typescript/package.json")
) {
  process.stderr.write(
    "Botkeep omitted the build tools. Set NPM_CONFIG_PRODUCTION=false in Environment, then redeploy so npm installs devDependencies.\n",
  );
  process.exit(1);
}

run(["run", "build", "--workspace=@luvin/api"]);
run(["run", "prisma:migrate", "--workspace=@luvin/api"]);

const server = spawn(process.execPath, ["apps/api/dist/main.js"], {
  stdio: "inherit",
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    server.kill(signal);
  });
}

server.on("exit", (code) => {
  process.exit(code ?? 0);
});
