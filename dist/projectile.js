export class Projectile {
    constructor(id, owner, position, velocity, damage, radius, projectileRadius = 4, type = 'small_cannon') {
        // Phase 3 States
        this.wasSplit = false;
        this.bouncesRemaining = 3;
        this.prevVy = -100;
        this.initialSpeed = 0;
        this.trail = [];
        this.id = id;
        this.owner = owner;
        this.position = position;
        this.velocity = velocity;
        this.damage = damage;
        this.radius = radius;
        this.projectileRadius = projectileRadius;
        this.isActive = true;
        this.type = type;
        this.bouncesRemaining = type === 'bouncing_grenade' ? 3 : 0;
        this.initialSpeed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
    }
    addTrailPoint() {
        if (this.trail.length > 0) {
            const last = this.trail[this.trail.length - 1];
            const dx = this.position.x - last.x;
            const dy = this.position.y - last.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 7)
                return; // avoid clusters during sub-stepping
        }
        this.trail.push(Object.assign({}, this.position));
        if (this.trail.length > 40) {
            this.trail.shift();
        }
    }
    update(physics, terrain, players) {
        // Left for backwards compatibility, actual updates handled substepped in engine.ts
    }
    draw(ctx) {
        if (!this.isActive)
            return;
        ctx.save();
        // 1. Draw glowing particle trail
        if (this.trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            const isPlayer = this.owner === 'player';
            let trailColor = isPlayer ? 'rgba(56, 189, 248, ' : 'rgba(248, 113, 113, ';
            // Customize trails for special weapons
            if (this.type === 'dirt_spreader') {
                trailColor = 'rgba(52, 211, 153, '; // Green
            }
            else if (this.type === 'nuke') {
                trailColor = 'rgba(245, 158, 11, '; // Golden Orange glow
            }
            else if (this.type === 'bouncing_grenade') {
                trailColor = 'rgba(167, 139, 250, '; // Purple bouncy trail
            }
            else if (this.type === 'cluster_bomb' || this.type === 'cluster_sub') {
                trailColor = 'rgba(251, 113, 133, '; // Rose cluster trail
            }
            // Draw thicker outer glow
            ctx.strokeStyle = trailColor + '0.15)';
            ctx.lineWidth = this.projectileRadius * 2.5;
            ctx.stroke();
            // Draw thin inner core
            ctx.strokeStyle = trailColor + '0.6)';
            ctx.lineWidth = this.projectileRadius * 0.8;
            ctx.stroke();
        }
        // 2. Draw Projectile shell
        const gradient = ctx.createRadialGradient(this.position.x, this.position.y, 0, this.position.x, this.position.y, this.projectileRadius);
        // Customize core color of special shells
        if (this.type === 'nuke') {
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.3, '#fbbf24');
            gradient.addColorStop(1, '#dc2626'); // Red-hot nuke
        }
        else if (this.type === 'bouncing_grenade') {
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.3, '#c084fc');
            gradient.addColorStop(1, '#7c3aed'); // Purple grenade
        }
        else if (this.type === 'dirt_spreader') {
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.3, '#34d399');
            gradient.addColorStop(1, '#059669'); // Green terraformer
        }
        else {
            gradient.addColorStop(0, '#ffffff'); // bright hot core
            gradient.addColorStop(0.4, '#fbbf24'); // gold middle
            gradient.addColorStop(1, '#f97316'); // orange outer edge
        }
        ctx.fillStyle = gradient;
        ctx.shadowColor = this.type === 'nuke' ? '#ef4444' : '#f59e0b';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.projectileRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}
//# sourceMappingURL=projectile.js.map