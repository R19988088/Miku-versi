param(
  [string]$Alias = "miku-versi",
  [string]$KeystorePassword,
  [string]$KeyPassword
)

$ErrorActionPreference = "Stop"

$repo = Resolve-Path (Join-Path $PSScriptRoot "..")
$outDir = Join-Path $repo "local-signing"
$keystore = Join-Path $outDir "release.keystore"
$secrets = Join-Path $outDir "github-secrets.txt"

if (-not $KeystorePassword) {
  $bytes = New-Object byte[] 24
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($bytes)
  $KeystorePassword = [Convert]::ToBase64String($bytes)
}

if (-not $KeyPassword) {
  $KeyPassword = $KeystorePassword
}

$keytoolCandidates = @()
if ($env:JAVA_HOME) {
  $keytoolCandidates += Join-Path $env:JAVA_HOME "bin\keytool.exe"
}
$keytoolCandidates += "C:\Program Files\Java\jre1.8.0_441\bin\keytool.exe"
$keytoolCandidates += "C:\Program Files (x86)\NS-USBloader\jdk\bin\keytool.exe"

$keytool = $keytoolCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $keytool) {
  throw "keytool.exe was not found. Install JDK 17 or set JAVA_HOME."
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

if (-not (Test-Path $keystore)) {
  & $keytool -genkeypair `
    -v `
    -storetype PKCS12 `
    -keystore $keystore `
    -alias $Alias `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -storepass $KeystorePassword `
    -keypass $KeyPassword `
    -dname "CN=Miku-versi, OU=Miku-versi, O=Miku-versi, L=Shanghai, ST=Shanghai, C=CN"
}

$base64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($keystore))

@"
ANDROID_KEYSTORE_BASE64=$base64
ANDROID_KEY_ALIAS=$Alias
ANDROID_KEYSTORE_PASSWORD=$KeystorePassword
ANDROID_KEY_PASSWORD=$KeyPassword
"@ | Set-Content -Encoding ASCII $secrets

@"
GitHub Secrets names and values

Create 4 repository secrets in:
Settings -> Secrets and variables -> Actions -> New repository secret

Name:
ANDROID_KEYSTORE_BASE64
Value:
$base64

Name:
ANDROID_KEY_ALIAS
Value:
$Alias

Name:
ANDROID_KEYSTORE_PASSWORD
Value:
$KeystorePassword

Name:
ANDROID_KEY_PASSWORD
Value:
$KeyPassword
"@ | Set-Content -Encoding ASCII (Join-Path $outDir "github-secrets-readable.txt")

$gh = Get-Command gh -ErrorAction SilentlyContinue
if ($gh) {
  gh secret set ANDROID_KEYSTORE_BASE64 --body $base64
  gh secret set ANDROID_KEY_ALIAS --body $Alias
  gh secret set ANDROID_KEYSTORE_PASSWORD --body $KeystorePassword
  gh secret set ANDROID_KEY_PASSWORD --body $KeyPassword
  Write-Host "GitHub Secrets updated."
} else {
  Write-Host "GitHub CLI was not found. Secrets were written to:"
  Write-Host $secrets
}

Write-Host "Keystore:"
Write-Host $keystore
