export class Sprite {
    constructor(config) {
        this.x = config.x;
        this.y = config.y;
        this.width = config.width;
        this.height = config.height;
        this.image = new Image();
        this.image.src = config.image;
    }
    draw(ctx) {
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
    }
    updatePosition(x, y) {
        this.x = x;
        this.y = y;
    }
}
//# sourceMappingURL=sprite.js.map