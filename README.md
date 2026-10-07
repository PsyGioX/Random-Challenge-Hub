# Random Challenge Hub

![Random Challenge Hub v3](https://raw.githubusercontent.com/PsyGioX/Random-Challenge-Hub/refs/heads/main/screenshot.png)

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
[![Made with Love](https://img.shields.io/badge/Made%20with-love-red.svg)](https://github.com/PsyGioX)
[![Vanilla JS](https://img.shields.io/badge/Vanilla-JavaScript-f7df1e?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![No Dependencies](https://img.shields.io/badge/dependencies-none-brightgreen.svg)](package.json)

**An interactive platform for generating random gaming challenges and party activities.**  
Perfect for streamers, gamers, and groups of friends — runs entirely in your browser with no installation required.

[![Live Demo](https://img.shields.io/badge/%20Live%20Demo-random--challenge--hub.vercel.app-6366f1?style=for-the-badge)](https://random-challenge-hub.vercel.app)

</div>

---

# Table of Contents

- [About](#about)
- [Features](#features)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Roulette Modes](#roulette-modes)
- [OBS Overlay](#obs-overlay)
- [Streamer Mode](#streamer-mode)
- [Settings](#settings)
- [Technology Stack](#technology-stack)
- [Security & Privacy](#security--privacy)
- [Contributing](#contributing)
- [License](#license)

---

# About

Random Challenge Hub v4 is a free web application for fair and completely random gaming challenge selection.

Whether you're streaming on Twitch, hosting a LAN party, or playing online with friends, the app solves one simple question:

> **"What should we play next?"**

Everything runs **locally in your browser**—no servers, no accounts, no tracking, and no data collection.

---

# Features

## Core Features

| Feature | Description |
|---------|-------------|
| **Games & Challenges** | Create unlimited games with custom challenges |
| **Players** | Manage participants with colors and statistics |
| **5 Roulette Modes** | Full Random, Game First, Player Only, Task Only, Game Only |
| **Donation Auction** | Streamlabs · DonationAlerts · Twitch Bits/subs, live OBS widget |
| **Responsive** | Phone-friendly layout with a bottom navigation bar |
| **Statistics** | Spin history (CSV export), player activity, and rankings |
| **5 UI Themes** | Dark, Neon, Cyber, Streamer, and Pastel |
| **10 Color Palettes** | Customize wheel segment colors |
| **Local Storage** | Everything is saved in your browser |
| **Import / Export** | Backup and restore configurations as JSON |
| **Sound Effects** | Generated with the Web Audio API |
| **Elimination Mode** | Remove completed challenges automatically |
| **Blacklist** | Exclude challenges from future spins |

## Streamer Features

| Feature | Description |
|---------|-------------|
| **OBS Browser Source Overlay** | Live widgets for results, timer, and chat |
| **Chat Voting** | Viewers vote using `!1`, `!2`, `!3`, etc. |
| **Viewer Wheel** | Randomly pick a viewer from chat |
| **Streamer Timer** | Countdown synced with OBS Overlay |
| **Live Chat Widget** | Twitch chat displayed in the overlay |
| **Twitch IRC** | Anonymous read-only connection (no OAuth required) |
| **Chroma Key Mode** | Green background for OBS chroma key |

---

# Quick Start

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

# Project Structure

```
Random-Challenge-Hub/
├── index.html            app shell (responsive, bottom nav on phones)
├── overlay.html          OBS Browser Source (result, timer, chat, auction, alerts, wheel replay)
├── script.js             core: games, players, roulette modes, settings, stats
├── style.css             themes + v4 design layer
├── vendor/bootstrap-icons/   Bootstrap Icons 1.13 (icon font, bundled locally)
├── js/
│   ├── icons.js          bi() / biChar() helpers and {bi:name} tokens for translations
│   ├── wheel.js          wheel engine (weighted segments, bulb ring) — shared with the overlay
│   ├── bus.js            app  overlay sync (BroadcastChannel + localStorage)
│   ├── integrations.js   Twitch IRC parser, Streamlabs & DonationAlerts clients
│   ├── streamer.js       Twitch chat, voting, timer, viewer wheel, suggestions
│   └── auction.js        donation auction
├── i18n/                 en / ru / uk (+ ext.*.js with the newer strings)
└── legal/
```

---

# Roulette Modes

| Mode | What it does |
|------|--------------|
| **Full Random** | One spin picks game + task + player. Slice sizes follow the "avoid repeats" setting. |
| **Game First** | The wheel first picks a **game** (the wheel shows games), then every active player spins for a different task of that game. Players can be skipped; the result card offers the next player. |
| **Player Only** | Picks a participant. |
| **Task Only** | Random task from the game you choose, for a random or chosen player. |
| **Game Only** | Picks a game. |

All modes respect the task **blacklist**, skip players switched off in the Players tab, record the spin in the **history**, and can chain a **bonus round**.

---

# Auction

A point auction for streams in the style of pointauc.com ("what do we play next?", "which challenge?").

- **Lots** are a persistent list. Each lot has an amount, a colour bar showing its share of the pool, a rank and a percentage.
- **Bids** come from Streamlabs, DonationAlerts and Twitch (bits, subs, channel-point rewards). The lot is picked by `#number`, `lot 2` or by name; similar names (typos, case, spaces) are merged into one lot.
- **Edit by hand**: click a name to rename it, click an amount to set it exactly, use `-` / `+` with a configurable step, merge two lots, pin a lot between rounds, delete it, undo any bid.
- **Timer** with start / pause / +30s / +1m / +5m, anti-sniping and three finish modes: decide yourself, take the leader, or spin the wheel automatically.
- **Wheel**: *Normal* (slice size proportional to money) or *Dropout* (each spin eliminates one lot, the last one wins; bigger bid can mean safer or likelier, your choice). Eliminated lots can be returned to the wheel.
- **Bids panel** lists every bid with its source; bids that match no lot (or arrive while the auction is closed) wait in "Unassigned" until you assign them, create a lot from them or dismiss them.
- On phones the tab is split into **Lots / Wheel / Bids** panes; on desktop lots sit on the left and the wheel and bids on the right.

Tokens are stored only in your browser's `localStorage`. Do not show the Auction sources panel on stream.

---

# OBS Overlay

`overlay.html` is added to OBS as a **Browser Source**.

```
https://<your-host>/overlay.html?obs=1
```

### URL Parameters

| Parameter | Description |
|-----------|-------------|
| `obs=1` | Hide the control panel |
| `chroma=1` | Green background for chroma key |
| `theme=neon` | Overlay theme |
| `only=auction,alerts` | Show only these widgets: `result`, `timer`, `chat`, `auction`, `alerts`, `wheel` |

Use one Browser Source per widget (`only=`) to place them independently in OBS.

## Widgets

Result / vote / winner · Timer · Chat · **Auction** (live lots, clock, winner) · **Donation & bid alerts** · **Wheel replay** (the roulette, viewer wheel and auction wheel spin on stream in sync with the app). Widgets are draggable; positions are saved.

## Synchronization — important for OBS

The app and the overlay talk through `BroadcastChannel` + `localStorage`, so they must share one browser profile. **OBS Browser Sources have their own storage**, separate from Chrome. To feed the overlay, open this app *inside OBS*:

`View → Docks → Custom Browser Docks` → paste the app URL. Docks and Browser Sources share storage, so the overlay receives everything live.

---

# Streamer Mode

- **Twitch chat** — anonymous read-only IRC, auto-reconnect with back-off.
- **Chat voting** — options from random games, random tasks or your own list. Viewers type `2`, `!2` or `!vote 2` and may change their vote. Live bars in the overlay; ties are drawn at random; the winner can be applied to the roulette.
- **Timer** — precise (timestamp based), `!timer 5` / `!timer stop`.
- **Viewer wheel** — real animated wheel; equal chances, by chat activity, or subscribers ×2; optional removal of winners.
- **Viewer suggestions** — viewers send `!task text`, you approve it into a game.

## Chat Commands

| Command | Who | Description |
|---------|-----|-------------|
| `!spin` | mods | Spin (immediately if enabled, otherwise a notification) |
| `!vote [sec]` / `!endvote` | mods | Start / finish a vote |
| `!timer N` / `!timer stop` | mods | Timer in minutes |
| `!addchatters` / `!clearwheel` / `!add name` | mods | Manage the viewer wheel |
| `!lots` | mods | Show auction leaders |
| `!join` | everyone | Join the viewer wheel |
| `!task text` | everyone | Suggest a task (once a minute) |

---

# Settings

Wheel (size, bulbs, fonts, colours), particles, audio, elimination mode, **avoid repeats** (recently drawn tasks get smaller slices), task blacklist, bonus round, streamer/overlay options.

---

# Technology Stack

Vanilla HTML / CSS / JavaScript — no build step, no dependencies. Icons: Bootstrap Icons (MIT), bundled in `vendor/bootstrap-icons`. Canvas for the wheel, Web Audio for sound, WebSocket for Twitch / Streamlabs / DonationAlerts.

---

# Security & Privacy

- All data is stored locally in your browser; no cookies, analytics or trackers.
- Twitch chat uses anonymous read-only access — no login.
- Streamlabs / DonationAlerts tokens (only if you connect them) stay in `localStorage` and are sent only to those services. **Do not show the Auction → Sources panel on stream.**
- A strict Content Security Policy limits scripts to this site and connections to Twitch, Streamlabs and DonationAlerts.

---

# Contributing

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

# License

This project is licensed under the **MIT License**.

You are free to use, modify, and distribute it.

```
Copyright (c) 2026 Random Challenge Hub
```

Full license:

https://random-challenge-hub.vercel.app/legal/license.html

---

<div align="center">

Made with love for streamers and gamers

[Live Demo](https://random-challenge-hub.vercel.app) • [Issues](https://github.com/PsyGioX/Random-Challenge-Hub/issues) • [License](https://random-challenge-hub.vercel.app/legal/license.html)

</div>
