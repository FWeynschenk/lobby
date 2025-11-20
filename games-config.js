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
    }
];
