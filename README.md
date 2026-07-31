# 🎲 Random Challenge Hub

![Random Challenge Hub v3](https://raw.githubusercontent.com/PsyGioX/Random-Challenge-Hub/refs/heads/main/screenshot.png)

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
[![Made with Love](https://img.shields.io/badge/Made%20with-%E2%9D%A4%EF%B8%8F-red.svg)](https://github.com/PsyGioX)
[![Vanilla JS](https://img.shields.io/badge/Vanilla-JavaScript-f7df1e?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![No Dependencies](https://img.shields.io/badge/dependencies-none-brightgreen.svg)](package.json)

**An interactive platform for generating random gaming challenges and party activities.**  
Perfect for streamers, gamers, and groups of friends — runs entirely in your browser with no installation required.

[![Live Demo](https://img.shields.io/badge/🌐%20Live%20Demo-random--challenge--hub.vercel.app-6366f1?style=for-the-badge)](https://random-challenge-hub.vercel.app)

</div>

---

# 📋 Table of Contents

- [About](#-about)
- [Features](#-features)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [Roulette Modes](#-roulette-modes)
- [OBS Overlay](#-obs-overlay)
- [Streamer Mode](#-streamer-mode)
- [Settings](#-settings)
- [Technology Stack](#-technology-stack)
- [Security & Privacy](#-security--privacy)
- [Contributing](#-contributing)
- [License](#-license)

---

# 🎯 About

Random Challenge Hub v3 is a free web application for fair and completely random gaming challenge selection.

Whether you're streaming on Twitch, hosting a LAN party, or playing online with friends, the app solves one simple question:

> **"What should we play next?"**

Everything runs **locally in your browser**—no servers, no accounts, no tracking, and no data collection.

---

# ✨ Features

## Core Features

| Feature | Description |
|---------|-------------|
| 🎮 **Games & Challenges** | Create unlimited games with custom challenges |
| 👥 **Players** | Manage participants with colors and statistics |
| 🎰 **4 Roulette Modes** | Full Random, Game First, Player Only, Challenge Only |
| 📊 **Statistics** | Spin history, player activity, and rankings |
| 🎨 **5 UI Themes** | Dark, Neon, Cyber, Streamer, and Pastel |
| 🖌️ **10 Color Palettes** | Customize wheel segment colors |
| 💾 **Local Storage** | Everything is saved in your browser |
| 📤 **Import / Export** | Backup and restore configurations as JSON |
| 🔊 **Sound Effects** | Generated with the Web Audio API |
| ❌ **Elimination Mode** | Remove completed challenges automatically |
| 🚫 **Blacklist** | Exclude challenges from future spins |

## Streamer Features

| Feature | Description |
|---------|-------------|
| 🖥️ **OBS Browser Source Overlay** | Live widgets for results, timer, and chat |
| 🗳️ **Chat Voting** | Viewers vote using `!1`, `!2`, `!3`, etc. |
| 💜 **Viewer Wheel** | Randomly pick a viewer from chat |
| ⏱️ **Streamer Timer** | Countdown synced with OBS Overlay |
| 💬 **Live Chat Widget** | Twitch chat displayed in the overlay |
| 📡 **Twitch IRC** | Anonymous read-only connection (no OAuth required) |
| 🟢 **Chroma Key Mode** | Green background for OBS chroma key |

---

# 🚀 Quick Start

## Online

Open the app in your browser:

https://random-challenge-hub.vercel.app

No installation required.

## Run Locally

```bash
git clone https://github.com/PsyGioX/Random-Challenge-Hub.git
cd Random-Challenge-Hub
```

Simply open `index.html` in your browser.

No dependencies.
No build tools.
No server required.

For the best OBS Overlay experience, use a local HTTP server:

```bash
npx serve .

# or

python -m http.server 8080
```

## Basic Usage

1. Add games and challenges.
2. Add players.
3. Choose a roulette mode.
4. Spin the wheel.
5. Connect Twitch and configure OBS Overlay if you're streaming.

---

# 📁 Project Structure

```
Random-Challenge-Hub/
├── index.html
├── overlay.html
├── script.js
├── style.css
├── site.webmanifest
├── sitemap.xml
├── robots.txt
├── favicon/
│   └── favicon.png
└── legal/
    ├── about.html
    ├── privacy_policy.html
    ├── terms_of_service.html
    ├── disclaimer.html
    └── license.html
```

---

# 🎰 Roulette Modes

## Full Random

Every challenge from every game is added to the wheel.

A single spin randomly selects:

- Game
- Challenge
- Player

---

## Game First

The wheel first selects a game.

Each player then spins separately and receives a unique challenge from that game.

Perfect for LAN parties and multiplayer sessions.

---

## Player Only

The wheel contains only player names.

Useful when you simply need to randomly choose someone.

---

## Challenge Only

Select a specific game.

The wheel spins only challenges belonging to that game, with an optional player selection.

---

# 🖥️ OBS Overlay

The overlay is a separate page (`overlay.html`) that can be added to OBS as a **Browser Source**.

## Setup

1. OBS → Sources → Add → Browser Source
2. URL:

```
https://random-challenge-hub.vercel.app/overlay.html?obs=1
```

3. Set your preferred resolution (1920×1080 recommended).

### URL Parameters

| Parameter | Description |
|-----------|-------------|
| `obs=1` | Hide the control panel |
| `chroma=1` | Green background for chroma key |
| `theme=neon` | Select overlay theme |

## Widgets

- Challenge Result
- Countdown Timer
- Twitch Chat

Widgets are draggable and automatically snap to screen edges.

Their positions are saved locally.

## Synchronization

The overlay communicates with the main application using `localStorage`.

Both pages must be open in the **same browser**.

---

# 📡 Streamer Mode

## Twitch Connection

Enter your channel name and click **Connect**.

The app connects through anonymous **Twitch IRC** in read-only mode.

No OAuth token is required.

```
Channel → wss://irc-ws.chat.twitch.tv
```

---

## Chat Voting

1. Start a poll.
2. Optionally enter a poll title.
3. Viewers vote using:

```
!1
!2
!3
!4
```

When the timer ends, the winner is selected automatically.

---

## Viewer Wheel

Add viewers manually or import everyone currently in chat.

The wheel randomly selects one viewer.

---

## Chat Commands

| Command | Description |
|---------|-------------|
| `!spin` | Spin the wheel (moderators only) |
| `!timer 5` | Start a 5-minute timer |
| `!add username` | Add a viewer to the viewer wheel |

---

# ⚙️ Settings

## Wheel

- Spin Speed
- Spin Duration
- Result Delay
- Segment Font Size
- Pointer Style
- Border Style

## Particles

Customize the amount and style of victory particles.

## Audio

Enable or disable sound effects.

## Elimination Mode

Completed challenges are automatically removed from the wheel after selection.

---

# 🛠 Technology Stack

| Technology | Purpose |
|------------|---------|
| HTML5 | Semantic markup & Canvas |
| CSS3 | Themes, variables, animations |
| Vanilla JavaScript | Entire application logic |
| Canvas API | Wheel rendering & animation |
| Web Audio API | Sound generation |
| WebSocket (Twitch IRC) | Live Twitch chat |
| localStorage / IndexedDB | Local data persistence |
| CSS Custom Properties | Theme system |

**Zero dependencies.**

No Node.js.
No frameworks.
No bundlers.

---

# 🔒 Security & Privacy

- All data is stored locally in your browser.
- Twitch IRC uses anonymous read-only access.
- No OAuth tokens are stored.
- A strict Content Security Policy blocks unauthorized scripts.
- No cookies.
- No analytics.
- No trackers.
- No external APIs (except Twitch WebSocket when explicitly connected).

---

# 🤝 Contributing

Pull Requests are always welcome!

```bash
# Fork the repository

# Create a feature branch
git checkout -b feature/my-feature

# Commit your changes
git commit -m "feat: add my feature"

# Push the branch
git push origin feature/my-feature

# Open a Pull Request
```

---

# 📄 License

This project is licensed under the **MIT License**.

You are free to use, modify, and distribute it.

```
Copyright (c) 2026 Random Challenge Hub
```

Full license:

https://random-challenge-hub.vercel.app/legal/license.html

---

<div align="center">

Made with ❤️ for streamers and gamers

[🌐 Live Demo](https://random-challenge-hub.vercel.app) • [🐞 Issues](https://github.com/PsyGioX/Random-Challenge-Hub/issues) • [📄 License](https://random-challenge-hub.vercel.app/legal/license.html)

</div>
