import { Player } from './player.js';
import { Vector2D } from './types.js';

export class UIManager {
  public updateUI(players: Player[], state: string, wind: Vector2D, gameMode: 'vs_ai' | 'pvp') {
    const player = players.find(p => p.type === 'player');
    if (player) {
      const hpEl = document.getElementById('player-hp');
      if (hpEl) hpEl.textContent = Math.max(0, Math.floor(player.health)).toString();
      const fuelEl = document.getElementById('player-fuel');
      if (fuelEl) fuelEl.textContent = Math.max(0, Math.floor(player.fuel)).toString();

      // Update bars
      const hpBar = document.getElementById('player-hp-bar') as HTMLElement;
      if (hpBar) hpBar.style.width = `${Math.max(0, (player.health / 100) * 100)}%`;
      const fuelBar = document.getElementById('player-fuel-bar') as HTMLElement;
      if (fuelBar) fuelBar.style.width = `${Math.max(0, (player.fuel / player.maxFuel) * 100)}%`;
    }

    const ai = players.find(p => p.type === 'ai');
    if (ai) {
      const hpEl = document.getElementById('ai-hp');
      if (hpEl) hpEl.textContent = Math.max(0, Math.floor(ai.health)).toString();
      const fuelEl = document.getElementById('ai-fuel');
      if (fuelEl) fuelEl.textContent = Math.max(0, Math.floor(ai.fuel)).toString();

      // Update bars
      const hpBar = document.getElementById('ai-hp-bar') as HTMLElement;
      if (hpBar) hpBar.style.width = `${Math.max(0, (ai.health / 100) * 100)}%`;
      const fuelBar = document.getElementById('ai-fuel-bar') as HTMLElement;
      if (fuelBar) fuelBar.style.width = `${Math.max(0, (ai.fuel / ai.maxFuel) * 100)}%`;
    }

    // Dynamic label for AI / Player 2 panel
    const aiStatsLabel = document.getElementById('ai-stats-label');
    if (aiStatsLabel) {
      aiStatsLabel.textContent = gameMode === 'pvp' ? 'PLAYER 2' : 'HEURISTIC AI';
    }

    // Active panel highlighting
    const p1Panel = document.getElementById('player-stats');
    const p2Panel = document.getElementById('ai-stats');
    if (p1Panel && p2Panel) {
      const p1Active = state === 'PLAYER_TURN';
      const p2Active = state === 'ENEMY_TURN';
      p1Panel.classList.toggle('active', p1Active);
      p2Panel.classList.toggle('active', p2Active && gameMode === 'vs_ai');
      p2Panel.classList.toggle('active-p2', p2Active && gameMode === 'pvp');
    }

    // Turn indicator
    const turnIndicator = document.getElementById('turn-indicator');
    if (turnIndicator) {
      if (state === 'PLAYER_TURN') {
        turnIndicator.textContent = 'PLAYER 1 TURN';
        turnIndicator.style.borderColor = '#3b82f6';
        turnIndicator.style.color = '#3b82f6';
        turnIndicator.style.boxShadow = '0 0 16px rgba(59, 130, 246, 0.4)';
      } else if (state === 'ENEMY_TURN') {
        if (gameMode === 'pvp') {
          turnIndicator.textContent = 'PLAYER 2 TURN';
          turnIndicator.style.borderColor = '#a78bfa';
          turnIndicator.style.color = '#a78bfa';
          turnIndicator.style.boxShadow = '0 0 16px rgba(167, 139, 250, 0.4)';
        } else {
          turnIndicator.textContent = 'AI THINKING...';
          turnIndicator.style.borderColor = '#ef4444';
          turnIndicator.style.color = '#ef4444';
          turnIndicator.style.boxShadow = '0 0 16px rgba(239, 68, 68, 0.4)';
        }
      } else if (state === 'PROJECTILE_FLIGHT') {
        turnIndicator.textContent = 'SHELL IN FLIGHT';
        turnIndicator.style.borderColor = '#fbbf24';
        turnIndicator.style.color = '#fbbf24';
        turnIndicator.style.boxShadow = '0 0 16px rgba(251, 191, 36, 0.4)';
      } else {
        turnIndicator.textContent = 'GAME OVER';
        turnIndicator.style.borderColor = '#94a3b8';
        turnIndicator.style.color = '#94a3b8';
        turnIndicator.style.boxShadow = 'none';
      }
    }

    // Controls visibility
    const controls = document.getElementById('controls');
    if (controls) {
      const showControls = state === 'PLAYER_TURN' || (state === 'ENEMY_TURN' && gameMode === 'pvp');
      controls.classList.toggle('hidden', !showControls);

      // Fire button color follows active player theme
      const fireButton = document.getElementById('fire-button');
      if (fireButton) {
        if (state === 'PLAYER_TURN') {
          fireButton.style.background = 'linear-gradient(160deg, #3b82f6 0%, #1d4ed8 100%)';
          fireButton.style.color = '#ffffff';
          fireButton.style.setProperty('--fire-glow', 'rgba(59,130,246,0.55)');
        } else if (state === 'ENEMY_TURN' && gameMode === 'pvp') {
          fireButton.style.background = 'linear-gradient(160deg, #a78bfa 0%, #6d28d9 100%)';
          fireButton.style.color = '#ffffff';
          fireButton.style.setProperty('--fire-glow', 'rgba(167,139,250,0.55)');
        } else {
          fireButton.style.background = '';
          fireButton.style.color = '';
        }
      }
    }

    // Wind indicator
    const windVal = document.getElementById('wind-value');
    if (windVal) {
      const direction = wind.x >= 0 ? 'EAST' : 'WEST';
      const speed = Math.abs(Math.round(wind.x * 100));
      windVal.textContent = `${speed} km/h ${direction}`;
    }

    const windArrow = document.getElementById('wind-direction-arrow');
    if (windArrow) {
      const angle = wind.x >= 0 ? 0 : 180;
      windArrow.style.transform = `rotate(${angle}deg)`;
    }
  }

  public logMessage(message: string) {
    const logEl = document.getElementById('message-log');
    if (logEl) {
      const entry = document.createElement('div');
      entry.className = 'log-entry';
      entry.innerHTML = `<span style="color:#fbbf24">[SYS]</span> ${message}`;
      // Prepend so newest is on top (since flex-direction: column-reverse shows top first)
      logEl.insertBefore(entry, logEl.firstChild);

      // Keep only last 5 entries to prevent DOM bloat
      while (logEl.children.length > 5) {
        logEl.removeChild(logEl.lastChild!);
      }
    }
  }

  public updateSliders(power: number, angle: number) {
    const powerVal = document.getElementById('power-val');
    if (powerVal) powerVal.textContent = power.toString();
    const angleVal = document.getElementById('angle-val');
    if (angleVal) angleVal.textContent = `${angle}°`;
  }

  public showGameOver(winner: string) {
    const screen = document.getElementById('game-over-screen');
    if (screen) {
      screen.classList.remove('hidden');
      const text = document.getElementById('winner-text');
      if (text) {
        text.textContent = winner === 'player' ? 'VICTORY' : 'DEFEATED';
        text.style.color = winner === 'player' ? '#10b981' : '#ef4444';
      }
      const restartBtn = document.getElementById('restart-button') as HTMLButtonElement;
      if (restartBtn) {
        restartBtn.innerText = "REDEPLOY TANK";
        restartBtn.disabled = false;
      }
    }
  }

  public hideGameOver() {
    const screen = document.getElementById('game-over-screen');
    if (screen) {
      screen.classList.add('hidden');
    }
  }
}