const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3000 });

// Game state
let gameStarted = false;
let players = [];
let currentPlayerIndex = 0;
let currentRound = [];

// Initialize deck of cards
const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const deck = ranks.flatMap(rank => suits.map(suit => ({ rank, suit })));

// Shuffle deck
const shuffleDeck = () => {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
};

// Deal cards to players
const dealCards = () => {
    for (let i = 0; i < players.length; i++) {
        players[i].cards = deck.slice(i * 13, (i + 1) * 13);
        players[i].ws.send(JSON.stringify({ type: 'cards', cards: players[i].cards }));
    }
};

// Determine the next player
const nextPlayer = () => {
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    broadcast({ type: 'message', message: `Player ${currentPlayerIndex + 1}'s turn` });
};

// Broadcast message to all players
const broadcast = (message) => {
    players.forEach(player => player.ws.send(JSON.stringify(message)));
};

wss.on('connection', function connection(ws) {
    console.log('New player connected');

    // Handle joining the game
    ws.on('message', function incoming(message) {

        if (!message) {
            return;
        }
        const data = JSON.parse(message);

        console.log(data);
        console.log(players);

        if (data.type === 'join') {
            if (!gameStarted) {
                players.push({ id: players.length, name: data.name, ws, cards: [] });
                broadcast({ type: 'message', message: `${data.name} joined the game` });
            } else {
                ws.send(JSON.stringify({ type: 'message', message: 'Game already started. Please wait for the next game.' }));
            }
        } else if (data.type === 'start') {
            if (!gameStarted && players.length >= 4) {
                shuffleDeck();
                dealCards();
                gameStarted = true;
                broadcast({ type: 'message', message: 'Game started!' });
                broadcast({ type: 'message', message: `Player ${currentPlayerIndex + 1}'s turn` });
            } else {
                ws.send(JSON.stringify({ type: 'message', message: 'Cannot start game. Not enough players or game already started.' }));
            }
        } else if (data.type === 'playCard') {
            if (gameStarted && currentPlayerIndex === players.findIndex(player => player.ws === ws)) {
                const cardIndex = players[currentPlayerIndex].cards.findIndex(card => card.rank === data.card.rank && card.suit === data.card.suit);
                if (cardIndex !== -1) {
                    currentRound.push(players[currentPlayerIndex].cards.splice(cardIndex, 1)[0]);
                    broadcast({ type: 'playCard', playerId: currentPlayerIndex, card: data.card });
                    nextPlayer();
                }
            }
        }
    });

    ws.on('close', function close() {
        console.log('Player disconnected');
        const index = players.findIndex(player => player.ws === ws);
        if (index !== -1) {
            players.splice(index, 1);
            if (players.length === 0) {
                gameStarted = false;
                currentPlayerIndex = 0;
                currentRound = [];
                broadcast({ type: 'message', message: 'All players disconnected. Game reset.' });
            }
        }
    });
});
