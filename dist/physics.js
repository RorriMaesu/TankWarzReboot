export class PhysicsEngine {
    constructor(config) {
        this.config = config;
    }
    /**
     * Calculates the next position of a projectile based on current velocity, gravity, and wind drag.
     * Modifies velocity in-place. Scales physics values by dt (delta time) for sub-stepping.
     */
    updateProjectile(position, velocity, dt = 1) {
        // 1. Apply gravity (downward acceleration)
        velocity.y += this.config.gravity * dt;
        // 2. Apply Aerodynamic Wind Drag
        // Wind force is proportional to the relative velocity difference between projectile and air
        const resolutionScale = this.config.canvasWidth / 1024;
        const targetWindSpeed = this.config.wind.x * 10 * resolutionScale; // Balanced scale
        const dragCoefficient = 0.012; // Air density/drag factor
        const relX = targetWindSpeed - velocity.x;
        velocity.x += relX * dragCoefficient * dt;
        // Vertical drag (resistance slowing down rapid vertical ascent/descent)
        velocity.y += -velocity.y * dragCoefficient * dt;
        return {
            x: position.x + velocity.x * dt,
            y: position.y + velocity.y * dt
        };
    }
    /**
     * Calculates the landing point of a projectile using sub-stepped physics.
     * This is used by the AI for its trajectory simulation.
     */
    simulateTrajectory(initialPosition, power, angle, terrain, speedMultiplier = 0.15) {
        const resolutionScale = this.config.canvasWidth / 1024;
        let pos = Object.assign({}, initialPosition);
        let vel = {
            x: Math.cos(angle) * power * speedMultiplier * resolutionScale,
            y: -Math.sin(angle) * power * speedMultiplier * resolutionScale
        };
        // Simulate flight path
        for (let i = 0; i < 400; i++) {
            const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
            // Run sub-stepping to ensure collision checking precision (anti-tunneling)
            const subSteps = Math.ceil(speed / 2.0); // Limit displacement to max 2px per sub-step
            const dt = 1.0 / subSteps;
            let hit = false;
            for (let s = 0; s < subSteps; s++) {
                pos = this.updateProjectile(pos, vel, dt);
                // Out of horizontal bounds check
                if (pos.x < 0 || pos.x > this.config.canvasWidth) {
                    hit = true;
                    break;
                }
                // Ground check using the terrain object
                if (pos.y >= terrain.getHeight(pos.x)) {
                    pos.y = terrain.getHeight(pos.x);
                    hit = true;
                    break;
                }
            }
            if (hit)
                break;
        }
        return pos;
    }
}
//# sourceMappingURL=physics.js.map