class SeededRandom {
    constructor(seed) {
        this.seed = seed;
    }
    // Returns a pseudo-random float between 0 and 1
    next() {
        const x = Math.sin(this.seed++) * 10000;
        return x - Math.floor(x);
    }
    // Returns a pseudo-random float between min and max
    range(min, max) {
        return min + this.next() * (max - min);
    }
}
export class Terrain {
    constructor(width, height, seed) {
        this.heights = [];
        this.width = width;
        this.height = height;
        this.initializeHeights(seed);
    }
    initializeHeights(seed) {
        this.heights = new Array(this.width);
        const rng = new SeededRandom(seed !== null && seed !== void 0 ? seed : 12345);
        // Generate random coefficients for hills
        const freq1 = rng.range(0.002, 0.006);
        const amp1 = rng.range(50, 90);
        const freq2 = rng.range(0.01, 0.02);
        const amp2 = rng.range(15, 35);
        const freq3 = rng.range(0.025, 0.04);
        const amp3 = rng.range(4, 12);
        const baseHeightPct = rng.range(0.4, 0.5);
        for (let x = 0; x < this.width; x++) {
            // Procedural terrain: combination of sine waves for rolling hills
            const hill1 = Math.sin(x * freq1) * amp1;
            const hill2 = Math.cos(x * freq2) * amp2;
            const hill3 = Math.sin(x * freq3) * amp3;
            // Base ground height from bottom of screen
            this.heights[x] = this.height * baseHeightPct + hill1 + hill2 + hill3;
        }
    }
    /**
     * Returns the surface Y coordinate at the given X position.
     */
    getHeight(x, y) {
        const intX = Math.max(0, Math.min(this.width - 1, Math.floor(x)));
        return this.height - this.heights[intX];
    }
    /**
     * Deforms the terrain at (x, y) with a given radius.
     * Carves a circle out of the terrain heightmap.
     */
    deform(x, y, radius) {
        const left = Math.max(0, Math.floor(x - radius));
        const right = Math.min(this.width - 1, Math.floor(x + radius));
        for (let cx = left; cx <= right; cx++) {
            const dx = cx - x;
            const dy = Math.sqrt(radius * radius - dx * dx);
            const craterBottomY = y + dy;
            // Convert craterBottomY (canvas Y coordinate) to land height (distance from bottom of screen)
            const craterBottomHeight = this.height - craterBottomY;
            if (this.heights[cx] > craterBottomHeight) {
                this.heights[cx] = Math.max(0, craterBottomHeight);
            }
        }
    }
    /**
     * Adds dirt to the terrain at (x, y) to build up a mound.
     */
    addDirt(x, y, radius) {
        const left = Math.max(0, Math.floor(x - radius));
        const right = Math.min(this.width - 1, Math.floor(x + radius));
        for (let cx = left; cx <= right; cx++) {
            const dx = cx - x;
            const dy = Math.sqrt(radius * radius - dx * dx);
            // Raise the height in a dome shape (scaled by 0.75 for natural looks)
            const moundHeight = dy * 0.75;
            // Add moundHeight to the current land height, capping it below the screen top
            this.heights[cx] = Math.min(this.height - 35, this.heights[cx] + moundHeight);
        }
    }
    draw(ctx, turnsElapsed = 0) {
        // 1. Draw Sky (Background Twilight Transition)
        const skyGradient = ctx.createLinearGradient(0, 0, 0, this.height);
        if (turnsElapsed < 4) {
            // Stage 1: Industrial Sunset
            skyGradient.addColorStop(0, '#7c2d12'); // Rich deep orange/red
            skyGradient.addColorStop(0.5, '#312e81'); // Indigo middle
            skyGradient.addColorStop(1, '#1e1b4b'); // Midnight bottom
        }
        else if (turnsElapsed < 8) {
            // Stage 2: Cyberpunk Twilight
            skyGradient.addColorStop(0, '#4a044e'); // Dark magenta-purple
            skyGradient.addColorStop(0.6, '#1e1b4b'); // Deep indigo
            skyGradient.addColorStop(1, '#0f172a'); // Slate bottom
        }
        else {
            // Stage 3: Space Midnight
            skyGradient.addColorStop(0, '#030712'); // Dark space black
            skyGradient.addColorStop(1, '#0f172a'); // Dark slate bottom
        }
        ctx.fillStyle = skyGradient;
        ctx.fillRect(0, 0, this.width, this.height);
        // Render blinking starfield at all twilight stages (more stars at night)
        ctx.save();
        ctx.fillStyle = '#ffffff';
        const starCount = turnsElapsed >= 8 ? 45 : turnsElapsed >= 4 ? 20 : 10;
        for (let i = 0; i < starCount; i++) {
            const starX = (i * 43) % this.width;
            const starY = (i * 19) % 260;
            const starBlink = (Date.now() + i * 250) % 1500 > 750;
            ctx.globalAlpha = starBlink ? 0.9 : 0.2;
            ctx.fillRect(starX, starY, 1.2, 1.2);
        }
        ctx.restore();
        // Render glowing cyberpunk neon sun
        ctx.save();
        const sunGradient = ctx.createRadialGradient(this.width / 2, 140, 0, this.width / 2, 140, 100);
        sunGradient.addColorStop(0, 'rgba(244, 63, 94, 0.35)'); // Glowing Rose Pink
        sunGradient.addColorStop(0.4, 'rgba(236, 72, 153, 0.1)'); // Fading Pink
        sunGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = sunGradient;
        ctx.beginPath();
        ctx.arc(this.width / 2, 140, 100, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Render parallax cyberpunk skyline silhouette
        this.drawSkyline(ctx);
        // Render perspective vector grids in the background
        ctx.save();
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.05)'; // faint glowing indigo grid
        ctx.lineWidth = 1;
        const horizonY = 160;
        // Perspective horizontal lines
        for (let y = horizonY; y < this.height; y += (y - horizonY + 12) * 0.35) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.width, y);
            ctx.stroke();
        }
        // Converging vertical lines
        const linesCount = 24;
        for (let i = 0; i <= linesCount; i++) {
            const xHorizon = this.width / 2 + (i - linesCount / 2) * (this.width / (linesCount * 3.5));
            const xBottom = this.width / 2 + (i - linesCount / 2) * (this.width / linesCount) * 1.5;
            ctx.beginPath();
            ctx.moveTo(xHorizon, horizonY);
            ctx.lineTo(xBottom, this.height);
            ctx.stroke();
        }
        ctx.restore();
        // 2. Draw Dirt body (Cyber Slate Fill)
        ctx.beginPath();
        ctx.moveTo(0, this.height);
        for (let x = 0; x < this.width; x++) {
            ctx.lineTo(x, this.height - this.heights[x]);
        }
        ctx.lineTo(this.width, this.height);
        ctx.closePath();
        const dirtGradient = ctx.createLinearGradient(0, this.height * 0.3, 0, this.height);
        dirtGradient.addColorStop(0, '#0f172a'); // Cyber Slate
        dirtGradient.addColorStop(1, '#020617'); // Pitch Black bottom
        ctx.fillStyle = dirtGradient;
        ctx.fill();
        // 3. Draw Grass top layer (Glowing neon green vector line)
        ctx.beginPath();
        ctx.moveTo(0, this.height - this.heights[0]);
        for (let x = 1; x < this.width; x++) {
            ctx.lineTo(x, this.height - this.heights[x]);
        }
        ctx.save();
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#34d399'; // neon emerald
        ctx.lineWidth = 4;
        ctx.stroke();
        // Add bright center core to neon path
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
        // Subtle dark grass shadow under the neon glow
        ctx.beginPath();
        ctx.moveTo(0, this.height - this.heights[0] + 3);
        for (let x = 1; x < this.width; x++) {
            ctx.lineTo(x, this.height - this.heights[x] + 3);
        }
        ctx.strokeStyle = '#064e3b';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
    drawSkyline(ctx) {
        ctx.save();
        ctx.fillStyle = 'rgba(17, 24, 39, 0.38)'; // Low opacity deep cyber indigo
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)';
        ctx.lineWidth = 1;
        // Procedural skylines
        const buildingWidths = [50, 70, 40, 95, 60, 80, 45, 110, 55, 75];
        const buildingHeights = [130, 200, 100, 160, 230, 180, 110, 170, 145, 190];
        let currentX = -30;
        let bIndex = 0;
        while (currentX < this.width) {
            const w = buildingWidths[bIndex % buildingWidths.length];
            const h = buildingHeights[bIndex % buildingHeights.length];
            const y = this.height - h;
            // Draw building block
            ctx.fillRect(currentX, y, w, h);
            ctx.strokeRect(currentX, y, w, h);
            // Draw a few glowing neon windows
            ctx.fillStyle = 'rgba(251, 191, 36, 0.16)'; // golden window light
            const winCols = Math.floor(w / 14);
            const winRows = Math.floor(h / 24);
            for (let r = 1; r < winRows; r++) {
                for (let c = 1; c < winCols; c++) {
                    if ((c + r * 3) % 5 === 0) { // sparse window distribution
                        ctx.fillRect(currentX + c * 14, y + r * 24, 2.5, 3.5);
                    }
                }
            }
            ctx.fillStyle = 'rgba(17, 24, 39, 0.38)';
            currentX += w + 6;
            bIndex++;
        }
        ctx.restore();
    }
}
//# sourceMappingURL=terrain.js.map