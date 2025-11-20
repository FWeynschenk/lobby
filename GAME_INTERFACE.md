# Game Interface Specification

This document outlines how to create games compatible with the Multi-Game Lobby System.

## 1. Game Registration

To add a game to the lobby, you must provide a game configuration object.

```javascript
    {
        id: 'my-game',              // Unique ID
        name: 'My Awesome Game',    // Display Name
        description: 'Strategy game for 2 players.',
        location: 'https://my-site.com/games/my-game/index.html', // Absolute URL for external games
        variants: [
            {
                id: 'standard',
                name: 'Standard',
                description: 'Classic rules',
                players: 2          // Number of players required 1 to as many as you want
            }
        ]
    }
```

> [!NOTE]
> The `location` can be a relative path (for games hosted in this repo) or an absolute URL (for games hosted externally).

## 2. Receiving Connection Data

When a match is found, the lobby redirects players to your game's `location` with the following URL query parameters:

- `matchId`: A unique string shared by all players in the match. **Use this as your Trystero Room ID.**
- `variant`: The variant ID selected (e.g., `standard`).
- `playerId`: The current user's persistent ID.
- `displayName`: The current user's display name.

### Example URL
```
/games/my-game/index.html?matchId=abc-123&variant=standard&playerId=uuid-1&displayName=Alice
```

## 3. Connecting with Trystero

Your game should use Trystero to connect players using the provided `matchId`.

### Example Implementation

```javascript
import { joinRoom } from 'trystero';

// 1. Parse URL Parameters
const params = new URLSearchParams(window.location.search);
const matchId = params.get('matchId');
const variantId = params.get('variant');
const myName = params.get('displayName');

if (!matchId) {
    console.error('No match ID found! Start from the lobby.');
}

// 2. Connect to Room
// Use a unique appId for your game.
// IMPORTANT: The room ID must be the matchId.
const config = { appId: 'my-awesome-game' };
const room = joinRoom(config, matchId);

// 3. Set up Actions
const [sendMove, getMove] = room.makeAction('move');

room.onPeerJoin(peerId => {
    console.log('Player joined:', peerId);
    // You might want to exchange names/ready status here
});

getMove((data, peerId) => {
    console.log('Received move from', peerId, data);
});
```

## 4. Return to Lobby

You should provide a way for players to return to the lobby.

```html
<button onclick="window.location.href = 'https://flwe.nl/lobby/index.html'">Return to Lobby</button>
```
