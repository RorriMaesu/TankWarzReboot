export interface SpriteConfig {
  image: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export class Sprite {
  public x: number;
  public y: number;
  public width: number;
  public height: number;
  private image: HTMLImageElement;

  constructor(config: SpriteConfig) {
    this.x = config.x;
    this.y = config.y;
    this.width = config.width;
    this.height = config.height;
    this.image = new Image();
    this.image.src = config.image;
  }

  public draw(ctx: CanvasRenderingContext2D) {
    ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
  }

  public updatePosition(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}