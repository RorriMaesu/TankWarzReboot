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
        this.matchingInitiated = false;
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
                let isSandbox = !key;
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
                // Re-evaluate sandbox flag based on the actual key
                const isSandboxKey = key && key.includes('_tmp_');
                console.log(isSandboxKey
                    ? "Connecting in Isolated Sandbox Mode (Local Tabs Only)"
                    : "Connecting in Cloud Crossplay Mode (Custom API Key)");
                const options = {
                    key: key,
                    clientId: this.myClientId
                };
                if (isSandboxKey) {
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
            this.matchingInitiated = false;
            try {
                // 1. Explicitly attach to the queue channel first
                yield this.queueChannel.attach();
                // 2. Subscribe to presence events to scan for matches dynamically
                this.queueChannel.presence.subscribe(() => {
                    this.checkForMatch(onMatchStart);
                });
                // 3. Enter the public queue
                yield this.queueChannel.presence.enter({
                    status: 'waiting',
                    roomId: this.myClientId,
                    timestamp: Date.now()
                });
                // 4. Run initial scan immediately
                yield this.checkForMatch(onMatchStart);
            }
            catch (err) {
                console.error("Matchmaking error:", err);
                if (this.onDisconnectCallback) {
                    this.onDisconnectCallback("Connection error during matchmaking.");
                }
            }
        });
    }
    checkForMatch(onMatchStart) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.matchingInitiated || !this.queueChannel)
                return;
            try {
                const members = (yield this.queueChannel.presence.get()) || [];
                // Filter players who are actively waiting
                const waiting = members.filter((m) => { var _a; return ((_a = m.data) === null || _a === void 0 ? void 0 : _a.status) === 'waiting'; });
                if (waiting.length < 2)
                    return; // Need at least 2 players to match
                // Sort deterministically: by timestamp first, then by clientId
                waiting.sort((a, b) => {
                    var _a, _b;
                    const timeA = ((_a = a.data) === null || _a === void 0 ? void 0 : _a.timestamp) || 0;
                    const timeB = ((_b = b.data) === null || _b === void 0 ? void 0 : _b.timestamp) || 0;
                    if (timeA !== timeB)
                        return timeA - timeB;
                    return a.clientId.localeCompare(b.clientId);
                });
                const hostMember = waiting[0];
                const guestMember = waiting[1];
                const amIHost = hostMember.clientId === this.myClientId;
                const amIGuest = guestMember.clientId === this.myClientId;
                if (!amIHost && !amIGuest)
                    return; // Not in the active match pair
                this.matchingInitiated = true;
                this.queueChannel.presence.unsubscribe();
                if (amIHost) {
                    this.role = 'host';
                    this.activeRoomCode = this.myClientId;
                    this.gameChannel = this.client.channels.get(`tankwars-room-${this.myClientId}`);
                    yield this.gameChannel.attach();
                    this.subscribeToGameChannel();
                    this.gameChannel.subscribe('handshake', (msg) => __awaiter(this, void 0, void 0, function* () {
                        console.log(`Challenger joined: ${msg.data.guestId}. Launching match!`);
                        this.gameChannel.unsubscribe('handshake');
                        this.queueChannel.presence.leave();
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
                else {
                    const hostRoomId = hostMember.clientId;
                    this.activeRoomCode = hostRoomId;
                    this.role = 'guest';
                    this.gameChannel = this.client.channels.get(`tankwars-room-${hostRoomId}`);
                    yield this.gameChannel.attach();
                    this.subscribeToGameChannel();
                    yield this.queueChannel.presence.update({
                        status: 'matched',
                        roomId: hostRoomId,
                        timestamp: Date.now()
                    });
                    this.queueChannel.presence.leave();
                    let attempts = 0;
                    const sendHandshake = () => __awaiter(this, void 0, void 0, function* () {
                        if (this.role !== 'guest' || !this.gameChannel)
                            return;
                        try {
                            yield this.gameChannel.publish('handshake', { guestId: this.myClientId });
                            onMatchStart('guest');
                        }
                        catch (e) {
                            if (attempts++ < 5) {
                                setTimeout(sendHandshake, 1000);
                            }
                        }
                    });
                    setTimeout(sendHandshake, 500);
                }
            }
            catch (err) {
                console.error("Match check error:", err);
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
                this.queueChannel.presence.unsubscribe();
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
        this.matchingInitiated = false;
    }
}
//# sourceMappingURL=network.js.map