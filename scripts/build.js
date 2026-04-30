const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const srcDir = path.join(root, "src");
const distDir = path.join(root, "dist");
const vendorDir = path.join(distDir, "vendor");
const threeSource = path.join(root, "node_modules", "three", "build", "three.module.js");

fs.rmSync(distDir, { recursive: true, force: true });
copyDir(srcDir, distDir, new Set(["server.js"]));
fs.mkdirSync(vendorDir, { recursive: true });

if (!fs.existsSync(threeSource)) {
  throw new Error("Missing three dependency. Run npm install before npm run build.");
}

fs.copyFileSync(threeSource, path.join(vendorDir, "three.module.js"));

const indexPath = path.join(distDir, "index.html");
const index = fs.readFileSync(indexPath, "utf8").replace(
  '"three": "https://unpkg.com/three@0.164.1/build/three.module.js"',
  '"three": "./vendor/three.module.js"'
);
fs.writeFileSync(indexPath, index);

function copyDir(from, to, ignoredNames = new Set()) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (ignoredNames.has(entry.name)) continue;
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDir(source, target, ignoredNames);
    } else {
      fs.copyFileSync(source, target);
    }
  }
}
