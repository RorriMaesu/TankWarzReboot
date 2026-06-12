declare const mqtt: any;

import { WeaponType } from './types.js';

export interface GameEventPayload {
  type: 'move' | 'fire' | 'aim' | 'wind_sync' | 'crate_drop' | 'turn_end' | 'game_start' | 'mine_spawn' | 'rematch_ready' | 'status_sync';
  data: any;
}

interface MqttPayload {
  action: 'ping' | 'match' | 'handshake' | 'game_start' | 'game_event';
  clientId?: string;
  timestamp?: number;
  hostId?: string;
  guestId?: string;
  type?: GameEventPayload['type'];
  data?: any;
}

export class NetworkManager {
  private client: any = null;
  public myClientId: string;
  public activeRoomCode: string = '';
  public role: 'host' | 'guest' | 'local' = 'local';
  
  private matchingInitiated: boolean = false;
  private matchmakingInterval: any = null;
  private activeRoomTopic: string = '';
  private gameStarted: boolean = false;
  
  // Track queue heartbeats: clientId -> { timestamp, lastSeen }
  private activeQueues: Map<string, { timestamp: number; lastSeen: number }> = new Map();
  private myMatchStartTime: number = 0;
  private onMatchStartCallback: ((role: 'host' | 'guest') => void) | null = null;
  private onPrivateGuestJoinedCallback: (() => void) | null = null;

  // Callbacks registered by the game engine
  private onMoveCallback: ((x: number, fuel?: number) => void) | null = null;
  private onFireCallback: ((power: number, angle: number, weaponType: WeaponType, fuel?: number) => void) | null = null;
  private onAimCallback: ((power: number, angle: number) => void) | null = null;
  private onWindSyncCallback: ((windX: number) => void) | null = null;
  private onCrateDropCallback: ((x: number, crateType: 'heal' | 'fuel' | 'nuke') => void) | null = null;
  private onTurnEndCallback: (() => void) | null = null;
  private onGameStartCallback: ((windX: number, seed: number) => void) | null = null;
  private onDisconnectCallback: ((reason: string) => void) | null = null;
  private onMineSpawnCallback: ((x: number) => void) | null = null;
  private onRematchReadyCallback: (() => void) | null = null;
  private onStatusSyncCallback: ((health: number, fuel: number, hasNuke: boolean) => void) | null = null;

  public onRematchReady(cb: () => void) { this.onRematchReadyCallback = cb; }

  constructor() {
    this.myClientId = 'client-' + Math.random().toString(36).substring(2, 11);
  }

