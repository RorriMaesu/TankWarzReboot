import { Vector2D, Weapon } from './types.js';
import { Terrain } from './terrain.js';

export class Player {
  public id: string;
  public type: 'player' | 'ai';
  public position: Vector2D;
  public health: number;
  public fuel: number;
  public maxHealth: number;
  public maxFuel: number;
  public weapon: Weapon;
  public aimAngle: number; // in radians
  public aimPower: number = 50;
  public recoilOffset: number = 0;
  public recoilAngle: number = 0;
  public targetX: number | null = null;

  constructor(id: string, type: 'player' | 'ai', position: Vector2D, health: number, fuel: number) {
    this.id = id;
    this.type = type;
    this.position = position;
    this.health = health;
    this.fuel = fuel;
    this.maxHealth = health;
    this.maxFuel = fuel;
    this.aimAngle = type === 'player' ? Math.PI / 4 : (3 * Math.PI) / 4;
    
    this.weapon = {
      type: 'small_cannon',
      name: 'Small Cannon',
      damage: 25,
      fuelCost: 10,
      radius: 30,
      projectileRadius: 4,
      speedMultiplier: 0.16,
      burstCount: 1,
      burstDelay: 0
    };
  }

  public takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
  }

  /**
   * Applies gravity: pulls tank down if terrain height below it decreases.
   */
  public update(terrain: Terrain): void {
    const targetY = terrain.getHeight(this.position.x);
    if (this.position.y < targetY) {
      // Fall down smoothly
      this.position.y = Math.min(targetY, this.position.y + 4);
    } else {
      // Snap to terrain height
      this.position.y = targetY;
    }
    
    // Smooth recoil decay (spring-damper style)
    this.recoilOffset = Math.max(0, this.recoilOffset - this.recoilOffset * 0.16);
    this.recoilAngle = this.recoilAngle * 0.82;
  }

  public draw(ctx: CanvasRenderingContext2D, isCurrentTurn: boolean): void {
    const width = 36;
    const height = 16;
    const x = this.position.x;
    const y = this.position.y;

    ctx.save();
    
    // Draw simple shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, width / 2, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    const mainColor = this.type === 'player' ? '#3b82f6' : '#ef4444'; // Electric blue or vibrant red
    const secondaryColor = this.type === 'player' ? '#1d4ed8' : '#b91c1c';

    // 1. Draw Wheels / Tracks (Sitting statically on the ground, does not bob)
    ctx.fillStyle = '#334155'; // Dark slate grey
    ctx.beginPath();
    ctx.roundRect(x - width / 2 - 2, y - 6, width + 4, 8, 3);
    ctx.fill();

    // Draw track wheel spoke circles with dynamic rotation
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    const wheelAngle = (Date.now() * (isCurrentTurn ? 0.05 : 0.008)) % (Math.PI * 2);

    for (let i = -2; i <= 2; i++) {
      const wheelX = x + (i * 7);
      const wheelY = y - 2;
      
      ctx.save();
      ctx.beginPath();
      ctx.arc(wheelX, wheelY, 3, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw spinning spoke lines
      ctx.translate(wheelX, wheelY);
      ctx.rotate(wheelAngle + i * 0.4);
      ctx.beginPath();
      ctx.moveTo(-3, 0);
      ctx.lineTo(3, 0);
      ctx.moveTo(0, -3);
      ctx.lineTo(0, 3);
      ctx.stroke();
      ctx.restore();
    }

    // Apply recoil translation/rotation AND suspension bobbing to chassis, cabin, and turret
    const bobY = isCurrentTurn ? Math.sin(Date.now() / 110) * 1.2 : 0;
    ctx.save();
    ctx.translate(x, y + bobY);
    ctx.rotate(this.recoilAngle);
    ctx.translate(-x, -y);

    // 2. Draw Chassis (Tank Body)
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.roundRect(x - width / 2, y - 14, width, 9, 4);
    ctx.fill();

    // Tank cabin/turret base
    ctx.fillStyle = secondaryColor;
    ctx.beginPath();
    ctx.arc(x, y - 13, 8, Math.PI, 0);
    ctx.fill();

    // 3. Draw Rotatable Turret Barrel (retracts based on recoilOffset)
    ctx.strokeStyle = '#64748b'; // Metallic grey
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y - 15);
    
    // Shorten barrel vector temporarily to simulate recoil kickback sliding
    const finalBarrelLength = Math.max(8, 22 - this.recoilOffset);
    const barrelX = x + Math.cos(this.aimAngle) * finalBarrelLength;
    const barrelY = (y - 15) - Math.sin(this.aimAngle) * finalBarrelLength;
    ctx.lineTo(barrelX, barrelY);
    ctx.stroke();

    // Muzzle brake
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(barrelX, barrelY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore(); // restore recoil and bobbing space

    // 4. Draw engine exhaust glow (bobs with chassis)
    const exhaustX = this.type === 'player' ? x - 19 : x + 19;
    const exhaustY = y - 9 + bobY;
    ctx.save();
    const exhaustColor = this.type === 'player' ? '#38bdf8' : '#f87171';
    ctx.shadowColor = exhaustColor;
    ctx.shadowBlur = 8;
    ctx.fillStyle = exhaustColor;
    ctx.beginPath();
    ctx.arc(exhaustX, exhaustY, 2.5 + Math.sin(Date.now() / 100) * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 5. Highlight current active tank with a pulsating Plasma Shield Dome
    if (isCurrentTurn) {
      ctx.save();
      const shieldGlowColor = mainColor;
      
      // Draw shield dome fill
      const shieldRadGrad = ctx.createRadialGradient(x, y - 10, 10, x, y - 10, 28);
      shieldRadGrad.addColorStop(0, 'rgba(0,0,0,0)');
      shieldRadGrad.addColorStop(0.85, this.type === 'player' ? 'rgba(59, 130, 246, 0.03)' : 'rgba(239, 68, 68, 0.03)');
      shieldRadGrad.addColorStop(1, this.type === 'player' ? 'rgba(59, 130, 246, 0.18)' : 'rgba(239, 68, 68, 0.18)');
      ctx.fillStyle = shieldRadGrad;
      ctx.beginPath();
      ctx.arc(x, y - 10, 28, 0, Math.PI * 2);
      ctx.fill();

      // Outer rotating glowing border
      ctx.strokeStyle = shieldGlowColor;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = shieldGlowColor;
      ctx.shadowBlur = 10;
      ctx.setLineDash([12, 18]);
      ctx.lineDashOffset = (Date.now() / 50) % 30; // rotating effect
      ctx.beginPath();
      ctx.arc(x, y - 10, 28, 0, Math.PI * 2);
      ctx.stroke();

      // Inner shell ring
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([4, 16]);
      ctx.lineDashOffset = -(Date.now() / 80) % 20; // reverse rotation
      ctx.beginPath();
      ctx.arc(x, y - 10, 26, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    // 6. Draw simple Health Bar above tank
    const barWidth = 40;
    const barHeight = 4;
    const barX = x - barWidth / 2;
    const barY = y - 32;

    // Red background
    ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Green progress
    const healthPct = Math.max(0, this.health / this.maxHealth);
    ctx.fillStyle = '#10b981';
    ctx.fillRect(barX, barY, barWidth * healthPct, barHeight);

    // Draw Name/Label
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 9px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(this.type === 'player' ? 'PLAYER 1' : 'OPPONENT', x, y - 37);

    ctx.restore();
  }
}