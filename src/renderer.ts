import { GameConfig } from './types.js';
import { Terrain } from './terrain.js';
import { Player } from './player.js';
import { Projectile } from './projectile.js';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private config: GameConfig;

  constructor(canvasId: string, config: GameConfig) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = canvas.getContext('2d')!;
    this.config = config;
  }

  public getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  public clear() {
    this.ctx.clearRect(0, 0, this.config.canvasWidth, this.config.canvasHeight);
  }

  public drawTerrain(terrain: Terrain, turnsElapsed: number = 0) {
    terrain.draw(this.ctx, turnsElapsed);
  }

  public drawPlayers(players: Player[], activePlayerType: 'player' | 'ai') {
    players.forEach(player => {
      player.draw(this.ctx, player.type === activePlayerType);
    });
  }

  public drawProjectiles(projectiles: Projectile[]) {
    projectiles.forEach(p => {
      p.draw(this.ctx);
    });
  }
}