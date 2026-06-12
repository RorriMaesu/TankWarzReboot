var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
export class NetworkManager {
    constructor() {
        this.client = null;
        this.queueChannel = null;
        this.gameChannel = null;
        this.activeRoomCode = '';
        this.role = 'local';
        // Callbacks registered by the game engine
        this.onMoveCallback = null;
        this.onFireCallback = null;
        this.onWindSyncCallback = null;
        this.onCrateDropCallback = null;
        this.onTurnEndCallback = null;
        this.onGameStartCallback = null;
        this.onDisconnectCallback = null;
        this.onMineSpawnCallback = null;
        this.myClientId = 'client-' + Math.random().toString(36).substring(2, 11);
    }
    init(apiKey) {
        return new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (typeof Ably === 'undefined') {
                    console.error("Ably SDK not found. Make sure the script CDN tag is loaded.");
                    resolve(false);
                    return;
                }
                let key = apiKey;
                const isSandbox = !key;
                if (isSandbox) {
                    try {
                        console.log("No API key provided. Provisioning temporary sandbox key...");
                        const res = yield fetch('https://sandbox-rest.ably.io/apps', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                keys: [{ capability: '{"*":["*"]}' }]
                            })
                        });
                        const appInfo = yield res.json();
                        key = appInfo.keys[0].keyStr;
                        console.log("Provisioned sandbox key:", key);
                        // Give Ably sandbox database a moment to propagate the temporary key
                        yield new Promise(resolve => setTimeout(resolve, 2000));
                    }
                    catch (e) {
                        console.error("Failed to provision sandbox key:", e);
                        resolve(false);
                        return;
                    }
                }
                const options = {
                    key: key,
                    clientId: this.myClientId
                };
                if (isSandbox) {
                    options.realtimeHost = 'sandbox-realtime.ably.io';
                    options.restHost = 'sandbox-rest.ably.io';
                    options.fallbackHosts = [
                        'sandbox-a-fallback.ably-realtime.com',
                        'sandbox-b-fallback.ably-realtime.com',
                        'sandbox-c-fallback.ably-realtime.com',
                        'sandbox-d-fallback.ably-realtime.com',
                        'sandbox-e-fallback.ably-realtime.com'
                    ];
                }
                this.client = new Ably.Realtime(options);
                this.client.connection.on('connected', () => {
                    console.log("Connected to Ably cloud realtime network.");
                    this.queueChannel = this.client.channels.get('tankwars-public-queue');
                    resolve(true);
                });
                this.client.connection.on('failed', (err) => {
                    console.error("Ably connection failed:", err);
                    resolve(false);
                });
            }
            catch (e) {
                console.error("Error initializing Ably:", e);
                resolve(false);
            }
        }));
    }
    // Register event handlers
    onMove(cb) { this.onMoveCallback = cb; }
    onFire(cb) { this.onFireCallback = cb; }
    onWindSync(cb) { this.onWindSyncCallback = cb; }
    onCrateDrop(cb) { this.onCrateDropCallback = cb; }
    onTurnEnd(cb) { this.onTurnEndCallback = cb; }
    onGameStart(cb) { this.onGameStartCallback = cb; }
    onDisconnect(cb) { this.onDisconnectCallback = cb; }
    onMineSpawn(cb) { this.onMineSpawnCallback = cb; }
    /**
     * Enters the public matchmaking queue and waits for an opponent.
     */
    startQuickMatch(onMatchStart) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.queueChannel)
                return;
            this.role = 'local';
            try {
                // 1. Explicitly attach to the queue channel first
                yield this.queueChannel.attach();
                // 2. Enter the public queue
                yield this.queueChannel.presence.enter({
                    status: 'waiting',
                    roomId: this.myClientId,
                    timestamp: Date.now()
                });
                // 3. Scan active players in queue (guard against undefined results)
                const members = (yield this.queueChannel.presence.get()) || [];
                // Look for other waiting players
                const waitingPlayers = members.filter((m) => { var _a; return m.clientId !== this.myClientId && ((_a = m.data) === null || _a === void 0 ? void 0 : _a.status) === 'waiting'; });
                if (waitingPlayers.length > 0) {
                    // Sort to match oldest waiting challenger (First-In, First-Out)
                    waitingPlayers.sort((a, b) => (a.data.timestamp || 0) - (b.data.timestamp || 0));
                    const targetHost = waitingPlayers[0];
                    const hostRoomId = targetHost.clientId;
                    this.activeRoomCode = hostRoomId;
                    this.role = 'guest';
                    // Join host's private channel
                    this.gameChannel = this.client.channels.get(`tankwars-room-${hostRoomId}`);
                    yield this.gameChannel.attach();
                    this.subscribeToGameChannel();
                    // Notify host that we are joining
                    yield this.gameChannel.publish('handshake', { guestId: this.myClientId });
                    // Update public status
                    yield this.queueChannel.presence.update({
                        status: 'matched',
                        roomId: hostRoomId,
                        timestamp: Date.now()
                    });
                    // Leave the queue
                    this.queueChannel.presence.leave();
                    onMatchStart('guest');
                }
                else {
                    // No one waiting, host a new room
                    this.role = 'host';
                    this.activeRoomCode = this.myClientId;
                    this.gameChannel = this.client.channels.get(`tankwars-room-${this.myClientId}`);
                    yield this.gameChannel.attach();
                    this.subscribeToGameChannel();
                    // Listen for challenge handshake
                    this.gameChannel.subscribe('handshake', (msg) => __awaiter(this, void 0, void 0, function* () {
                        console.log(`Challenger joined: ${msg.data.guestId}. Launching match!`);
                        // Remove from public queue
                        this.queueChannel.presence.leave();
                        this.gameChannel.unsubscribe('handshake');
                        // Host generates initial sync state (terrain seed and initial wind)
                        const initialWind = (Math.random() - 0.5) * 2.0;
                        const terrainSeed = Date.now();
                        yield this.gameChannel.publish('game_event', {
                            type: 'game_start',
                            data: { windX: initialWind, seed: terrainSeed }
                        });
                        if (this.onGameStartCallback) {
                            this.onGameStartCallback(initialWind, terrainSeed);
                        }
                        onMatchStart('host');
                    }));
                }
            }
            catch (err) {
                console.error("Matchmaking error:", err);
                if (this.onDisconnectCallback) {
                    this.onDisconnectCallback("Connection error during matchmaking.");
                }
            }
        });
    }
    /**
     * Hosts a private game room with a 4-letter room code
     */
    hostPrivateRoom(onGuestJoined) {
        return __awaiter(this, void 0, void 0, function* () {
            // Generate 4 letter code
            const code = Math.random().toString(36).substring(2, 6).toUpperCase();
            this.activeRoomCode = code;
            this.role = 'host';
            this.gameChannel = this.client.channels.get(`tankwars-room-${code}`);
            yield this.gameChannel.attach();
            this.subscribeToGameChannel();
            // Listen for guest handshake
            this.gameChannel.subscribe('handshake', (msg) => __awaiter(this, void 0, void 0, function* () {
                console.log(`Guest connected to private room: ${msg.data.guestId}`);
                this.gameChannel.unsubscribe('handshake');
                // Generate seed and wind
                const initialWind = (Math.random() - 0.5) * 2.0;
                const terrainSeed = Date.now();
                yield this.gameChannel.publish('game_event', {
                    type: 'game_start',
                    data: { windX: initialWind, seed: terrainSeed }
                });
                if (this.onGameStartCallback) {
                    this.onGameStartCallback(initialWind, terrainSeed);
                }
                onGuestJoined();
            }));
            return code;
        });
    }
    /**
     * Joins a private room using a 4-letter room code
     */
    joinPrivateRoom(code) {
        return __awaiter(this, void 0, void 0, function* () {
            this.activeRoomCode = code.toUpperCase();
            this.role = 'guest';
            this.gameChannel = this.client.channels.get(`tankwars-room-${this.activeRoomCode}`);
            yield this.gameChannel.attach();
            this.subscribeToGameChannel();
            // Send handshake
            yield this.gameChannel.publish('handshake', { guestId: this.myClientId });
            return true;
        });
    }
    /**
     * Sends a game event payload to the other player
     */
    sendEvent(type, data) {
        if (!this.gameChannel)
            return;
        this.gameChannel.publish('game_event', {
            type,
            data
        });
    }
    /**
     * Subscribes to events on the active private room channel
     */
    subscribeToGameChannel() {
        if (!this.gameChannel)
            return;
        this.gameChannel.subscribe('game_event', (msg) => {
            const payload = msg.data;
            if (!payload)
                return;
            switch (payload.type) {
                case 'game_start':
                    if (this.role === 'guest' && this.onGameStartCallback) {
                        this.onGameStartCallback(payload.data.windX, payload.data.seed);
                    }
                    break;
                case 'move':
                    if (this.onMoveCallback)
                        this.onMoveCallback(payload.data.x);
                    break;
                case 'fire':
                    if (this.onFireCallback) {
                        this.onFireCallback(payload.data.power, payload.data.angle, payload.data.weaponType);
                    }
                    break;
                case 'wind_sync':
                    if (this.onWindSyncCallback)
                        this.onWindSyncCallback(payload.data.windX);
                    break;
                case 'crate_drop':
                    if (this.onCrateDropCallback) {
                        this.onCrateDropCallback(payload.data.x, payload.data.crateType);
                    }
                    break;
                case 'mine_spawn':
                    if (this.onMineSpawnCallback)
                        this.onMineSpawnCallback(payload.data.x);
                    break;
                case 'turn_end':
                    if (this.onTurnEndCallback)
                        this.onTurnEndCallback();
                    break;
            }
        });
        // Detect if opponent leaves
        this.gameChannel.presence.subscribe('leave', (member) => {
            if (this.onDisconnectCallback) {
                this.onDisconnectCallback("Opponent disconnected.");
            }
        });
    }
    /**
     * Resets network state, leaves queue/channels
     */
    disconnect() {
        try {
            if (this.queueChannel) {
                this.queueChannel.presence.leave();
            }
            if (this.gameChannel) {
                this.gameChannel.unsubscribe();
                this.gameChannel.presence.leave();
            }
        }
        catch (e) {
            console.warn("Error disconnecting channels:", e);
        }
        this.gameChannel = null;
        this.activeRoomCode = '';
        this.role = 'local';
    }
}
//# sourceMappingURL=network.js.map