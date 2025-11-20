# Multi-Game Lobby System

A decentralized, browser-based lobby system for multiplayer games using [Trystero](https://github.com/dmotz/trystero) for WebRTC connectivity.

## Overview

This project provides a "Global Lobby" where players can:
- Set their display name.
- View available games and variants.
- Queue for multiple games/variants simultaneously.
- Automatically match with other players.
- Be redirected to the game instance with connection details.

## Getting Started

### Prerequisites
- Node.js installed.

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally
Start the development server:
```bash
npx vite
```
Open [http://localhost:5173](http://localhost:5173) in your browser. Open multiple windows to simulate multiple players.

## Project Structure

- `index.html`: Main lobby entry point.
- `lobby.js`: Core lobby logic (matchmaking, queue management).
- `games-config.js`: Registry of available games.
- `style.css`: Global styles.
- `games/`: Directory containing game implementations.

## Adding New Games

See [GAME_INTERFACE.md](GAME_INTERFACE.md) for detailed instructions on how to create and register compatible games.
