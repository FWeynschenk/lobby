export const gamesConfig = [
    {
        id: 'test-game',
        name: 'Test Game',
        description: 'A simple game to test connectivity and lobby functionality.',
        location: 'games/test-game/index.html',
        variants: [
            {
                id: 'pvp',
                name: 'PvP',
                description: 'Player vs Player',
                players: 2
            },
            {
                id: 'pve',
                name: 'PvE',
                description: 'Player vs AI',
                players: 1
            },
            {
                id: '3p',
                name: '3-Player',
                description: 'Triple Threat',
                players: 3
            }
        ]
    },
    {
        id: 'connect4',
        name: 'Connect 4',
        description: 'Classic 4-in-a-row strategy game.',
        location: 'games/connect4/index.html',
        variants: [
            {
                id: 'pvp',
                name: 'PvP',
                description: 'Player vs Player',
                players: 2
            },
            {
                id: 'pve',
                name: 'PvE',
                description: 'Player vs AI',
                players: 1
            }
        ]
    },
    {
        id: 'minimal-template',
        name: 'Minimal Template',
        description: 'Button-only scaffold with scoring, surrender, and rematch.',
        location: 'games/minimal-template/index.html',
        variants: [
            {
                id: 'pve',
                name: 'PvE',
                description: 'Solo vs helper bot',
                players: 1
            },
            {
                id: '2p',
                name: '2P PvP',
                description: 'Head-to-head match',
                players: 2
            },
            {
                id: '3p',
                name: '3P PvP',
                description: 'Free-for-all (three players)',
                players: 3
            }
        ]
    },
    {
        id: 'hex',
        name: 'Hex',
        description: 'Classic abstract strategy game. Connect opposite sides to win!',
        location: 'https://flwe.nl/hex/index-lobby.html',
        variants: [
            {
                id: 'pve',
                name: 'PvE (vs AI)',
                description: 'Practice against AI opponents',
                players: 1
            },
            {
                id: 'pvp',
                name: 'PvP',
                description: 'Head-to-head match',
                players: 2
            }
        ]
    }
];
