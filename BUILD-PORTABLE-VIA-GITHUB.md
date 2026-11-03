# Build the portable Windows x64 EXE without installing Node.js on your PC

The finished portable EXE bundles Electron (including its Node.js runtime). The computer that runs the EXE does **not** need Node.js, npm, PowerShell, or a separate runtime installation.

## Build using GitHub's Windows build machine

1. Create a GitHub repository and upload this project folder.
2. Open the repository's **Actions** tab.
3. Select **Build AI Content Studio Portable (Windows x64)**.
4. Click **Run workflow** and confirm **Run workflow**.
5. When the workflow finishes, open its run and download the artifact named **AI-Content-Studio-Portable-Windows-x64**.
6. Extract the downloaded artifact. It contains the portable `.exe`.

GitHub's Windows runner installs Node.js only on the temporary build machine. Node.js is not installed on the user's Windows computer and is not required to run the finished EXE.

## Portable data

The app stores its database and settings in `AI-Content-Studio-Data` next to the portable executable when the Electron portable launcher provides its portable directory environment variables. Keep this data folder beside the EXE when moving or backing up the app.

## Local build (optional)

`BUILD-PORTABLE.bat` is an optional one-click local build helper. It requires Node.js only on the computer doing the build. End-user computers do not need Node.js.
