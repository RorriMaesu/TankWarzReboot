import { Vector2D, Weapon } from './types.js';
import { Terrain } from './terrain.js';

export class Player {
  private static assetsLoaded: boolean = false;
  private static blueChassisCanvas: HTMLCanvasElement | null = null;
  private static orangeChassisCanvas: HTMLCanvasElement | null = null;
  private static blueTurretCanvas: HTMLCanvasElement | null = null;
  private static orangeTurretCanvas: HTMLCanvasElement | null = null;

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
  public targetAimAngle: number | null = null;
  public targetAimPower: number | null = null;
  public groundSlopeAngle: number = 0;
  private lastX: number | null = null;
  private wheelAngle: number = 0;

  private static trimCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    let minX = width, maxX = 0, minY = height, maxY = 0;
    let hasPixels = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const alpha = data[idx + 3];
        if (alpha > 0) {
          hasPixels = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!hasPixels) return canvas;

    const trimWidth = maxX - minX + 1;
    const trimHeight = maxY - minY + 1;

    const trimmedCanvas = document.createElement('canvas');
    trimmedCanvas.width = trimWidth;
    trimmedCanvas.height = trimHeight;
    const trimmedCtx = trimmedCanvas.getContext('2d');
    if (trimmedCtx) {
      trimmedCtx.drawImage(canvas, minX, minY, trimWidth, trimHeight, 0, 0, trimWidth, trimHeight);
    }
    return trimmedCanvas;
  }

  private static loadAndChromaKey(src: string): Promise<HTMLCanvasElement> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        console.log(`Player: Sprite asset loaded successfully: ${src} (${img.width}x${img.height})`);
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
        }
        const trimmed = Player.trimCanvas(canvas);
        resolve(trimmed);
      };
      img.onerror = (e) => {
        console.error(`Player: Failed to load sprite asset from ${src}`, e);
        const canvas = document.createElement('canvas');
        resolve(canvas);
      };
      img.src = src;
    });
  }

  public static loadAssets(): void {
    if (Player.assetsLoaded) return;
    Player.assetsLoaded = true;
    Player.loadAndChromaKey('assets/chassis_blue.png?v=1.2.2').then(canvas => {
      Player.blueChassisCanvas = canvas;
    });
    Player.loadAndChromaKey('assets/chassis_orange.png?v=1.2.2').then(canvas => {
      Player.orangeChassisCanvas = canvas;
    });
    Player.loadAndChromaKey('assets/turret_blue.png?v=1.2.2').then(canvas => {
      Player.blueTurretCanvas = canvas;
    });
    Player.loadAndChromaKey('assets/turret_orange.png?v=1.2.2').then(canvas => {
      Player.orangeTurretCanvas = canvas;
    });
  }

  constructor(id: string, type: 'player' | 'ai', position: Vector2D, health: number, fuel: number) {
    if (!Player.assetsLoaded) {
      Player.loadAssets();
    }
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

  public getBarrelTip(): Vector2D {
    // 50 is resting barrel length, 28 is turret joint height offset relative to ground position
    // We rotate this offset vector by groundSlopeAngle to match the visual rendering rotation.
    const baseAngle = -this.aimAngle; // aimAngle goes up (negative y), rendering rotate uses -aimAngle.
    
    // Barrel tip offset vector relative to the joint center (0, 0)
    const barrelLength = Math.max(20, 50 - this.recoilOffset);
    const localBarrelX = Math.cos(baseAngle) * barrelLength;
    const localBarrelY = Math.sin(baseAngle) * barrelLength;
    
    // Total tank-local coordinates of the barrel tip (relative to ground origin (0,0))
    const tankLocalX = localBarrelX;
    const tankLocalY = -28 + localBarrelY; // Joint is at (0, -28) relative to ground

    // Apply ground slope rotation to the tankLocal vector
    const cosS = Math.cos(this.groundSlopeAngle);
    const sinS = Math.sin(this.groundSlopeAngle);
    
    const rotatedTipX = tankLocalX * cosS - tankLocalY * sinS;
    const rotatedTipY = tankLocalX * sinS + tankLocalY * cosS;

    return {
      x: this.position.x + rotatedTipX,
      y: this.position.y + rotatedTipY
    };
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

    // Calculate ground slope by sampling left and right wheel positions
    const sampleOffset = 20; // 20px left and right of tank center
    const leftY = terrain.getHeight(this.position.x - sampleOffset);
    const rightY = terrain.getHeight(this.position.x + sampleOffset);
    
    // slope angle = atan2(dy, dx)
    const rawSlope = Math.atan2(rightY - leftY, sampleOffset * 2);
    // Interpolate groundSlopeAngle smoothly to prevent jittering over jagged edges
    this.groundSlopeAngle += (rawSlope - this.groundSlopeAngle) * 0.15;
    
    // Smooth recoil decay (spring-damper style)
    this.recoilOffset = Math.max(0, this.recoilOffset - this.recoilOffset * 0.16);
    this.recoilAngle = this.recoilAngle * 0.82;

    // Smoothly interpolate aim adjustments received from the network
    if (this.targetAimAngle !== null) {
      const da = this.targetAimAngle - this.aimAngle;
      const shortestDa = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(shortestDa) > 0.002) {
        this.aimAngle += shortestDa * 0.22; // glide 22% of distance per frame
      } else {
        this.aimAngle = this.targetAimAngle;
        this.targetAimAngle = null;
      }
    }
    if (this.targetAimPower !== null) {
      const dp = this.targetAimPower - this.aimPower;
      if (Math.abs(dp) > 0.3) {
        this.aimPower += dp * 0.22;
      } else {
        this.aimPower = this.targetAimPower;
        this.targetAimPower = null;
      }
    }
  }

  public draw(ctx: CanvasRenderingContext2D, isCurrentTurn: boolean): void {
    // Proportions: Tracks are scaled up (width 68, height 9), Chassis is doubled in size (width 80, height 32)
    const trackWidth = 68; // Balanced with 80px body width
    const bodyWidth = 80;
    const x = this.position.x;
    const y = this.position.y;

    ctx.save();

    const mainColor = this.type === 'player' ? '#3b82f6' : '#ef4444'; // Electric blue or vibrant red
    const secondaryColor = this.type === 'player' ? '#1d4ed8' : '#b91c1c';

    // Apply slope translation/rotation & recoil translation/rotation
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.groundSlopeAngle); // Rotate to align with terrain slope
    ctx.rotate(this.recoilAngle);      // Rotate for shot recoil kick
    ctx.translate(-x, -y);

    // 1. Draw Chassis (Tank Body - Sitting flush at y-32 to y)
    const chassisImg = this.type === 'player' ? Player.blueChassisCanvas : Player.orangeChassisCanvas;
    if (chassisImg && chassisImg.width > 0) {
      ctx.save();
      // Player 1 (blue) is facing left in the raw image, so we flip it horizontally to face right.
      // AI/Opponent (orange) faces right in the raw image, but we flip it to face left.
      if (this.type === 'player') {
        ctx.translate(x, y - 16);
        ctx.scale(-1, 1);
        ctx.drawImage(chassisImg, -bodyWidth / 2, -16, bodyWidth, 32);
      } else {
        ctx.translate(x, y - 16);
        ctx.drawImage(chassisImg, -bodyWidth / 2, -16, bodyWidth, 32);
      }
      ctx.restore();
    } else {
      ctx.fillStyle = mainColor;
      ctx.beginPath();
      ctx.roundRect(x - bodyWidth / 2, y - 31, bodyWidth, 22, 6);
      ctx.fill();

      // Tank cabin/turret base
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.arc(x, y - 28, 18, Math.PI, 0);
      ctx.fill();
    }

    // 2. Draw Wheels / Tracks on top of Chassis bottom to cover static treads in the image
    // Sized down slightly (width: 68px, height: 9px) to fit snuggly under the 80px chassis
    ctx.fillStyle = '#334155'; // Dark slate grey
    ctx.beginPath();
    ctx.roundRect(x - trackWidth / 2, y - 11, trackWidth, 9, 3);
    ctx.fill();

    // Draw track wheel spoke circles with dynamic rotation only when moving
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;

    if (this.lastX !== null && Math.abs(x - this.lastX) > 0.01) {
      const direction = x > this.lastX ? 1 : -1;
      this.wheelAngle = (this.wheelAngle + direction * 0.15) % (Math.PI * 2);
    }
    this.lastX = x;

    for (let i = -2; i <= 2; i++) {
      const wheelX = x + (i * 13); // Distributed across the tighter track width
      const wheelY = y - 6.5; // Raised slightly to sit centered inside the 9px tall track
      const r = 3.2; // Slightly smaller wheel radius (from 4.5 to 3.2)
      
      ctx.save();
      ctx.beginPath();
      ctx.arc(wheelX, wheelY, r, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw spinning spoke lines
      ctx.translate(wheelX, wheelY);
      ctx.rotate(this.wheelAngle + i * 0.4);
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.lineTo(r, 0);
      ctx.moveTo(0, -r);
      ctx.lineTo(0, r);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Draw Rotatable Turret Barrel (Pivoted around turret well at y-28)
    const turretImg = this.type === 'player' ? Player.blueTurretCanvas : Player.orangeTurretCanvas;
    if (turretImg && turretImg.width > 0) {
      ctx.save();
      // Translate to the turret rotation joint position (centered on chassis, y-28)
      ctx.translate(x, y - 28);
      // Rotate by the aim angle.
      ctx.rotate(-this.aimAngle);
      
      const finalBarrelLength = Math.max(20, 50 - this.recoilOffset);
      // Draw the gun barrel (scaled thickness: 20px to match massive body)
      ctx.drawImage(turretImg, 0, -10, finalBarrelLength, 20);
      ctx.restore();
    } else {
      ctx.strokeStyle = '#64748b'; // Metallic grey
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y - 30);
      
      const finalBarrelLength = Math.max(20, 50 - this.recoilOffset);
      const barrelX = x + Math.cos(this.aimAngle) * finalBarrelLength;
      const barrelY = (y - 30) - Math.sin(this.aimAngle) * finalBarrelLength;
      ctx.lineTo(barrelX, barrelY);
      ctx.stroke();

      // Muzzle brake
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(barrelX, barrelY, 9, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore(); // restore recoil space

    // 4. Draw engine exhaust glow (Sitting statically on chassis, y-18)
    const exhaustX = this.type === 'player' ? x - 41 : x + 41;
    const exhaustY = y - 18;
    ctx.save();
    const exhaustColor = this.type === 'player' ? '#38bdf8' : '#f87171';
    ctx.shadowColor = exhaustColor;
    ctx.shadowBlur = 8;
    ctx.fillStyle = exhaustColor;
    ctx.beginPath();
    ctx.arc(exhaustX, exhaustY, 2.5 + Math.sin(Date.now() / 100) * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 5. Highlight current active tank with a pulsating Plasma Shield Dome (Centered at y-18)
    if (isCurrentTurn) {
      ctx.save();
      const shieldGlowColor = mainColor;
      
      // Draw shield dome fill
      const shieldRadGrad = ctx.createRadialGradient(x, y - 18, 10, x, y - 18, 58);
      shieldRadGrad.addColorStop(0, 'rgba(0,0,0,0)');
      shieldRadGrad.addColorStop(0.85, this.type === 'player' ? 'rgba(59, 130, 246, 0.03)' : 'rgba(239, 68, 68, 0.03)');
      shieldRadGrad.addColorStop(1, this.type === 'player' ? 'rgba(59, 130, 246, 0.18)' : 'rgba(239, 68, 68, 0.18)');
      ctx.fillStyle = shieldRadGrad;
      ctx.beginPath();
      ctx.arc(x, y - 18, 58, 0, Math.PI * 2);
      ctx.fill();

      // Outer rotating glowing border
      ctx.strokeStyle = shieldGlowColor;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = shieldGlowColor;
      ctx.shadowBlur = 10;
      ctx.setLineDash([12, 18]);
      ctx.lineDashOffset = (Date.now() / 50) % 30; // rotating effect
      ctx.beginPath();
      ctx.arc(x, y - 18, 58, 0, Math.PI * 2);
      ctx.stroke();

      // Inner shell ring
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([4, 16]);
      ctx.lineDashOffset = -(Date.now() / 80) % 20; // reverse rotation
      ctx.beginPath();
      ctx.arc(x, y - 18, 54, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    // 6. Draw simple Health Bar above tank (raised for height)
    const barWidth = 66;
    const barHeight = 5;
    const barX = x - barWidth / 2;
    const barY = y - 54;

    // Red background
    ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Green progress
    const healthPct = Math.max(0, this.health / this.maxHealth);
    ctx.fillStyle = '#10b981';
    ctx.fillRect(barX, barY, barWidth * healthPct, barHeight);

    // Draw Name/Label (raised for height)
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 9.5px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(this.type === 'player' ? 'PLAYER 1' : 'OPPONENT', x, y - 61);

    ctx.restore();
  }
}