export class Renderer {
    constructor(canvasId, config) {
        const canvas = document.getElementById(canvasId);
        this.ctx = canvas.getContext('2d');
        this.config = config;
    }
    getContext() {
        return this.ctx;
    }
    clear() {
        this.ctx.clearRect(0, 0, this.config.canvasWidth, this.config.canvasHeight);
    }
    drawTerrain(terrain, turnsElapsed = 0) {
        terrain.draw(this.ctx, turnsElapsed);
    }
    drawPlayers(players, activePlayerType) {
        players.forEach(player => {
            player.draw(this.ctx, player.type === activePlayerType);
        });
    }
    drawProjectiles(projectiles) {
        projectiles.forEach(p => {
            p.draw(this.ctx);
        });
    }
}
//# sourceMappingURL=renderer.js.map