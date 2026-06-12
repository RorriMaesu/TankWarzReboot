export class BackgroundManager {
    constructor(config) {
        this.ashParticles = [];
        this.distantBuildings = [];
        this.nearBuildings = [];
        this.flashActive = false;
        this.flashTimer = 0;
        this.config = config;
        this.initBuildings();
        this.initAsh();
    }
    initBuildings() {
        // Generate distant building silhouettes (predefined coordinates for consistency)
        let currentX = -50;
        while (currentX < this.config.canvasWidth + 100) {
            const width = 60 + Math.random() * 80;
            const height = 120 + Math.random() * 180;
            this.distantBuildings.push({
                x: currentX,
                width,
                height
            });
            currentX += width - 15; // slightly overlap
        }
        // Generate near building silhouettes with broken windows / neon lights
        currentX = -50;
        while (currentX < this.config.canvasWidth + 100) {
            const width = 80 + Math.random() * 100;
            const height = 180 + Math.random() * 220;
            const lights = [];
            // Add windows / flickering lights
            const rows = Math.floor(height / 35);
            for (let r = 2; r < rows; r++) {
                const yOffset = r * 30;
                const color = Math.random() > 0.5 ? '#10b981' : '#f43f5e'; // neon green or rose red
                if (Math.random() > 0.4) {
                    lights.push({ y: yOffset, color, offset: Math.random() * 100 });
                }
            }
            this.nearBuildings.push({
                x: currentX,
                width,
                height,
                lights
            });
            currentX += width - 20;
        }
    }
    initAsh() {
        for (let i = 0; i < 45; i++) {
            this.ashParticles.push({
                x: Math.random() * this.config.canvasWidth,
                y: Math.random() * this.config.canvasHeight,
                size: 1 + Math.random() * 2.5,
                speedY: 0.4 + Math.random() * 0.8,
                speedX: -0.2 + Math.random() * 0.4,
                opacity: 0.2 + Math.random() * 0.6,
                pulseSpeed: 0.02 + Math.random() * 0.04
            });
        }
    }
    update(windSpeed) {
        // Ash particle animation influenced by wind
        const targetWindEffect = windSpeed * 0.05;
        this.ashParticles.forEach(p => {
            p.y += p.speedY;
            p.x += p.speedX + targetWindEffect;
            // Pulse opacity
            p.opacity += Math.sin(Date.now() * p.pulseSpeed) * 0.02;
            p.opacity = Math.max(0.1, Math.min(0.8, p.opacity));
            // Reset if out of bounds
            if (p.y > this.config.canvasHeight) {
                p.y = -10;
                p.x = Math.random() * this.config.canvasWidth;
            }
            if (p.x < -10) {
                p.x = this.config.canvasWidth + 10;
            }
            else if (p.x > this.config.canvasWidth + 10) {
                p.x = -10;
            }
        });
        // Occasional sky flash (toxic storm lightning)
        if (!this.flashActive && Math.random() < 0.0015) {
            this.flashActive = true;
            this.flashTimer = 10 + Math.random() * 15; // duration in frames
        }
        if (this.flashActive) {
            this.flashTimer--;
            if (this.flashTimer <= 0) {
                this.flashActive = false;
            }
        }
    }
    draw(ctx, cameraOffsetX = 0) {
        const w = this.config.canvasWidth;
        const h = this.config.canvasHeight;
        // 1. Draw radioactive sky gradient
        const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
        if (this.flashActive && Math.random() > 0.3) {
            skyGrad.addColorStop(0, '#581c87'); // toxic purple blast
            skyGrad.addColorStop(0.5, '#4c1d95');
            skyGrad.addColorStop(1, '#1e1b4b');
        }
        else {
            skyGrad.addColorStop(0, '#1e112a'); // deep dark purple
            skyGrad.addColorStop(0.4, '#2d122d');
            skyGrad.addColorStop(0.8, '#4a1525'); // toxic red-crimson
            skyGrad.addColorStop(1, '#5b2116'); // orange sun dust glow
        }
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, h);
        // 2. Draw radioactive dying sun (faint glow)
        ctx.save();
        const sunGrad = ctx.createRadialGradient(w * 0.7, h * 0.45, 10, w * 0.7, h * 0.45, 160);
        sunGrad.addColorStop(0, 'rgba(244, 63, 94, 0.45)'); // glowing crimson core
        sunGrad.addColorStop(0.3, 'rgba(239, 68, 68, 0.15)');
        sunGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = sunGrad;
        ctx.beginPath();
        ctx.arc(w * 0.7, h * 0.45, 160, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // 3. Draw distant building silhouettes (Far parallax: move 10% of cameraOffset)
        ctx.fillStyle = '#1e1428'; // dark violet silhouette
        const distParallax = cameraOffsetX * 0.1;
        this.distantBuildings.forEach(b => {
            const renderX = b.x - distParallax;
            ctx.beginPath();
            // Draw building box
            ctx.rect(renderX, h - b.height, b.width, b.height);
            ctx.fill();
            // Draw crumbling top details (antenna / broken pillars)
            ctx.strokeStyle = '#1e1428';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(renderX + b.width / 2, h - b.height);
            ctx.lineTo(renderX + b.width / 2, h - b.height - 20);
            ctx.stroke();
        });
        // 4. Draw near building silhouettes (Near parallax: move 22% of cameraOffset)
        const nearParallax = cameraOffsetX * 0.22;
        this.nearBuildings.forEach(b => {
            const renderX = b.x - nearParallax;
            ctx.fillStyle = '#0f0b18'; // darker silhouette
            ctx.beginPath();
            // Draw building with jagged broken top
            ctx.moveTo(renderX, h);
            ctx.lineTo(renderX, h - b.height + 20);
            ctx.lineTo(renderX + b.width * 0.3, h - b.height);
            ctx.lineTo(renderX + b.width * 0.6, h - b.height + 30);
            ctx.lineTo(renderX + b.width, h - b.height + 10);
            ctx.lineTo(renderX + b.width, h);
            ctx.closePath();
            ctx.fill();
            // Draw glowing / flickering neon windows
            b.lights.forEach(l => {
                // Flicker effect based on color offset
                const flicker = Math.sin(Date.now() * 0.005 + l.offset) > -0.2;
                if (flicker) {
                    ctx.fillStyle = l.color;
                    ctx.shadowColor = l.color;
                    ctx.shadowBlur = 4;
                    // Draw a small neon window block
                    ctx.fillRect(renderX + 25, h - b.height + l.y, 8, 6);
                    ctx.fillRect(renderX + b.width - 33, h - b.height + l.y, 8, 6);
                    ctx.shadowBlur = 0; // reset shadow
                }
            });
        });
        // 5. Draw drifting embers / ash particles
        ctx.save();
        this.ashParticles.forEach(p => {
            ctx.fillStyle = `rgba(249, 115, 22, ${p.opacity})`; // glowing orange ember
            ctx.shadowColor = '#f97316';
            ctx.shadowBlur = p.size * 1.5;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
    }
}
//# sourceMappingURL=background_manager.js.map