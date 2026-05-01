const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const files = [
  ...listJs(path.join(root, "src", "js")),
  path.join(root, "src", "server.js"),
];

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function listJs(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return listJs(fullPath);
      }
      return entry.isFile() && entry.name.endsWith(".js") ? [fullPath] : [];
    });
}
