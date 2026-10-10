# Releasing Captr Studio

This repository uses `electron-builder` + `electron-updater` for multi-platform distribution and automatic updates across macOS, Windows, and Linux.

---

## 📋 Release Checklist

Before triggering a release, complete the following local validation steps:

### 1. Code Quality & Test Verification
Ensure all tests and lint checks pass cleanly:
```bash
# Run unit test suites
npm test

# Run TypeScript compilation check
npx tsc --noEmit

# Run Biome linter check
npm run lint

# Refresh repository context graph
npx graft build
```

### 2. Verify Native Helpers & Runtime
Ensure native capture and AI runtime helpers compile cleanly:
```bash
# Build platform native helpers (WGC, WASAPI, CUDA, Cursor Monitor, Whisper Runtime)
npm run build:platform-native-helpers

# Verify compiled Electron main bundle
npm run smoke:electron-main-cjs
```

> **Note on Local Windows Builds without Whisper binaries:**  
> If compiling a local test build on a machine without pre-downloaded Whisper runtime binaries, use:
> ```bash
> npm run build:win:local
> ```

---

## 🚀 Release Workflow

### Step 1: Version Bump
Ensure `package.json` contains the target release version (e.g. `1.4.0-beta.1` or `1.4.0`):
```bash
npm version 1.4.0-beta.1 --no-git-tag-version
```

### Step 2: Prepare Release Notes
Create or update your release notes file (e.g., `release-notes-v1.4.0-beta.1.md`) or update `CHANGELOG.md`.

### Step 3: Commit and Push
```bash
git add package.json package-lock.json CHANGELOG.md README.md
git commit -m "chore(release): bump version to 1.4.0-beta.1"
git push origin <branch-name>
```

### Step 4: Publish via GitHub CLI Helper
Use the built-in release script to create the GitHub release and trigger the automated build pipeline.

#### For Pre-releases (Beta / RC):
```bash
npm run release:create -- --tag v1.4.0-beta.1 --title "v1.4.0-beta.1" --prerelease --notes-file ./release-notes-v1.4.0-beta.1.md
```

#### For Stable Production Releases:
```bash
npm run release:create -- --tag v1.4.0 --title "v1.4.0" --notes-file ./release-notes-v1.4.0.md
```

This helper invokes `gh release create --verify-tag --generate-notes` while prepending your custom notes, preserving GitHub's automatic contributor recognition and commit summaries.

---

## ⚙️ Automated CI/CD Release Pipeline

When a GitHub Release is published, `.github/workflows/release.yml` triggers automatically:

1. **Tag Validation**: Asserts that the Git tag (e.g., `v1.4.0-beta.1`) strictly matches the version in `package.json` (`1.4.0-beta.1`).
2. **macOS Build Job**:
   - Builds signed universal/multi-arch macOS artifacts (`x64` and `arm64`).
   - Submits binaries for Apple Notarization via `notarytool`.
   - Generates `.dmg` and `.zip` distribution packages.
   - Merges dual-architecture metadata into authoritative `latest-mac.yml`.
3. **Windows Build Job**:
   - Compiles native DirectX 11 capture and WASAPI loopback C++ helpers.
   - Signs executable with Microsoft Authenticode certificate.
   - Packages NSIS installer (`Captr Studio-<version>-Setup.exe`) and generates `latest.yml`.
4. **Linux Build Job**:
   - Builds Linux AppImage package and generates `latest-linux.yml`.
5. **Asset Upload & Attestation**:
   - Uploads all installer binaries and auto-update metadata to the GitHub release.
   - Dispatches downstream packaging (e.g. Homebrew tap or Winget).

---

## 🔐 Required GitHub Secrets & Environment Variables

To enable automated signing, notarization, and auto-updating in GitHub Actions, configure the following secrets in your repository settings:

### macOS Signing & Notarization
- `APPLE_SIGNING_CERTIFICATE_P12_BASE64`: Base64-encoded `.p12` export of your **Developer ID Application** certificate.
- `APPLE_SIGNING_CERTIFICATE_PASSWORD`: Password for the exported `.p12` certificate.
- `APPLE_ID`: Your Apple Developer account email address.
- `APPLE_APP_SPECIFIC_PASSWORD`: App-specific password generated at [appleid.apple.com](https://appleid.apple.com).
- `APPLE_TEAM_ID`: 10-character Apple Developer Team ID.

> **Exporting Certificate on macOS:**
> ```bash
> security export -k ~/Library/Keychains/login.keychain-db -t identities -f pkcs12 -P "YOUR_PASSWORD" -o captr-mac-signing.p12
> base64 < captr-mac-signing.p12 | pbcopy
> ```

### Windows Code Signing
- `WINDOWS_SIGNING_CERTIFICATE_P12_BASE64`: Base64-encoded Authenticode `.p12` certificate.
- `WINDOWS_SIGNING_CERTIFICATE_PASSWORD`: Password for the Authenticode certificate.

### Distribution & Package Managers
- `HOMEBREW_TAP_TOKEN`: Personal Access Token (PAT) with repository write permissions to update the Homebrew cask repository.
- `HOMEBREW_TAP_REPO` *(Optional)*: Target Homebrew tap repository (e.g. `rhamaa/homebrew-captr`).
- `HOMEBREW_TAP_AUTO_MERGE` *(Optional)*: Set to `true` to enable automatic PR merging.

---

## 📦 Checksums & Artifact Verification

To generate or verify SHA-256 checksums for packaged installers locally:
```bash
npm run checksums:release
```
This produces `release/SHA256SUMS.txt` listing the cryptographic hashes of all release artifacts:
```
<sha256>  Captr Studio-1.4.0-beta.1-Setup.exe
<sha256>  Captr Studio-1.4.0-beta.1.dmg
<sha256>  Captr Studio-1.4.0-beta.1.AppImage
<sha256>  latest.yml
<sha256>  latest-mac.yml
<sha256>  latest-linux.yml
```

Users and package managers can verify integrity via:
```bash
# Windows (PowerShell)
Get-FileHash -Algorithm SHA256 "Captr Studio-1.4.0-beta.1-Setup.exe"

# macOS & Linux
shasum -a 256 "Captr Studio-1.4.0-beta.1.dmg"
```

---

## 🔄 Re-running Failed Release Builds

If an existing release needs rebuilding without changing the Git tag:
1. Navigate to **Actions** > **Publish Release** in GitHub.
2. Click **Run workflow**.
3. Enter the existing tag name (e.g. `v1.4.0-beta.1`) into the `tag_name` field.
4. Run the workflow to rebuild, re-sign, and update release assets.