  public init(apiKey?: string): Promise<boolean> {
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

        this.client.on('error', (err: any) => {
          console.error("MQTT connection error:", err);
          resolve(false);
        });

        this.client.on('message', (topic: string, message: any) => {
          try {
            const payload = JSON.parse(message.toString()) as MqttPayload;
            this.handleMqttMessage(topic, payload);
          } catch (e) {
            // Ignore non-JSON messages
          }
        });
      } catch (e) {
        console.error("Error initializing MQTT:", e);
        resolve(false);
      }
    });
  }

  public onMove(cb: (x: number, fuel?: number) => void) { this.onMoveCallback = cb; }
  public onFire(cb: (power: number, angle: number, weaponType: WeaponType, fuel?: number) => void) { this.onFireCallback = cb; }
  public onAim(cb: (power: number, angle: number) => void) { this.onAimCallback = cb; }
  public onWindSync(cb: (windX: number) => void) { this.onWindSyncCallback = cb; }
  public onCrateDrop(cb: (x: number, crateType: 'heal' | 'fuel' | 'nuke') => void) { this.onCrateDropCallback = cb; }
  public onTurnEnd(cb: () => void) { this.onTurnEndCallback = cb; }
  public onGameStart(cb: (windX: number, seed: number) => void) { this.onGameStartCallback = cb; }
  public onDisconnect(cb: (reason: string) => void) { this.onDisconnectCallback = cb; }
  public onMineSpawn(cb: (x: number) => void) { this.onMineSpawnCallback = cb; }
  public onStatusSync(cb: (health: number, fuel: number, hasNuke: boolean) => void) { this.onStatusSyncCallback = cb; }

  /**
   * Enters the public matchmaking queue and waits for an opponent.
   */
  public async startQuickMatch(onMatchStart: (role: 'host' | 'guest') => void): Promise<void> {
    if (!this.client) return;
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
      if (!this.client || this.matchingInitiated) return;

      // 1. Send heartbeat
      this.client.publish(queueTopic, JSON.stringify({
        action: 'ping',
        clientId: this.myClientId,
        timestamp: this.myMatchStartTime
      } as MqttPayload));

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

      if (waiting.length < 2) return;

      // Sort deterministically: oldest timestamp first, then lexicographically
      waiting.sort((a, b) => {
        if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
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
        } as MqttPayload));
      }
    }, 1000);
  }

  private handleMqttMessage(topic: string, payload: MqttPayload) {
    // 1. Queue logic
    if (topic === 'tankwarz/reboot/lobby/queue') {
      if (this.matchingInitiated) return;

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
          } else {
            this.role = 'guest';
            if (this.onMatchStartCallback) this.onMatchStartCallback('guest');
            // Periodically publish handshake until game starts
            let attempts = 0;
            const sendHandshake = () => {
              if (this.role !== 'guest' || !this.client || this.gameStarted) return;
              this.client.publish(this.activeRoomTopic, JSON.stringify({
                action: 'handshake',
                clientId: this.myClientId,
                guestId: this.myClientId
              } as MqttPayload));

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
          
          if (this.onMatchStartCallback) this.onMatchStartCallback('host');
          if (this.onPrivateGuestJoinedCallback) this.onPrivateGuestJoinedCallback();

          // Initialize terrain/wind and broadcast start
          const initialWind = (Math.random() - 0.5) * 2.0;
          const terrainSeed = Date.now();

          this.client.publish(this.activeRoomTopic, JSON.stringify({
            action: 'game_start',
            clientId: this.myClientId,
            windX: initialWind,
            seed: terrainSeed
          } as any));

          if (this.onGameStartCallback) {
            this.onGameStartCallback(initialWind, terrainSeed);
          }
        }
      }

      if (payload.action === 'game_start') {
        if (this.role === 'guest' && !this.gameStarted && this.onGameStartCallback) {
          this.gameStarted = true;
          // Confirm room role changes
          this.onGameStartCallback(payload.data?.windX ?? (payload as any).windX ?? 0, payload.data?.seed ?? (payload as any).seed ?? Date.now());
        }
      }

      if (payload.action === 'game_event') {
        if (payload.clientId === this.myClientId) {
          return;
        }
        switch (payload.type) {
          case 'move':
            if (this.onMoveCallback) this.onMoveCallback(payload.data.x, payload.data.fuel);
            break;
          case 'fire':
            if (this.onFireCallback) {
              this.onFireCallback(payload.data.power, payload.data.angle, payload.data.weaponType, payload.data.fuel);
            }
            break;
          case 'aim':
            if (this.onAimCallback) {
              this.onAimCallback(payload.data.power, payload.data.angle);
            }
            break;
          case 'wind_sync':
            if (this.onWindSyncCallback) this.onWindSyncCallback(payload.data.windX);
            break;
          case 'crate_drop':
            if (this.onCrateDropCallback) {
              this.onCrateDropCallback(payload.data.x, payload.data.crateType);
            }
            break;
          case 'mine_spawn':
            if (this.onMineSpawnCallback) this.onMineSpawnCallback(payload.data.x);
            break;
          case 'turn_end':
            if (this.onTurnEndCallback) this.onTurnEndCallback();
            break;
          case 'rematch_ready':
            if (this.onRematchReadyCallback) this.onRematchReadyCallback();
            break;
          case 'status_sync':
            if (this.onStatusSyncCallback) {
              this.onStatusSyncCallback(payload.data.health, payload.data.fuel, payload.data.hasNuke);
            }
            break;
        }
      }
    }
  }

  /**
   * Hosts a private game room with a 4-letter room code
   */
  public async hostPrivateRoom(onGuestJoined: () => void): Promise<string> {
    if (!this.client) return '';
    this.gameStarted = false;
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.activeRoomCode = code;
    this.role = 'host';
    this.activeRoomTopic = `tankwarz/reboot/rooms/${code}`;
    this.onPrivateGuestJoinedCallback = onGuestJoined;

    this.client.subscribe(this.activeRoomTopic);
    return code;
  }

  /**
   * Joins a private room using a 4-letter room code
   */
  public async joinPrivateRoom(code: string): Promise<boolean> {
    if (!this.client) return false;
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
        } as MqttPayload));
      }
    }, 500);

    return true;
  }

  /**
   * Sends a game event payload to the other player
   */
  public sendEvent(type: GameEventPayload['type'], data: any) {
    if (!this.client || !this.activeRoomTopic) return;
    
    this.client.publish(this.activeRoomTopic, JSON.stringify({
      action: 'game_event',
      clientId: this.myClientId,
      type,
      data
    } as MqttPayload));
  }

  public resetForRematch() {
    this.gameStarted = false;
  }

  public startRematch(windX: number, seed: number) {
    if (!this.client || !this.activeRoomTopic) return;
    this.gameStarted = true;
    this.client.publish(this.activeRoomTopic, JSON.stringify({
      action: 'game_start',
      clientId: this.myClientId,
      windX,
      seed
    } as any));
  }

  /**
   * Resets network state, leaves queue/channels
   */
  public disconnect() {
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
    } catch (e) {
      console.warn("Error disconnecting MQTT topics:", e);
    }
    this.activeRoomCode = '';
    this.activeRoomTopic = '';
    this.role = 'local';
    this.matchingInitiated = false;
    this.gameStarted = false;
  }
}
