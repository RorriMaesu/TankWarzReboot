export class UI {
  constructor() {}

  public update(players: any[], state: string) {
    const player = players.find(p => p.type === 'player');
    if (player) {
      const hpEl = document.getElementById('player-hp');
      if (hpEl) hpEl.textContent = Math.floor(player.health).toString();
      const fuelEl = document.getElementById('player-fuel');
      if (fuelEl) fuelEl.textContent = Math.floor(player.fuel).toString();
    }

    const ai = players.find(p => p.type === 'ai');
    if (ai) {
      const hpEl = document.getElementById('ai-hp');
      if (hpEl) hpEl.textContent = Math.floor(ai.health).toString();
      const fuelEl = document.getElementById('ai-fuel');
      if (fuelEl) fuelEl.textContent = Math.floor(ai.fuel).toString();
    }

    const turnIndicator = document.getElementById('turn-indicator');
    if (turnIndicator) {
      turnIndicator.textContent = state.replace('_', ' ');
    }

    const controls = document.getElementById('controls');
    if (controls) {
      controls.classList.toggle('hidden', state !== 'PLAYER_TURN');
    }
  }
}