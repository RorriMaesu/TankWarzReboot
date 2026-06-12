export class Player {
    static trimCanvas(canvas) {
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return canvas;
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
                    if (x < minX)
                        minX = x;
                    if (x > maxX)
                        maxX = x;
                    if (y < minY)
                        minY = y;
                    if (y > maxY)
                        maxY = y;
                }
            }
        }
        if (!hasPixels)
            return canvas;
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
    static loadAndChromaKey(src) {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0);
                    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imgData.data;
                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];
                        // Key out solid black background from generated sprite sheets
                        if (r < 20 && g < 20 && b < 20) {
                            data[i + 3] = 0; // Transparent
                        }
                    }
                    ctx.putImageData(imgData, 0, 0);
                }
                const trimmed = Player.trimCanvas(canvas);
                resolve(trimmed);
            };
            img.onerror = () => {
                const canvas = document.createElement('canvas');
                resolve(canvas);
            };
        });
    }
    static loadAssets() {
        if (Player.assetsLoaded)
            return;
        Player.assetsLoaded = true;
        Player.loadAndChromaKey('assets/chassis_blue.png').then(canvas => {
            Player.blueChassisCanvas = canvas;
        });
        Player.loadAndChromaKey('assets/chassis_orange.png').then(canvas => {
            Player.orangeChassisCanvas = canvas;
        });
        Player.loadAndChromaKey('assets/turret_blue.png').then(canvas => {
            Player.blueTurretCanvas = canvas;
        });
        Player.loadAndChromaKey('assets/turret_orange.png').then(canvas => {
            Player.orangeTurretCanvas = canvas;
        });
    }
    constructor(id, type, position, health, fuel) {
        this.aimPower = 50;
        this.recoilOffset = 0;
        this.recoilAngle = 0;
        this.targetX = null;
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
    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);
    }
    /**
     * Applies gravity: pulls tank down if terrain height below it decreases.
     */
    update(terrain) {
        const targetY = terrain.getHeight(this.position.x);
        if (this.position.y < targetY) {
            // Fall down smoothly
            this.position.y = Math.min(targetY, this.position.y + 4);
        }
        else {
            // Snap to terrain height
            this.position.y = targetY;
        }
        // Smooth recoil decay (spring-damper style)
        this.recoilOffset = Math.max(0, this.recoilOffset - this.recoilOffset * 0.16);
        this.recoilAngle = this.recoilAngle * 0.82;
    }
    draw(ctx, isCurrentTurn) {
        // Proportions: Tracks are reverted to full size (width 45, height 9), Chassis is doubled in size (width 80, height 32)
        const trackWidth = 45;
        const bodyWidth = 80; // Doubled size from original 36 (with extra padding for chunkiness)
        const x = this.position.x;
        const y = this.position.y;
        ctx.save();
        // Draw simple shadow (scaled to body width)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(x, y + 2, bodyWidth / 2, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        const mainColor = this.type === 'player' ? '#3b82f6' : '#ef4444'; // Electric blue or vibrant red
        const secondaryColor = this.type === 'player' ? '#1d4ed8' : '#b91c1c';
        // 1. Draw Wheels / Tracks (Reverted to full size)
        ctx.fillStyle = '#334155'; // Dark slate grey
        ctx.beginPath();
        ctx.roundRect(x - trackWidth / 2 - 2, y - 7, trackWidth + 4, 9, 3);
        ctx.fill();
        // Draw track wheel spoke circles with dynamic rotation
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1;
        const wheelAngle = (Date.now() * (isCurrentTurn ? 0.05 : 0.008)) % (Math.PI * 2);
        for (let i = -2; i <= 2; i++) {
            const wheelX = x + (i * 9); // Distributed across the tracks
            const wheelY = y - 3;
            ctx.save();
            ctx.beginPath();
            ctx.arc(wheelX, wheelY, 3.5, 0, Math.PI * 2); // Reverted to full size
            ctx.fill();
            // Draw spinning spoke lines
            ctx.translate(wheelX, wheelY);
            ctx.rotate(wheelAngle + i * 0.4);
            ctx.beginPath();
            ctx.moveTo(-3.5, 0);
            ctx.lineTo(3.5, 0);
            ctx.moveTo(0, -3.5);
            ctx.lineTo(0, 3.5);
            ctx.stroke();
            ctx.restore();
        }
        // Apply recoil translation/rotation (No suspension bobbing)
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(this.recoilAngle);
        ctx.translate(-x, -y);
        // 2. Draw Chassis (Tank Body - Doubled in size, sitting flush on the tracks)
        const chassisImg = this.type === 'player' ? Player.blueChassisCanvas : Player.orangeChassisCanvas;
        if (chassisImg && chassisImg.width > 0) {
            // Draw chassis image centered, sitting on top of the tracks (y-31 to y-7, height 24)
            ctx.drawImage(chassisImg, x - bodyWidth / 2, y - 31, bodyWidth, 24);
        }
        else {
            ctx.fillStyle = mainColor;
            ctx.beginPath();
            ctx.roundRect(x - bodyWidth / 2, y - 30, bodyWidth, 16, 5);
            ctx.fill();
            // Tank cabin/turret base
            ctx.fillStyle = secondaryColor;
            ctx.beginPath();
            ctx.arc(x, y - 29, 13, Math.PI, 0);
            ctx.fill();
        }
        // 3. Draw Rotatable Turret Barrel (Pivoted around turret well)
        const turretImg = this.type === 'player' ? Player.blueTurretCanvas : Player.orangeTurretCanvas;
        if (turretImg && turretImg.width > 0) {
            ctx.save();
            // Translate to the turret rotation joint position (centered on chassis, y-29)
            ctx.translate(x, y - 29);
            // Rotate by the aim angle.
            ctx.rotate(-this.aimAngle);
            const finalBarrelLength = Math.max(16, 42 - this.recoilOffset);
            // Draw the gun barrel (scaled thickness: 16px to match massive body)
            ctx.drawImage(turretImg, 0, -8, finalBarrelLength, 16);
            ctx.restore();
        }
        else {
            ctx.strokeStyle = '#64748b'; // Metallic grey
            ctx.lineWidth = 8;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x, y - 31);
            const finalBarrelLength = Math.max(16, 42 - this.recoilOffset);
            const barrelX = x + Math.cos(this.aimAngle) * finalBarrelLength;
            const barrelY = (y - 31) - Math.sin(this.aimAngle) * finalBarrelLength;
            ctx.lineTo(barrelX, barrelY);
            ctx.stroke();
            // Muzzle brake
            ctx.fillStyle = '#475569';
            ctx.beginPath();
            ctx.arc(barrelX, barrelY, 7, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore(); // restore recoil space
        // 4. Draw engine exhaust glow (Sitting statically on chassis, y-16)
        const exhaustX = this.type === 'player' ? x - 33 : x + 33;
        const exhaustY = y - 16;
        ctx.save();
        const exhaustColor = this.type === 'player' ? '#38bdf8' : '#f87171';
        ctx.shadowColor = exhaustColor;
        ctx.shadowBlur = 8;
        ctx.fillStyle = exhaustColor;
        ctx.beginPath();
        ctx.arc(exhaustX, exhaustY, 2.5 + Math.sin(Date.now() / 100) * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // 5. Highlight current active tank with a pulsating Plasma Shield Dome (Larger for bigger body)
        if (isCurrentTurn) {
            ctx.save();
            const shieldGlowColor = mainColor;
            // Draw shield dome fill
            const shieldRadGrad = ctx.createRadialGradient(x, y - 19, 10, x, y - 19, 48);
            shieldRadGrad.addColorStop(0, 'rgba(0,0,0,0)');
            shieldRadGrad.addColorStop(0.85, this.type === 'player' ? 'rgba(59, 130, 246, 0.03)' : 'rgba(239, 68, 68, 0.03)');
            shieldRadGrad.addColorStop(1, this.type === 'player' ? 'rgba(59, 130, 246, 0.18)' : 'rgba(239, 68, 68, 0.18)');
            ctx.fillStyle = shieldRadGrad;
            ctx.beginPath();
            ctx.arc(x, y - 19, 48, 0, Math.PI * 2);
            ctx.fill();
            // Outer rotating glowing border
            ctx.strokeStyle = shieldGlowColor;
            ctx.lineWidth = 1.5;
            ctx.shadowColor = shieldGlowColor;
            ctx.shadowBlur = 10;
            ctx.setLineDash([12, 18]);
            ctx.lineDashOffset = (Date.now() / 50) % 30; // rotating effect
            ctx.beginPath();
            ctx.arc(x, y - 19, 48, 0, Math.PI * 2);
            ctx.stroke();
            // Inner shell ring
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 0.5;
            ctx.setLineDash([4, 16]);
            ctx.lineDashOffset = -(Date.now() / 80) % 20; // reverse rotation
            ctx.beginPath();
            ctx.arc(x, y - 19, 44, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        // 6. Draw simple Health Bar above tank (raised for height)
        const barWidth = 66;
        const barHeight = 5;
        const barX = x - barWidth / 2;
        const barY = y - 50;
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
        ctx.fillText(this.type === 'player' ? 'PLAYER 1' : 'OPPONENT', x, y - 57);
        ctx.restore();
    }
}
Player.assetsLoaded = false;
Player.blueChassisCanvas = null;
Player.orangeChassisCanvas = null;
Player.blueTurretCanvas = null;
Player.orangeTurretCanvas = null;
//# sourceMappingURL=player.js.map