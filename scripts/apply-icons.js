const { existsSync, cpSync, rmSync } = require('fs');
const { join } = require('path');
const { execFileSync } = require('child_process');

const root = join(__dirname, '..');
const sourceIconName = 'D.Miku_versi.png';
const sourceIcon = join(root, sourceIconName);
const androidIconSource = join(root, 'src-tauri', 'icons', 'android');
const androidResTarget = join(root, 'android', 'app', 'src', 'main', 'res');

if (!existsSync(sourceIcon)) {
  throw new Error('Missing source icon: D.Miku_versi.png');
}

if (process.platform === 'win32') {
  execFileSync('cmd.exe', ['/d', '/s', '/c', 'npx tauri icon D.Miku_versi.png'], {
    cwd: root,
    stdio: 'inherit',
  });
} else {
  execFileSync('npx', ['tauri', 'icon', sourceIconName], {
    cwd: root,
    stdio: 'inherit',
  });
}

if (existsSync(androidResTarget) && existsSync(androidIconSource)) {
  cpSync(androidIconSource, androidResTarget, { recursive: true });
}

const generatedButUnused = [
  'StoreLogo.png',
  'Square30x30Logo.png',
  'Square44x44Logo.png',
  'Square71x71Logo.png',
  'Square89x89Logo.png',
  'Square107x107Logo.png',
  'Square142x142Logo.png',
  'Square150x150Logo.png',
  'Square284x284Logo.png',
  'Square310x310Logo.png',
  'ios',
];

for (const generatedPath of generatedButUnused) {
  rmSync(join(root, 'src-tauri', 'icons', generatedPath), { force: true, recursive: true });
}
