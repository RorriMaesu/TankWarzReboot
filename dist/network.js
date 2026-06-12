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
        this.activeRoomCode = '';
        this.role = 'local';
        this.matchingInitiated = false;
        this.matchmakingInterval = null;
        this.activeRoomTopic = '';
        this.gameStarted = false;
        // Track queue heartbeats: clientId -> { timestamp, lastSeen }
        this.activeQueues = new Map();
        this.myMatchStartTime = 0;
        this.onMatchStartCallback = null;
        this.onPrivateGuestJoinedCallback = null;
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
        return new Promise((resolve) => {
            try {
                if (typeof mqtt === 'undefined') {
                    console.error("MQTT SDK not found. Make sure the script CDN tag is loaded in index.html.");
                    resolve(false);
                    return;
                }
                if (this.client && this.client.connected) {
                    resolve(true);
                    return;
                }
                console.log("Connecting to public key-less MQTT broker...");
                // Connect to HiveMQ public broker over secure WebSockets
                this.client = mqtt.connect('wss://broker.hivemq.com:8884/mqtt', {
                    clientId: this.myClientId,
                    clean: true,
                    keepalive: 30,
                    reconnectPeriod: 1000
                });
                this.client.on('connect', () => {
                    console.log("Connected to public MQTT realtime network.");
                    resolve(true);
                });
                this.client.on('error', (err) => {
                    console.error("MQTT connection error:", err);
                    resolve(false);
                });
                this.client.on('message', (topic, message) => {
                    try {
                        const payload = JSON.parse(message.toString());
                        this.handleMqttMessage(topic, payload);
                    }
                    catch (e) {
                        // Ignore non-JSON messages
                    }
                });
            }
            catch (e) {
                console.error("Error initializing MQTT:", e);
                resolve(false);
            }
        });
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
            if (!this.client)
                return;
            this.role = 'local';
            this.matchingInitiated = false;
            this.gameStarted = false;
            this.onMatchStartCallback = onMatchStart;
            this.myMatchStartTime = Date.now();
            this.activeQueues.clear();
            const queueTopic = 'tankwarz/reboot/lobby/queue';
            this.client.subscribe(queueTopic);
            // Heartbeat loop: publish active presence and scan for matches
            this.matchmakingInterval = setInterval(() => {
                if (!this.client || this.matchingInitiated)
                    return;
                // 1. Send heartbeat
                this.client.publish(queueTopic, JSON.stringify({
                    action: 'ping',
                    clientId: this.myClientId,
                    timestamp: this.myMatchStartTime
                }));
                // 2. Prune old peers
                const now = Date.now();
                for (const [cid, info] of this.activeQueues.entries()) {
                    if (now - info.lastSeen > 2500) {
                        this.activeQueues.delete(cid);
                    }
                }
                // 3. Scan for match candidates
                const waiting = Array.from(this.activeQueues.entries()).map(([cid, info]) => ({
                    clientId: cid,
                    timestamp: info.timestamp
                }));
                // Add ourselves
                waiting.push({ clientId: this.myClientId, timestamp: this.myMatchStartTime });
                if (waiting.length < 2)
                    return;
                // Sort deterministically: oldest timestamp first, then lexicographically
                waiting.sort((a, b) => {
                    if (a.timestamp !== b.timestamp)
                        return a.timestamp - b.timestamp;
                    return a.clientId.localeCompare(b.clientId);
                });
                const host = waiting[0];
                const guest = waiting[1];
                if (host.clientId === this.myClientId) {
                    // We are the Host. Broadcast match agreement.
                    this.client.publish(queueTopic, JSON.stringify({
                        action: 'match',
                        clientId: this.myClientId,
                        hostId: host.clientId,
                        guestId: guest.clientId
                    }));
                }
            }, 1000);
        });
    }
    handleMqttMessage(topic, payload) {
        var _a, _b, _c, _d, _e, _f;
        // 1. Queue logic
        if (topic === 'tankwarz/reboot/lobby/queue') {
            if (this.matchingInitiated)
                return;
            if (payload.action === 'ping' && payload.clientId && payload.clientId !== this.myClientId) {
                this.activeQueues.set(payload.clientId, {
                    timestamp: payload.timestamp || Date.now(),
                    lastSeen: Date.now()
                });
            }
            if (payload.action === 'match' && payload.hostId && payload.guestId) {
                const amIHost = payload.hostId === this.myClientId;
                const amIGuest = payload.guestId === this.myClientId;
                if (amIHost || amIGuest) {
                    this.matchingInitiated = true;
                    clearInterval(this.matchmakingInterval);
                    this.client.unsubscribe('tankwarz/reboot/lobby/queue');
                    this.activeRoomCode = payload.hostId;
                    this.activeRoomTopic = `tankwarz/reboot/rooms/${payload.hostId}`;
                    this.client.subscribe(this.activeRoomTopic);
                    if (amIHost) {
                        this.role = 'host';
                        // Wait for guest handshake in the room topic
                    }
                    else {
                        this.role = 'guest';
                        if (this.onMatchStartCallback)
                            this.onMatchStartCallback('guest');
                        // Periodically publish handshake until game starts
                        let attempts = 0;
                        const sendHandshake = () => {
                            if (this.role !== 'guest' || !this.client || this.gameStarted)
                                return;
                            this.client.publish(this.activeRoomTopic, JSON.stringify({
                                action: 'handshake',
                                clientId: this.myClientId,
                                guestId: this.myClientId
                            }));
                            attempts++;
                            if (attempts < 10 && this.role === 'guest' && !this.gameStarted) {
                                setTimeout(sendHandshake, 1000);
                            }
                        };
                        setTimeout(sendHandshake, 300);
                    }
                }
            }
            return;
        }
        // 2. Gameplay room logic
        if (topic === this.activeRoomTopic) {
            if (payload.action === 'handshake') {
                if (this.role === 'host' && !this.gameStarted) {
                    this.gameStarted = true;
                    console.log(`Challenger joined room: ${payload.guestId}`);
                    if (this.onMatchStartCallback)
                        this.onMatchStartCallback('host');
                    if (this.onPrivateGuestJoinedCallback)
                        this.onPrivateGuestJoinedCallback();
                    // Initialize terrain/wind and broadcast start
                    const initialWind = (Math.random() - 0.5) * 2.0;
                    const terrainSeed = Date.now();
                    this.client.publish(this.activeRoomTopic, JSON.stringify({
                        action: 'game_start',
                        clientId: this.myClientId,
                        windX: initialWind,
                        seed: terrainSeed
                    }));
                    if (this.onGameStartCallback) {
                        this.onGameStartCallback(initialWind, terrainSeed);
                    }
                }
            }
            if (payload.action === 'game_start') {
                if (this.role === 'guest' && !this.gameStarted && this.onGameStartCallback) {
                    this.gameStarted = true;
                    // Confirm room role changes
                    this.onGameStartCallback((_c = (_b = (_a = payload.data) === null || _a === void 0 ? void 0 : _a.windX) !== null && _b !== void 0 ? _b : payload.windX) !== null && _c !== void 0 ? _c : 0, (_f = (_e = (_d = payload.data) === null || _d === void 0 ? void 0 : _d.seed) !== null && _e !== void 0 ? _e : payload.seed) !== null && _f !== void 0 ? _f : Date.now());
                }
            }
            if (payload.action === 'game_event') {
                if (payload.clientId === this.myClientId) {
                    return;
                }
                switch (payload.type) {
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
            }
        }
    }
    /**
     * Hosts a private game room with a 4-letter room code
     */
    hostPrivateRoom(onGuestJoined) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.client)
                return '';
            this.gameStarted = false;
            const code = Math.random().toString(36).substring(2, 6).toUpperCase();
            this.activeRoomCode = code;
            this.role = 'host';
            this.activeRoomTopic = `tankwarz/reboot/rooms/${code}`;
            this.onPrivateGuestJoinedCallback = onGuestJoined;
            this.client.subscribe(this.activeRoomTopic);
            return code;
        });
    }
    /**
     * Joins a private room using a 4-letter room code
     */
    joinPrivateRoom(code) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.client)
                return false;
            this.gameStarted = false;
            const cleanCode = code.toUpperCase();
            this.activeRoomCode = cleanCode;
            this.role = 'guest';
            this.activeRoomTopic = `tankwarz/reboot/rooms/${cleanCode}`;
            this.client.subscribe(this.activeRoomTopic);
            // Send initial handshake immediately
            setTimeout(() => {
                if (this.client) {
                    this.client.publish(this.activeRoomTopic, JSON.stringify({
                        action: 'handshake',
                        clientId: this.myClientId,
                        guestId: this.myClientId
                    }));
                }
            }, 500);
            return true;
        });
    }
    /**
     * Sends a game event payload to the other player
     */
    sendEvent(type, data) {
        if (!this.client || !this.activeRoomTopic)
            return;
        this.client.publish(this.activeRoomTopic, JSON.stringify({
            action: 'game_event',
            clientId: this.myClientId,
            type,
            data
        }));
    }
    /**
     * Resets network state, leaves queue/channels
     */
    disconnect() {
        try {
            if (this.matchmakingInterval) {
                clearInterval(this.matchmakingInterval);
                this.matchmakingInterval = null;
            }
            if (this.client) {
                this.client.unsubscribe('tankwarz/reboot/lobby/queue');
                if (this.activeRoomTopic) {
                    this.client.unsubscribe(this.activeRoomTopic);
                }
            }
        }
        catch (e) {
            console.warn("Error disconnecting MQTT topics:", e);
        }
        this.activeRoomCode = '';
        this.activeRoomTopic = '';
        this.role = 'local';
        this.matchingInitiated = false;
        this.gameStarted = false;
    }
}
//# sourceMappingURL=network.js.map