/**
 * Basic 2D Vector class for physics and positioning.
 */
export interface Vector2D {
  x: number;
  y: number;
}

export interface Projectile {
  id: string;
  owner: 'player' | 'ai';
  position: Vector2D;
  velocity: Vector2D;
  damage: number;
  radius: number;
  isActive: boolean;
}

export type WeaponType = 'small_cannon' | 'heavy_mortar' | 'rapid_fire' | 'dirt_spreader' | 'nuke' | 'cluster_bomb' | 'bouncing_grenade';

export interface Crate {
  id: string;
  position: Vector2D;
  velocity: Vector2D;
  type: 'heal' | 'fuel' | 'nuke';
  isActive: boolean;
}

export interface Mine {
  position: Vector2D;
  isActive: boolean;
}

export interface Weapon {
  type: WeaponType;
  name: string;
  damage: number;
  fuelCost: number;
  radius: number; // Explosion radius
  projectileRadius: number;
  speedMultiplier: number;
  burstCount: number; // Number of shots in a burst
  burstDelay: number; // Delay in ms between burst shots
}

export interface Entity {
  id: string;
  type: 'player' | 'ai';
  position: Vector2D;
  health: number;
  fuel: number;
  maxHealth: number;
  maxFuel: number;
  weapon: Weapon;
}

export type GameState = 'PLAYER_TURN' | 'PROJECTILE_FLIGHT' | 'ENEMY_TURN' | 'GAME_OVER';

export interface GameConfig {
  canvasWidth: number;
  canvasHeight: number;
  gravity: number;
  wind: Vector2D;
}

export interface Shot {
  power: number;
  angle: number; // In radians
  weaponType: WeaponType;
}