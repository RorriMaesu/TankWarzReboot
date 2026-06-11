declare const Ably: any;

import { Vector2D, WeaponType } from './types.js';

export interface GameEventPayload {
  type: 'move' | 'fire' | 'wind_sync' | 'crate_drop' | 'turn_end' | 'game_start';
  data: any;
}

export class NetworkManager {
  private client: any = null;
  private queueChannel: any = null;
  private gameChannel: any = null;
  public myClientId: string;
  public activeRoomCode: string = '';
  public role: 'host' | 'guest' | 'local' = 'local';
  
  // Callbacks registered by the game engine
  private onMoveCallback: ((x: number) => void) | null = null;
  private onFireCallback: ((power: number, angle: number, weaponType: WeaponType) => void) | null = null;
  private onWindSyncCallback: ((windX: number) => void) | null = null;
  private onCrateDropCallback: ((x: number, crateType: 'heal' | 'fuel' | 'nuke') => void) | null = null;
  private onTurnEndCallback: (() => void) | null = null;
  private onGameStartCallback: ((windX: number, seed: number) => void) | null = null;
  private onDisconnectCallback: ((reason: string) => void) | null = null;

  constructor() {
    this.myClientId = 'client-' + Math.random().toString(36).substring(2, 11);
  }

  public init(apiKey?: string): Promise<boolean> {
    return new Promise(async (resolve) => {
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
            const res = await fetch('https://sandbox-rest.ably.io/apps', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                keys: [{ capability: '{"*":["*"]}' }]
              })
            });
            const appInfo = await res.json();
            key = appInfo.keys[0].keyStr;
            console.log("Provisioned sandbox key:", key);
          } catch (e) {
            console.error("Failed to provision sandbox key:", e);
            resolve(false);
            return;
          }
        }

        this.client = new Ably.Realtime({
          key: key,
          clientId: this.myClientId,
          environment: isSandbox ? 'sandbox' : undefined
        });

        this.client.connection.on('connected', () => {
          console.log("Connected to Ably cloud realtime network.");
          this.queueChannel = this.client.channels.get('tankwars-public-queue');
          resolve(true);
        });

        this.client.connection.on('failed', (err: any) => {
          console.error("Ably connection failed:", err);
          resolve(false);
        });
      } catch (e) {
        console.error("Error initializing Ably:", e);
        resolve(false);
      }
    });
  }

  // Register event handlers
  public onMove(cb: (x: number) => void) { this.onMoveCallback = cb; }
  public onFire(cb: (power: number, angle: number, weaponType: WeaponType) => void) { this.onFireCallback = cb; }
  public onWindSync(cb: (windX: number) => void) { this.onWindSyncCallback = cb; }
  public onCrateDrop(cb: (x: number, crateType: 'heal' | 'fuel' | 'nuke') => void) { this.onCrateDropCallback = cb; }
  public onTurnEnd(cb: () => void) { this.onTurnEndCallback = cb; }
  public onGameStart(cb: (windX: number, seed: number) => void) { this.onGameStartCallback = cb; }
  public onDisconnect(cb: (reason: string) => void) { this.onDisconnectCallback = cb; }

  /**
   * Enters the public matchmaking queue and waits for an opponent.
   */
  public async startQuickMatch(onMatchStart: (role: 'host' | 'guest') => void): Promise<void> {
    if (!this.queueChannel) return;
    this.role = 'local';

    // 1. Enter the public queue
    await this.queueChannel.presence.enter({
      status: 'waiting',
      roomId: this.myClientId,
      timestamp: Date.now()
    });

    // 2. Scan active players in queue
    const members = await this.queueChannel.presence.get();
    
    // Look for other waiting players
    const waitingPlayers = members.filter(
      (m: any) => m.clientId !== this.myClientId && m.data?.status === 'waiting'
    );

    if (waitingPlayers.length > 0) {
      // Sort to match oldest waiting challenger (First-In, First-Out)
      waitingPlayers.sort((a: any, b: any) => (a.data.timestamp || 0) - (b.data.timestamp || 0));
      const targetHost = waitingPlayers[0];
      const hostRoomId = targetHost.clientId;

      this.activeRoomCode = hostRoomId;
      this.role = 'guest';

      // Join host's private channel
      this.gameChannel = this.client.channels.get(`tankwars-room-${hostRoomId}`);
      this.subscribeToGameChannel();

      // Notify host that we are joining
      await this.gameChannel.publish('handshake', { guestId: this.myClientId });
      
      // Update public status
      await this.queueChannel.presence.update({
        status: 'matched',
        roomId: hostRoomId,
        timestamp: Date.now()
      });

      // Leave the queue
      this.queueChannel.presence.leave();
      onMatchStart('guest');
    } else {
      // No one waiting, host a new room
      this.role = 'host';
      this.activeRoomCode = this.myClientId;

      this.gameChannel = this.client.channels.get(`tankwars-room-${this.myClientId}`);
      this.subscribeToGameChannel();

      // Listen for challenge handshake
      this.gameChannel.subscribe('handshake', async (msg: any) => {
        console.log(`Challenger joined: ${msg.data.guestId}. Launching match!`);
        
        // Remove from public queue
        this.queueChannel.presence.leave();
        this.gameChannel.unsubscribe('handshake');

        // Host generates initial sync state (terrain seed and initial wind)
        const initialWind = (Math.random() - 0.5) * 2.0;
        const terrainSeed = Date.now();

        await this.gameChannel.publish('game_event', {
          type: 'game_start',
          data: { windX: initialWind, seed: terrainSeed }
        } as GameEventPayload);

        if (this.onGameStartCallback) {
          this.onGameStartCallback(initialWind, terrainSeed);
        }
        onMatchStart('host');
      });
    }
  }

  /**
   * Hosts a private game room with a 4-letter room code
   */
  public async hostPrivateRoom(onGuestJoined: () => void): Promise<string> {
    // Generate 4 letter code
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.activeRoomCode = code;
    this.role = 'host';

    this.gameChannel = this.client.channels.get(`tankwars-room-${code}`);
    this.subscribeToGameChannel();

    // Listen for guest handshake
    this.gameChannel.subscribe('handshake', async (msg: any) => {
      console.log(`Guest connected to private room: ${msg.data.guestId}`);
      this.gameChannel.unsubscribe('handshake');

      // Generate seed and wind
      const initialWind = (Math.random() - 0.5) * 2.0;
      const terrainSeed = Date.now();

      await this.gameChannel.publish('game_event', {
        type: 'game_start',
        data: { windX: initialWind, seed: terrainSeed }
      } as GameEventPayload);

      if (this.onGameStartCallback) {
        this.onGameStartCallback(initialWind, terrainSeed);
      }
      onGuestJoined();
    });

    return code;
  }

  /**
   * Joins a private room using a 4-letter room code
   */
  public async joinPrivateRoom(code: string): Promise<boolean> {
    this.activeRoomCode = code.toUpperCase();
    this.role = 'guest';

    this.gameChannel = this.client.channels.get(`tankwars-room-${this.activeRoomCode}`);
    this.subscribeToGameChannel();

    // Send handshake
    await this.gameChannel.publish('handshake', { guestId: this.myClientId });
    return true;
  }

  /**
   * Sends a game event payload to the other player
   */
  public sendEvent(type: GameEventPayload['type'], data: any) {
    if (!this.gameChannel) return;
    
    this.gameChannel.publish('game_event', {
      type,
      data
    } as GameEventPayload);
  }

  /**
   * Subscribes to events on the active private room channel
   */
  private subscribeToGameChannel() {
    if (!this.gameChannel) return;

    this.gameChannel.subscribe('game_event', (msg: any) => {
      const payload = msg.data as GameEventPayload;
      if (!payload) return;

      switch (payload.type) {
        case 'game_start':
          if (this.role === 'guest' && this.onGameStartCallback) {
            this.onGameStartCallback(payload.data.windX, payload.data.seed);
          }
          break;
        case 'move':
          if (this.onMoveCallback) this.onMoveCallback(payload.data.x);
          break;
        case 'fire':
          if (this.onFireCallback) {
            this.onFireCallback(payload.data.power, payload.data.angle, payload.data.weaponType);
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
        case 'turn_end':
          if (this.onTurnEndCallback) this.onTurnEndCallback();
          break;
      }
    });

    // Detect if opponent leaves
    this.gameChannel.presence.subscribe('leave', (member: any) => {
      if (this.onDisconnectCallback) {
        this.onDisconnectCallback("Opponent disconnected.");
      }
    });
  }

  /**
   * Resets network state, leaves queue/channels
   */
  public disconnect() {
    try {
      if (this.queueChannel) {
        this.queueChannel.presence.leave();
      }
      if (this.gameChannel) {
        this.gameChannel.unsubscribe();
        this.gameChannel.presence.leave();
      }
    } catch (e) {
      console.warn("Error disconnecting channels:", e);
    }
    this.gameChannel = null;
    this.activeRoomCode = '';
    this.role = 'local';
  }
}
