const { existsSync, cpSync, rmSync, statSync, copyFileSync, readFileSync, writeFileSync } = require('fs');
const { join } = require('path');
const { execFileSync } = require('child_process');

const root = join(__dirname, '..');
const sourceIconName = 'D.Miku_versi.png';
const sourceIcon = join(root, sourceIconName);
const androidIconSource = join(root, 'src-tauri', 'icons', 'android');
const androidResTarget = join(root, 'android', 'app', 'src', 'main', 'res');

function assertFile(path, minBytes) {
  if (!existsSync(path) || statSync(path).size < minBytes) {
    throw new Error(`Icon was not generated correctly: ${path}`);
  }
}

function forceAndroidPngLauncher(resPath) {
  const manifest = join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
  if (!existsSync(resPath)) return;

  rmSync(join(resPath, 'mipmap-anydpi-v26'), { force: true, recursive: true });
  rmSync(join(resPath, 'values', 'ic_launcher_aliases.xml'), { force: true });

  for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
    const mipmapDir = join(resPath, `mipmap-${density}`);
    copyFileSync(join(mipmapDir, 'ic_launcher.png'), join(mipmapDir, 'ic_launcher_png.png'));
    copyFileSync(join(mipmapDir, 'ic_launcher_round.png'), join(mipmapDir, 'ic_launcher_round_png.png'));
  }

  if (existsSync(manifest)) {
    const xml = readFileSync(manifest, 'utf8')
      .replace(/android:icon="@[^"]+"/, 'android:icon="@mipmap/ic_launcher_png"')
      .replace(/android:roundIcon="@[^"]+"/, 'android:roundIcon="@mipmap/ic_launcher_round_png"');
    writeFileSync(manifest, xml, 'utf8');
  }
}

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

forceAndroidPngLauncher(androidIconSource);

assertFile(join(root, 'src-tauri', 'icons', 'icon.icns'), 1024);
assertFile(join(androidIconSource, 'mipmap-xxxhdpi', 'ic_launcher_png.png'), 1024);
assertFile(join(androidIconSource, 'mipmap-xxxhdpi', 'ic_launcher_round_png.png'), 1024);

if (existsSync(androidResTarget)) {
  cpSync(androidIconSource, androidResTarget, { recursive: true });
  forceAndroidPngLauncher(androidResTarget);
  assertFile(join(androidResTarget, 'mipmap-xxxhdpi', 'ic_launcher_png.png'), 1024);
  assertFile(join(androidResTarget, 'mipmap-xxxhdpi', 'ic_launcher_round_png.png'), 1024);
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
