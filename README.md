# TrackCP: DSA/CP Tracker

A Chrome Extension to track your competitive programming progress on GitHub.
Supports **LeetCode**, **Codeforces**, and **CodeChef**.

## Features

- **One-Click Push**: Scrapes problem data, code, and metadata.
- **Auto-Organization**: Maps problems to a structured GitHub repository.
- **Timer**: Automatically tracks how long you spend on a problem.
- **Screenshots**: Captures "Accepted" state visual proof.
- **Progress Tracking**: Maintains a `metadata/progress.json` with solve counts.
- **Privacy First**: No backend server. Your data stays between your browser and GitHub.

## Installation

1. Clone or download this repository.
2. Run `npm install` to install dependencies.
3. Run `npm run build` to create the `dist` folder.
4. Open Chrome and go to `chrome://extensions`.
5. Enable "Developer mode".
6. Click "Load unpacked" and select the `dist` folder.

## Configuration

1. Click the TrackCP extension icon.
2. Click the settings gear icon.
3. Enter your **GitHub Personal Access Token** (must have `repo` scope).
4. Enter your GitHub Username.
5. Enter the Target Repository Name (e.g., `dsa-archive`).

## Usage

1. Go to any problem page on LeetCode, Codeforces, or CodeChef.
2. Solve the problem.
3. Click the extension icon.
4. Verify the extracted data.
5. (Optional) Toggle "Include Screenshot".
6. Click **Push Solution**.

## Development

- `npm run dev`: Start Vite dev server (popup only).
- `npm run build`: Build for production.

## Tech Stack

- React + TypeScript + Vite
- TailwindCSS
- Chrome Extension Manifest V3
- GitHub REST API
