import { Vector2D, GameConfig, Shot, WeaponType } from './types.js';
import { PhysicsEngine } from './physics.js';
import { Terrain } from './terrain.js';

export class AIController {
  private physics: PhysicsEngine;
  private config: GameConfig;
  private terrain: Terrain;
  private lastShotResult: 'undershot' | 'overshot' | 'hit' | null = null;
  private biasPower: number = 0; // Remembers adjustment offset across turns

  constructor(config: GameConfig, terrain: Terrain) {
    this.config = config;
    this.terrain = terrain;
    this.physics = new PhysicsEngine(config);
  }

  /**
   * Determines the next shot based on target position and previous turn feedback.
   * Runs an internal simulation loop to find a trajectory, then applies difficulty noise.
   */
  public decideShot(
    aiPosition: Vector2D,
    targetPosition: Vector2D,
    difficulty: 'easy' | 'medium' | 'expert',
    aiFuel: number,
    hasNuke: boolean
  ): Shot {
    // 1. Determine direction and starting angle
    const isTargetToLeft = targetPosition.x < aiPosition.x;
    const baseAngle = isTargetToLeft ? (3 * Math.PI) / 4 : Math.PI / 4; // 135 deg or 45 deg

    // 2. Adjust search based on memory of last actual shot
    if (this.lastShotResult === 'undershot') {
      this.biasPower += 10;
    } else if (this.lastShotResult === 'overshot') {
      this.biasPower -= 10;
    }

    const weaponMultipliers: Record<WeaponType, number> = {
      small_cannon: 0.10,
      heavy_mortar: 0.075,
      rapid_fire: 0.10,
      dirt_spreader: 0.085,
      nuke: 0.07,
      cluster_bomb: 0.09,
      bouncing_grenade: 0.085
    };

    const baseCosts: Record<WeaponType, number> = {
      small_cannon: 0,
      heavy_mortar: 25,
      rapid_fire: 15,
      dirt_spreader: 20,
      nuke: 35,
      cluster_bomb: 20,
      bouncing_grenade: 15
    };

    // 3. Choose a weapon
    let weaponType: WeaponType = 'small_cannon';
    if (hasNuke) {
      weaponType = 'nuke';
    } else if (difficulty === 'expert') {
      const rand = Math.random();
      if (rand < 0.3) {
        weaponType = 'heavy_mortar';
      } else if (rand < 0.6) {
        weaponType = 'rapid_fire';
      }
    } else if (difficulty === 'medium' && Math.random() < 0.2) {
      weaponType = 'rapid_fire';
    }

    // Helper to run binary search for a given weapon speed multiplier
    const findPower = (speedMult: number): number => {
      let minPower = 20;
      let maxPower = 250;
      let bestPower = 100;
      let closestDist = Infinity;

      for (let i = 0; i < 20; i++) {
        const midPower = (minPower + maxPower) / 2;
        const simLanding = this.physics.simulateTrajectory(aiPosition, midPower, baseAngle, this.terrain, speedMult);
        
        const distFromAiToLanding = Math.abs(simLanding.x - aiPosition.x);
        const distFromAiToTarget = Math.abs(targetPosition.x - aiPosition.x);
        
        if (Math.abs(distFromAiToLanding - distFromAiToTarget) < closestDist) {
          closestDist = Math.abs(simLanding.x - targetPosition.x);
          bestPower = midPower;
        }

        if (distFromAiToLanding < distFromAiToTarget) {
          minPower = midPower; // Undershot, need more power
        } else {
          maxPower = midPower; // Overshot, need less power
        }
      }
      return bestPower;
    };

    // Run simulation for selected weapon
    let speedMult = weaponMultipliers[weaponType];
    let bestPower = findPower(speedMult);
    let finalPower = bestPower + this.biasPower;

    // Verify if AI can afford this weapon at this power level
    const baseCost = baseCosts[weaponType];
    const dynamicCost = baseCost === 0 ? 0 : Math.round(baseCost * (finalPower / 70));

    if (aiFuel < dynamicCost) {
      // Fallback to free Small Cannon if fuel cost is too high
      weaponType = 'small_cannon';
      speedMult = weaponMultipliers.small_cannon;
      bestPower = findPower(speedMult);
      finalPower = bestPower + this.biasPower;
    }

    let finalAngle = baseAngle;

    // 4. Inject Gaussian noise depending on difficulty
    let noisePower = 0;
    let noiseAngle = 0;
    
    if (difficulty === 'easy') {
      noisePower = (Math.random() - 0.5) * 45;
      noiseAngle = (Math.random() - 0.5) * 0.25; // ~14 degrees
    } else if (difficulty === 'medium') {
      noisePower = (Math.random() - 0.5) * 20;
      noiseAngle = (Math.random() - 0.5) * 0.1; // ~6 degrees
    } else {
      noisePower = (Math.random() - 0.5) * 5;
      noiseAngle = (Math.random() - 0.5) * 0.02; // ~1 degree
    }

    finalPower = Math.max(20, Math.min(250, finalPower + noisePower));
    finalAngle = finalAngle + noiseAngle;

    return {
      power: finalPower,
      angle: finalAngle,
      weaponType: weaponType
    };
  }

  /**
   * Receives feedback from the actual shot execution to improve accuracy next turn.
   */
  public registerFeedback(landingX: number, targetX: number, aiX: number) {
    const error = Math.abs(landingX - targetX);
    if (error < 30) {
      this.lastShotResult = 'hit';
    } else {
      const targetToRight = targetX > aiX;
      if (targetToRight) {
        this.lastShotResult = landingX < targetX ? 'undershot' : 'overshot';
      } else {
        this.lastShotResult = landingX > targetX ? 'undershot' : 'overshot';
      }
    }
  }

  public resetMemory() {
    this.lastShotResult = null;
    this.biasPower = 0;
  }
}