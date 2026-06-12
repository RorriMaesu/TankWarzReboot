export class BackgroundManager {
    constructor(config) {
        this.ashParticles = [];
        // Image assets
        this.skyImg = null;
        this.distantImg = null;
        this.nearImg = null;
        this.assetsLoaded = { sky: false, distant: false, near: false };
        // Programmatic generation fallbacks (in case image files aren't generated yet)
        this.distantBuildings = [];
        this.nearBuildings = [];
        this.flashActive = false;
        this.flashTimer = 0;
        this.config = config;
        this.initBuildings();
        this.initAsh();
        this.loadImages();
    }
    loadImages() {
        console.log("BackgroundManager: Initiating image loads...");
        // Load Sky Layer
        this.skyImg = new Image();
        this.skyImg.src = 'assets/sky.png?v=1.1.8';
        this.skyImg.onload = () => {
            console.log("BackgroundManager: sky.png loaded successfully");
            this.assetsLoaded.sky = true;
        };
        this.skyImg.onerror = (e) => {
            console.error("BackgroundManager: sky.png failed to load", e);
            this.skyImg = null;
        };
        // Load Distant Skyline
        this.distantImg = new Image();
        this.distantImg.src = 'assets/distant_ruins.png?v=1.1.8';
        this.distantImg.onload = () => {
            console.log("BackgroundManager: distant_ruins.png loaded successfully");
            this.assetsLoaded.distant = true;
        };
        this.distantImg.onerror = (e) => {
            console.error("BackgroundManager: distant_ruins.png failed to load", e);
            this.distantImg = null;
        };
        // Load Near Skyline
        this.nearImg = new Image();
        this.nearImg.src = 'assets/near_ruins.png?v=1.1.8';
        this.nearImg.onload = () => {
            console.log("BackgroundManager: near_ruins.png loaded successfully");
            this.assetsLoaded.near = true;
        };
        this.nearImg.onerror = (e) => {
            console.error("BackgroundManager: near_ruins.png failed to load", e);
            this.nearImg = null;
        };
    }
    initBuildings() {
        let currentX = -50;
        while (currentX < this.config.canvasWidth + 100) {
            const width = 60 + Math.random() * 80;
            const height = 120 + Math.random() * 180;
            this.distantBuildings.push({ x: currentX, width, height });
            currentX += width - 15;
        }
        currentX = -50;
        while (currentX < this.config.canvasWidth + 100) {
            const width = 80 + Math.random() * 100;
            const height = 180 + Math.random() * 220;
            const lights = [];
            const rows = Math.floor(height / 35);
            for (let r = 2; r < rows; r++) {
                const yOffset = r * 30;
                const color = Math.random() > 0.5 ? '#10b981' : '#f43f5e';
                if (Math.random() > 0.4) {
                    lights.push({ y: yOffset, color, offset: Math.random() * 100 });
                }
            }
            this.nearBuildings.push({ x: currentX, width, height, lights });
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
        const targetWindEffect = windSpeed * 0.05;
        this.ashParticles.forEach(p => {
            p.y += p.speedY;
            p.x += p.speedX + targetWindEffect;
            p.opacity += Math.sin(Date.now() * p.pulseSpeed) * 0.02;
            p.opacity = Math.max(0.1, Math.min(0.8, p.opacity));
            if (p.y > this.config.canvasHeight) {
                p.y = -10;
                p.x = Math.random() * this.config.canvasWidth;
            }
            if (p.x < -10)
                p.x = this.config.canvasWidth + 10;
            else if (p.x > this.config.canvasWidth + 10)
                p.x = -10;
        });
        if (!this.flashActive && Math.random() < 0.0015) {
            this.flashActive = true;
            this.flashTimer = 10 + Math.random() * 15;
        }
        if (this.flashActive) {
            this.flashTimer--;
            if (this.flashTimer <= 0)
                this.flashActive = false;
        }
    }
    drawTiledImage(ctx, img, parallaxOffset, yOffset, targetHeight) {
        const w = this.config.canvasWidth;
        const imgWidth = img.width * (targetHeight / img.height);
        // Draw repeating copies to cover the viewport width
        const startX = -(parallaxOffset % imgWidth);
        // Draw repeating elements horizontally
        for (let x = startX - imgWidth; x < w + imgWidth; x += imgWidth) {
            ctx.drawImage(img, x, yOffset, imgWidth, targetHeight);
        }
    }
    draw(ctx, cameraOffsetX = 0) {
        const w = this.config.canvasWidth;
        const h = this.config.canvasHeight;
        // 1. Draw radioactive sky layer
        if (this.assetsLoaded.sky && this.skyImg) {
            // Scale sky image to fit canvas
            ctx.drawImage(this.skyImg, 0, 0, w, h);
        }
        else {
            // Programmatic Gradient sky fallback
            const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
            if (this.flashActive && Math.random() > 0.3) {
                skyGrad.addColorStop(0, '#581c87');
                skyGrad.addColorStop(0.5, '#4c1d95');
                skyGrad.addColorStop(1, '#1e1b4b');
            }
            else {
                skyGrad.addColorStop(0, '#1e112a');
                skyGrad.addColorStop(0.4, '#2d122d');
                skyGrad.addColorStop(0.8, '#4a1525');
                skyGrad.addColorStop(1, '#5b2116');
            }
            ctx.fillStyle = skyGrad;
            ctx.fillRect(0, 0, w, h);
            // Radioactive sun glow
            ctx.save();
            const sunGrad = ctx.createRadialGradient(w * 0.7, h * 0.45, 10, w * 0.7, h * 0.45, 160);
            sunGrad.addColorStop(0, 'rgba(244, 63, 94, 0.45)');
            sunGrad.addColorStop(0.3, 'rgba(239, 68, 68, 0.15)');
            sunGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = sunGrad;
            ctx.beginPath();
            ctx.arc(w * 0.7, h * 0.45, 160, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        // 2. Draw distant building silhouettes (Far parallax: 10% movement)
        const distParallax = cameraOffsetX * 0.1;
        if (this.assetsLoaded.distant && this.distantImg) {
            // Tiled distant skyline image at the bottom of the canvas
            this.drawTiledImage(ctx, this.distantImg, distParallax, h - 280, 280);
        }
        else {
            // Programmatic Distant Skyline fallback
            ctx.fillStyle = '#1e1428';
            this.distantBuildings.forEach(b => {
                const renderX = b.x - distParallax;
                ctx.beginPath();
                ctx.rect(renderX, h - b.height, b.width, b.height);
                ctx.fill();
                ctx.strokeStyle = '#1e1428';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(renderX + b.width / 2, h - b.height);
                ctx.lineTo(renderX + b.width / 2, h - b.height - 20);
                ctx.stroke();
            });
        }
        // 3. Draw near building silhouettes (Near parallax: 22% movement)
        const nearParallax = cameraOffsetX * 0.22;
        if (this.assetsLoaded.near && this.nearImg) {
            // Tiled near ruins image
            this.drawTiledImage(ctx, this.nearImg, nearParallax, h - 340, 340);
        }
        else {
            // Programmatic Near Skyline fallback
            this.nearBuildings.forEach(b => {
                const renderX = b.x - nearParallax;
                ctx.fillStyle = '#0f0b18';
                ctx.beginPath();
                ctx.moveTo(renderX, h);
                ctx.lineTo(renderX, h - b.height + 20);
                ctx.lineTo(renderX + b.width * 0.3, h - b.height);
                ctx.lineTo(renderX + b.width * 0.6, h - b.height + 30);
                ctx.lineTo(renderX + b.width, h - b.height + 10);
                ctx.lineTo(renderX + b.width, h);
                ctx.closePath();
                ctx.fill();
                b.lights.forEach(l => {
                    const flicker = Math.sin(Date.now() * 0.005 + l.offset) > -0.2;
                    if (flicker) {
                        ctx.fillStyle = l.color;
                        ctx.shadowColor = l.color;
                        ctx.shadowBlur = 4;
                        ctx.fillRect(renderX + 25, h - b.height + l.y, 8, 6);
                        ctx.fillRect(renderX + b.width - 33, h - b.height + l.y, 8, 6);
                        ctx.shadowBlur = 0;
                    }
                });
            });
        }
        // 4. Draw drifting embers / ash particles
        ctx.save();
        this.ashParticles.forEach(p => {
            ctx.fillStyle = `rgba(249, 115, 22, ${p.opacity})`;
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