var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Terrain } from './terrain.js';
import { PhysicsEngine } from './physics.js';
import { AIController } from './ai.js';
import { NetworkManager } from './network.js';
import { Player } from './player.js';
import { Projectile } from './projectile.js';
import { Renderer } from './renderer.js';
import { UIManager } from './ui_manager.js';
import { AudioManager } from './audio.js';
export class GameEngine {
    constructor(canvasId) {
        this.state = 'PLAYER_TURN';
        this.players = [];
        this.projectiles = [];
        this.particles = [];
        this.windParticles = [];
        this.floatingTexts = [];
        this.shockwaves = [];
        this.nanites = [];
        this.crates = [];
        this.mines = [];
        this.isMultiplayer = false;
        this.isDraggingAim = false;
        this.lastMovePublishTime = 0;
        this.lastTime = 0;
        this.accumulator = 0;
        this.TIME_STEP = 1000 / 60;
        this.aiTurnStartTime = null;
        this.difficulty = 'medium';
        this.gameMode = 'vs_ai';
        this.shakeIntensity = 0;
        this.screenFlash = 0;
        this.turnsElapsed = 0;
        // Tactical Evasion Target for AI
        this.aiMoveTargetX = null;
        this.lastLandingX = null;
        // Burst fire state
        this.burstShotsRemaining = 0;
        this.burstTimer = 0;
        this.burstDelay = 0;
        this.burstPower = 0;
        this.burstAngle = 0;
        this.burstWeapon = null;
        this.burstOwner = 'player';
        // Nuke unlock state
        this.player1HasNuke = false;
        this.player2HasNuke = false;
        // Audio movement looping guard
        this.audioMovePlaying = false;
        this.playerMovedThisTurn = false;
        this.localReadyForRematch = false;
        this.remoteReadyForRematch = false;
        // Mobile detection & fullscreen state
        this.isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
        this.hasRequestedFullscreen = false;
        this.touchAimHintShown = false;
        // Weapon templates
        this.weapons = {
            small_cannon: {
                type: 'small_cannon',
                name: 'Small Cannon',
                damage: 30,
                fuelCost: 0,
                radius: 35,
                projectileRadius: 4,
                speedMultiplier: 0.10,
                burstCount: 1,
                burstDelay: 0
            },
            heavy_mortar: {
                type: 'heavy_mortar',
                name: 'Heavy Mortar',
                damage: 60,
                fuelCost: 25,
                radius: 65,
                projectileRadius: 8,
                speedMultiplier: 0.075,
                burstCount: 1,
                burstDelay: 0
            },
            rapid_fire: {
                type: 'rapid_fire',
                name: 'Rapid Fire',
                damage: 18,
                fuelCost: 15,
                radius: 22,
                projectileRadius: 3,
                speedMultiplier: 0.10,
                burstCount: 3,
                burstDelay: 180
            },
            dirt_spreader: {
                type: 'dirt_spreader',
                name: 'Dirt Spreader',
                damage: 0,
                fuelCost: 20,
                radius: 40,
                projectileRadius: 5,
                speedMultiplier: 0.085,
                burstCount: 1,
                burstDelay: 0
            },
            nuke: {
                type: 'nuke',
                name: 'Tactical Nuke',
                damage: 100,
                fuelCost: 35,
                radius: 125,
                projectileRadius: 10,
                speedMultiplier: 0.07,
                burstCount: 1,
                burstDelay: 0
            },
            cluster_bomb: {
                type: 'cluster_bomb',
                name: 'Cluster Bomb',
                damage: 25,
                fuelCost: 20,
                radius: 40,
                projectileRadius: 6,
                speedMultiplier: 0.09,
                burstCount: 1,
                burstDelay: 0
            },
            bouncing_grenade: {
                type: 'bouncing_grenade',
                name: 'Bouncing Grenade',
                damage: 40,
                fuelCost: 15,
                radius: 45,
                projectileRadius: 5,
                speedMultiplier: 0.085,
                burstCount: 1,
                burstDelay: 0
            }
        };
        const canvas = document.getElementById(canvasId);
        canvas.width = 1024;
        canvas.height = 576;
        this.config = {
            canvasWidth: 1024,
            canvasHeight: 576,
            gravity: 0.15,
            wind: { x: 0, y: 0 }
        };
        this.renderer = new Renderer(canvasId, this.config);
        this.uiManager = new UIManager();
        this.audio = new AudioManager();
        this.physics = new PhysicsEngine(this.config);
        this.terrain = new Terrain(this.config.canvasWidth, this.config.canvasHeight);
        this.ai = new AIController(this.config, this.terrain);
        this.initGame();
        this.setupEventListeners();
        this.setupLobbyHandlers();
        this.setupTouchControls();
        this.setupFullscreenButton();
        // Start main game loop
        requestAnimationFrame((t) => this.gameLoop(t));
    }
    initGame(seed) {
        this.players = [];
        this.projectiles = [];
        this.particles = [];
        this.floatingTexts = [];
        this.crates = [];
        this.mines = [];
        this.windParticles = [];
        this.shockwaves = [];
        // Populate wind-responsive nanites
        this.nanites = [];
        for (let i = 0; i < 40; i++) {
            this.nanites.push({
                x: Math.random() * this.config.canvasWidth,
                y: Math.random() * this.config.canvasHeight,
                size: Math.random() * 1.5 + 0.5,
                speedY: -(Math.random() * 0.4 + 0.1),
                phase: Math.random() * Math.PI * 2
            });
        }
        this.shakeIntensity = 0;
        this.burstShotsRemaining = 0;
        this.turnsElapsed = 0;
        this.player1HasNuke = false;
        this.player2HasNuke = false;
        this.lastLandingX = null;
        this.aiMoveTargetX = null;
        this.state = 'PLAYER_TURN';
        this.playerMovedThisTurn = false;
        this.localReadyForRematch = false;
        this.remoteReadyForRematch = false;
        this.screenFlash = 0;
        this.ai.resetMemory();
        // Re-initialize terrain
        const activeSeed = seed !== null && seed !== void 0 ? seed : Math.floor(Math.random() * 1000000);
        this.terrain = new Terrain(this.config.canvasWidth, this.config.canvasHeight, activeSeed);
        this.ai = new AIController(this.config, this.terrain);
        // Place player tanks on the terrain
        const p1X = 150;
        const p1Y = this.terrain.getHeight(p1X) - 15;
        const p1 = new Player('Player 1', 'player', { x: p1X, y: p1Y }, 100, 100);
        p1.weapon = Object.assign({}, this.weapons.small_cannon);
        this.players.push(p1);
        const p2X = this.config.canvasWidth - 150;
        const p2Y = this.terrain.getHeight(p2X) - 15;
        const p2 = new Player(this.gameMode === 'pvp' ? 'Player 2' : 'AI Opponent', 'ai', { x: p2X, y: p2Y }, 100, 100);
        p2.weapon = Object.assign({}, this.weapons.small_cannon);
        this.players.push(p2);
        // Setup landmines (2 mines)
        this.spawnMine(250 + Math.random() * 150);
        this.spawnMine(this.config.canvasWidth - 400 + Math.random() * 150);
        // Populate wind particles across the sky
        for (let i = 0; i < 25; i++) {
            this.windParticles.push({
                x: Math.random() * this.config.canvasWidth,
                y: Math.random() * 200 + 40
            });
        }
        // Lock nuke option on the weapon dropdown
        const nukeOpt = document.getElementById('opt-nuke');
        if (nukeOpt)
            nukeOpt.disabled = true;
        this.randomizeWind();
        this.uiManager.hideGameOver();
        this.uiManager.logMessage("Battle initiated. Adjust sliders and deploy fire!");
        this.updateSliderOutputs();
        // Show one-time touch-aim hint on mobile
        this.showTouchAimHint();
    }
    spawnMine(x) {
        const y = this.terrain.getHeight(x);
        this.mines.push({
            position: { x, y },
            isActive: true
        });
    }
    spawnSupplyCrate() {
        const x = Math.random() * (this.config.canvasWidth - 300) + 150;
        const typeRand = Math.random();
        const type = typeRand < 0.4 ? 'heal' : typeRand < 0.85 ? 'fuel' : 'nuke';
        this.crates.push({
            id: `crate-${Date.now()}`,
            position: { x, y: 0 },
            velocity: { x: 0, y: 1.2 }, // slow falling
            type,
            isActive: true
        });
        this.uiManager.logMessage(`A supply drop is parachuting in containing a ${type.toUpperCase()} crate!`);
    }
    setupEventListeners() {
        // Fire button
        const fireBtn = document.getElementById('fire-button');
        fireBtn === null || fireBtn === void 0 ? void 0 : fireBtn.addEventListener('click', () => this.handleFire());
        // Restart button
        const restartBtn = document.getElementById('restart-button');
        restartBtn === null || restartBtn === void 0 ? void 0 : restartBtn.addEventListener('click', () => {
            if (this.isMultiplayer) {
                this.localReadyForRematch = true;
                const btn = document.getElementById('restart-button');
                if (btn) {
                    btn.innerText = "WAITING FOR OPPONENT...";
                    btn.disabled = true;
                }
                this.network.sendEvent('rematch_ready', {});
                this.checkTriggerRematch();
            }
            else {
                this.initGame();
            }
        });
        // Sliders updates
        const powerSlider = document.getElementById('power-slider');
        const angleSlider = document.getElementById('angle-slider');
        powerSlider === null || powerSlider === void 0 ? void 0 : powerSlider.addEventListener('input', () => this.updateSliderOutputs());
        angleSlider === null || angleSlider === void 0 ? void 0 : angleSlider.addEventListener('input', () => this.updateSliderOutputs());
        // Weapon selection
        const weaponSelector = document.getElementById('weapon-selector');
        weaponSelector === null || weaponSelector === void 0 ? void 0 : weaponSelector.addEventListener('change', (e) => {
            const type = e.target.value;
            const activePlayer = this.getActivePlayer();
            if (activePlayer && this.weapons[type]) {
                activePlayer.weapon = Object.assign({}, this.weapons[type]);
                this.uiManager.logMessage(`Selected Weapon: ${activePlayer.weapon.name}`);
            }
        });
        // Difficulty selection
        const diffSelector = document.getElementById('difficulty-selector');
        diffSelector === null || diffSelector === void 0 ? void 0 : diffSelector.addEventListener('change', (e) => {
            this.difficulty = e.target.value;
            this.uiManager.logMessage(`AI Level set to ${this.difficulty.toUpperCase()}`);
        });
        // Mode selection
        const modeSelector = document.getElementById('mode-selector');
        modeSelector === null || modeSelector === void 0 ? void 0 : modeSelector.addEventListener('change', (e) => {
            this.gameMode = e.target.value;
            const diffGroup = document.getElementById('difficulty-group');
            if (diffGroup) {
                diffGroup.classList.toggle('hidden', this.gameMode === 'pvp');
            }
            this.initGame();
            this.uiManager.logMessage(`Game Mode set to ${this.gameMode === 'pvp' ? 'Local PvP' : 'vs AI'}`);
        });
        // Keyboard driving movement listeners
        window.addEventListener('keydown', (e) => {
            if (!this.isMyTurnLocal())
                return;
            const player = this.getActivePlayer();
            if (!player || player.fuel <= 0)
                return;
            const moveAmount = 2.0;
            const fuelCost = 0.5;
            // Start movement hum
            if (!this.audioMovePlaying) {
                this.audio.startMove();
                this.audioMovePlaying = true;
            }
            if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
                // Enforce horizontal bounds depending on player side
                const minBound = player.type === 'player' ? 25 : this.config.canvasWidth / 2 + 50;
                const newX = Math.max(minBound, player.position.x - moveAmount);
                if (newX !== player.position.x) {
                    player.position.x = newX;
                    player.fuel = Math.max(0, player.fuel - fuelCost);
                    this.playerMovedThisTurn = true;
                    player.update(this.terrain);
                    this.sendMoveEventThrottled(player.position.x);
                }
            }
            else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
                const maxBound = player.type === 'player' ? this.config.canvasWidth / 2 - 50 : this.config.canvasWidth - 25;
                const newX = Math.min(maxBound, player.position.x + moveAmount);
                if (newX !== player.position.x) {
                    player.position.x = newX;
                    player.fuel = Math.max(0, player.fuel - fuelCost);
                    this.playerMovedThisTurn = true;
                    player.update(this.terrain);
                    this.sendMoveEventThrottled(player.position.x);
                }
            }
        });
        window.addEventListener('keyup', (e) => {
            if (['a', 'A', 'd', 'D', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                this.audio.stopMove();
                this.audioMovePlaying = false;
                if (this.isMultiplayer) {
                    const player = this.getActivePlayer();
                    if (player) {
                        this.sendMoveEventThrottled(player.position.x, true); // force final sync
                    }
                }
            }
        });
        const startMusicOnInteraction = () => {
            this.audio.startMusic();
            window.removeEventListener('click', startMusicOnInteraction);
            window.removeEventListener('keydown', startMusicOnInteraction);
        };
        window.addEventListener('click', startMusicOnInteraction);
        window.addEventListener('keydown', startMusicOnInteraction);
    }
    getActivePlayer() {
        return this.state === 'PLAYER_TURN' ? this.players[0] : this.players[1];
    }
    getDynamicFuelCost(weaponType, power) {
        const baseCost = this.weapons[weaponType].fuelCost;
        if (baseCost === 0)
            return 0;
        return Math.round(baseCost * (power / 70));
    }
    updateWeaponDropdownCosts(power) {
        const activePlayer = this.getActivePlayer();
        const select = document.getElementById('weapon-selector');
        if (!select)
            return;
        for (let i = 0; i < select.options.length; i++) {
            const option = select.options[i];
            const type = option.value;
            const baseWeapon = this.weapons[type];
            if (baseWeapon) {
                const cost = this.getDynamicFuelCost(type, power);
                if (cost === 0) {
                    option.text = `${baseWeapon.name} (FREE)`;
                }
                else {
                    let detail = '';
                    if (type === 'nuke') {
                        const hasNuke = activePlayer.type === 'player' ? this.player1HasNuke : this.player2HasNuke;
                        detail = !hasNuke ? ' [LOCKED]' : '';
                    }
                    else if (type === 'rapid_fire') {
                        detail = ' [3 Burst]';
                    }
                    else if (type === 'dirt_spreader') {
                        detail = ' [Terraform]';
                    }
                    else if (type === 'bouncing_grenade') {
                        detail = ' [3 Bounces]';
                    }
                    else if (type === 'cluster_bomb') {
                        detail = ' [Air-Burst]';
                    }
                    option.text = `${baseWeapon.name}${detail} (${cost} Fuel)`;
                }
            }
        }
    }
    updateSliderOutputs() {
        var _a, _b;
        const power = parseInt(((_a = document.getElementById('power-slider')) === null || _a === void 0 ? void 0 : _a.value) || '70');
        const angle = parseInt(((_b = document.getElementById('angle-slider')) === null || _b === void 0 ? void 0 : _b.value) || '45');
        this.uiManager.updateSliders(power, angle);
        this.updateWeaponDropdownCosts(power);
        const activePlayer = this.getActivePlayer();
        if (activePlayer) {
            // Map angles: P2 faces left, so standard angles are flipped in radians
            if (activePlayer.type === 'ai' && this.gameMode === 'pvp') {
                // Player 2 aiming (aiming leftwards primarily, so map slider 0-180 flipped)
                activePlayer.aimAngle = Math.PI - (angle * Math.PI) / 180;
            }
            else {
                activePlayer.aimAngle = (angle * Math.PI) / 180;
            }
            activePlayer.aimPower = power;
        }
    }
    synchronizeSliders(player) {
        // Synchronize DOM sliders to match the next player's stored aiming
        const powerSlider = document.getElementById('power-slider');
        const angleSlider = document.getElementById('angle-slider');
        if (powerSlider && angleSlider) {
            powerSlider.value = player.aimPower.toString();
            let angleDeg = Math.round((player.aimAngle * 180) / Math.PI);
            if (player.type === 'ai' && this.gameMode === 'pvp') {
                angleDeg = Math.round(((Math.PI - player.aimAngle) * 180) / Math.PI);
            }
            angleSlider.value = angleDeg.toString();
            this.uiManager.updateSliders(player.aimPower, angleDeg);
            this.updateWeaponDropdownCosts(player.aimPower);
            // Update weapon selection dropdown representation
            const select = document.getElementById('weapon-selector');
            if (select) {
                select.value = player.weapon.type;
                // Lock/unlock nuke option based on whether player collected it
                const nukeOpt = document.getElementById('opt-nuke');
                if (nukeOpt) {
                    const hasNuke = player.type === 'player' ? this.player1HasNuke : this.player2HasNuke;
                    nukeOpt.disabled = !hasNuke;
                }
            }
        }
    }
    randomizeWind() {
        this.config.wind.x = (Math.random() - 0.5) * 2.0;
    }
    handleFire() {
        // Prevent firing if projectiles are in flight or it is not my turn
        if (!this.isMyTurnLocal())
            return;
        const player = this.getActivePlayer();
        if (!player)
            return;
        const weapon = player.weapon;
        const dynamicCost = this.getDynamicFuelCost(weapon.type, player.aimPower);
        if (player.fuel < dynamicCost) {
            this.uiManager.logMessage("INSUFFICIENT FUEL! Need " + dynamicCost + " units.");
            return;
        }
        player.fuel -= dynamicCost;
        if (this.isMultiplayer) {
            this.network.sendEvent('fire', {
                power: player.aimPower,
                angle: player.aimAngle,
                weaponType: weapon.type
            });
        }
        // Trigger physical recoil kickback & chassis tilt
        const recoilKick = weapon.type === 'nuke' ? 14 : weapon.type === 'heavy_mortar' ? 10 : 6;
        player.recoilOffset = recoilKick;
        player.recoilAngle = -0.15;
        // Set up burst sequence
        this.burstOwner = player.type;
        this.burstPower = player.aimPower;
        this.burstAngle = player.aimAngle;
        this.burstWeapon = weapon;
        this.burstShotsRemaining = weapon.burstCount;
        this.burstDelay = weapon.burstDelay;
        this.burstTimer = 0;
        this.state = 'PROJECTILE_FLIGHT';
        this.fireSingleProjectile();
    }
    fireSingleProjectile() {
        if (!this.burstWeapon)
            return;
        const owner = this.burstOwner === 'player' ? this.players[0] : this.players[1];
        const spawnPos = { x: owner.position.x, y: owner.position.y - 18 };
        const speed = this.burstPower * this.burstWeapon.speedMultiplier * (this.config.canvasWidth / 1024);
        const velocity = {
            x: Math.cos(this.burstAngle) * speed,
            y: -Math.sin(this.burstAngle) * speed
        };
        const projectile = new Projectile(`proj-${Date.now()}-${Math.random()}`, this.burstOwner, spawnPos, velocity, this.burstWeapon.damage, this.burstWeapon.radius, this.burstWeapon.projectileRadius, this.burstWeapon.type);
        this.projectiles.push(projectile);
        // Play fire thud sound!
        this.audio.playFire();
        this.uiManager.logMessage(`${owner.id} deployed ${this.burstWeapon.name}!`);
        this.burstShotsRemaining--;
        // Consume the lock if the Tactical Nuke was fired
        if (this.burstWeapon.type === 'nuke') {
            if (this.burstOwner === 'player') {
                this.player1HasNuke = false;
            }
            else {
                this.player2HasNuke = false;
            }
            // Select Small Cannon automatically next
            owner.weapon = Object.assign({}, this.weapons.small_cannon);
            this.synchronizeSliders(owner);
        }
    }
    triggerExplosion(x, y, radius, damage, owner) {
        var _a, _b, _c;
        const isDirtSpreader = ((_a = this.burstWeapon) === null || _a === void 0 ? void 0 : _a.type) === 'dirt_spreader';
        // 1. Screenshake trigger & Screen flash
        this.shakeIntensity = Math.min(24, this.shakeIntensity + radius * 0.18);
        this.screenFlash = Math.min(0.65, radius * 0.008);
        // 2. Modify terrain (build up or carve out)
        if (isDirtSpreader) {
            this.terrain.addDirt(x, y, radius);
        }
        else {
            this.terrain.deform(x, y, radius);
        }
        // Play synthesized lowpass rumble audio!
        this.audio.playExplosion(radius);
        // Save blast coordinate for AI evasion
        this.lastLandingX = x;
        // 3. Generate particles
        for (let i = 0; i < 35; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 5 + 1.5;
            let color = '#fbbf24';
            if (isDirtSpreader) {
                color = Math.random() > 0.5 ? '#10b981' : Math.random() > 0.3 ? '#854d0e' : '#047857'; // Greens & Browns
            }
            else {
                const colorRand = Math.random();
                color = colorRand > 0.6 ? '#f59e0b' : colorRand > 0.25 ? '#ef4444' : '#f97316';
            }
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color,
                size: Math.random() * 4 + 2,
                alpha: 1,
                decay: Math.random() * 0.035 + 0.015
            });
        }
        // Spawn expanding vector shockwave ring
        let shockwaveColor = isDirtSpreader ? 'rgba(52, 211, 153, ' : 'rgba(251, 146, 60, ';
        if (((_b = this.burstWeapon) === null || _b === void 0 ? void 0 : _b.type) === 'nuke') {
            shockwaveColor = 'rgba(253, 224, 71, '; // yellow
        }
        else if (((_c = this.burstWeapon) === null || _c === void 0 ? void 0 : _c.type) === 'bouncing_grenade') {
            shockwaveColor = 'rgba(192, 132, 252, '; // purple
        }
        this.shockwaves.push({
            x,
            y,
            radius: 4,
            maxRadius: radius * 1.6,
            alpha: 0.95,
            color: shockwaveColor
        });
        // 4. Register AI feedback if AI fired
        if (owner === 'ai' && this.gameMode === 'vs_ai') {
            const target = this.players[0];
            const ai = this.players[1];
            this.ai.registerFeedback(x, target.position.x, ai.position.x);
        }
        // 5. Calculate splash damage to players
        this.players.forEach(player => {
            const dx = player.position.x - x;
            const dy = player.position.y - 10 - y; // offset to tank center
            const dist = Math.sqrt(dx * dx + dy * dy);
            const effectiveRadius = radius + 20; // tank width buffer
            if (dist < effectiveRadius) {
                const falloff = 1 - (dist / effectiveRadius);
                const actualDamage = Math.round(damage * falloff);
                if (actualDamage > 0) {
                    player.takeDamage(actualDamage);
                    this.createFloatingText(player.position.x, player.position.y - 40, `-${actualDamage} HP`, '#ef4444');
                    this.uiManager.logMessage(`${player.id} took ${actualDamage} splash damage.`);
                }
            }
        });
        // 6. Check landmines caught in the explosion blast radius
        for (let i = this.mines.length - 1; i >= 0; i--) {
            const mine = this.mines[i];
            if (!mine.isActive)
                continue;
            const dist = Math.sqrt(Math.pow(mine.position.x - x, 2) +
                Math.pow(mine.position.y - y, 2));
            // Trigger chain explosion if mine is caught in the blast radius
            if (dist < radius) {
                mine.isActive = false;
                this.createFloatingText(mine.position.x, mine.position.y - 15, `CHAIN DETONATION!`, '#ef4444');
                this.triggerExplosion(mine.position.x, mine.position.y, 45, 30, owner);
                this.mines.splice(i, 1);
            }
        }
        this.checkGameOver();
    }
    createFloatingText(x, y, text, color) {
        this.floatingTexts.push({
            x,
            y,
            text,
            color,
            alpha: 1,
            vy: -1.2
        });
    }
    checkGameOver() {
        const player = this.players[0];
        const ai = this.players[1];
        if (player.health <= 0 || ai.health <= 0) {
            this.state = 'GAME_OVER';
            // Determine winner from the LOCAL player's perspective
            let winner;
            if (this.isMultiplayer) {
                // Host controls players[0], guest controls players[1]
                const localPlayer = this.network.role === 'host' ? player : ai;
                winner = localPlayer.health > 0 ? 'player' : 'ai';
            }
            else {
                winner = player.health > 0 ? 'player' : 'ai';
            }
            this.uiManager.showGameOver(winner);
            this.uiManager.logMessage(`GAME OVER. ${winner === 'player' ? 'YOU ARE' : 'OPPONENT IS'} VICTORIOUS!`);
            if (this.isMultiplayer) {
                this.network.resetForRematch();
                this.localReadyForRematch = false;
                this.remoteReadyForRematch = false;
            }
        }
    }
    gameLoop(timestamp = 0) {
        if (!this.lastTime)
            this.lastTime = timestamp;
        let elapsed = timestamp - this.lastTime;
        this.lastTime = timestamp;
        if (elapsed > 250)
            elapsed = 250; // Cap to prevent lag spikes
        this.accumulator += elapsed;
        while (this.accumulator >= this.TIME_STEP) {
            this.updatePhysics();
            this.accumulator -= this.TIME_STEP;
        }
        this.draw();
        requestAnimationFrame((t) => this.gameLoop(t));
    }
    updatePhysics() {
        var _a, _b;
        // 1. Update players physics (tanks falling & remote position interpolation)
        this.players.forEach(p => {
            if (this.isMultiplayer && p.targetX !== null) {
                const isRemote = (this.network.role === 'host' && p.type === 'ai') ||
                    (this.network.role === 'guest' && p.type === 'player');
                if (isRemote) {
                    const dx = p.targetX - p.position.x;
                    if (Math.abs(dx) > 0.05) {
                        p.position.x += dx * 0.22; // glide smoothly towards targetX (22% per 60Hz step)
                    }
                    else {
                        p.position.x = p.targetX;
                        p.targetX = null;
                    }
                }
            }
            p.update(this.terrain);
        });
        // 2. Animate AI tactical movement if active
        if (this.state === 'ENEMY_TURN' && this.gameMode === 'vs_ai' && this.aiMoveTargetX !== null) {
            const ai = this.players[1];
            const step = 1.5;
            const dist = this.aiMoveTargetX - ai.position.x;
            if (Math.abs(dist) > step) {
                ai.position.x += Math.sign(dist) * step;
                ai.update(this.terrain);
                // Start engine hum for AI relocation once
                if (!this.audioMovePlaying) {
                    this.audio.startMove();
                    this.audioMovePlaying = true;
                }
            }
            else {
                // Evasion arrived
                ai.position.x = this.aiMoveTargetX;
                this.aiMoveTargetX = null;
                this.audio.stopMove();
                this.audioMovePlaying = false;
            }
        }
        // 3. Update parachute supply crates
        for (let i = this.crates.length - 1; i >= 0; i--) {
            const crate = this.crates[i];
            if (!crate.isActive)
                continue;
            // Drop update
            if (crate.velocity.y > 0) {
                crate.position.y += crate.velocity.y;
                const groundHeight = this.terrain.getHeight(crate.position.x);
                if (crate.position.y >= groundHeight - 10) {
                    crate.position.y = groundHeight - 10;
                    crate.velocity.y = 0; // landed
                }
            }
            // Check pickup bounds with player tanks
            for (const player of this.players) {
                const dist = Math.sqrt(Math.pow(crate.position.x - player.position.x, 2) +
                    Math.pow(crate.position.y - player.position.y, 2));
                if (dist < 26) {
                    crate.isActive = false;
                    this.audio.playCollect();
                    if (crate.type === 'heal') {
                        player.health = Math.min(player.maxHealth, player.health + 30);
                        this.createFloatingText(player.position.x, player.position.y - 45, `+30 HP`, '#10b981');
                        this.uiManager.logMessage(`${player.id} picked up a Repair Crate (+30 HP)`);
                    }
                    else if (crate.type === 'fuel') {
                        player.fuel = Math.min(player.maxFuel, player.fuel + 50);
                        this.createFloatingText(player.position.x, player.position.y - 45, `+50 Fuel`, '#3b82f6');
                        this.uiManager.logMessage(`${player.id} picked up a Fuel Crate (+50 Fuel)`);
                    }
                    else if (crate.type === 'nuke') {
                        if (player.type === 'player') {
                            this.player1HasNuke = true;
                        }
                        else {
                            this.player2HasNuke = true;
                        }
                        this.createFloatingText(player.position.x, player.position.y - 45, `NUKE UNLOCKED!`, '#fbbf24');
                        this.uiManager.logMessage(`${player.id} collected a TACTICAL NUKE! Select from dropdown to deploy.`);
                        // Sync HUD options
                        this.synchronizeSliders(this.getActivePlayer());
                    }
                    this.crates.splice(i, 1);
                    break;
                }
            }
        }
        // 4. Update landmines trigger collision
        for (let i = this.mines.length - 1; i >= 0; i--) {
            const mine = this.mines[i];
            if (!mine.isActive)
                continue;
            for (const player of this.players) {
                const dist = Math.abs(player.position.x - mine.position.x);
                // Explode if a tank drives over the mine
                if (dist < 20) {
                    mine.isActive = false;
                    this.createFloatingText(mine.position.x, mine.position.y - 20, `LANDMINE DETONATION!`, '#ef4444');
                    this.triggerExplosion(mine.position.x, mine.position.y, 50, 35, player.type);
                    this.mines.splice(i, 1);
                    break;
                }
            }
        }
        // 5. Decay screenshake & screen flash
        if (this.shakeIntensity > 0) {
            this.shakeIntensity = Math.max(0, this.shakeIntensity - 0.45);
        }
        if (this.screenFlash > 0) {
            this.screenFlash = Math.max(0, this.screenFlash - 0.045);
        }
        // 6. Update environmental wind particles
        this.windParticles.forEach(part => {
            part.x += this.config.wind.x * 6 + 0.4;
            if (part.x < 0) {
                part.x = this.config.canvasWidth;
                part.y = Math.random() * 200 + 40;
            }
            else if (part.x > this.config.canvasWidth) {
                part.x = 0;
                part.y = Math.random() * 200 + 40;
            }
        });
        // 7. Update floating damage texts
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const text = this.floatingTexts[i];
            text.y += text.vy;
            text.alpha -= 0.02;
            if (text.alpha <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }
        // 8. Update explosion particles with bouncing physics
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const part = this.particles[i];
            part.x += part.vx;
            part.y += part.vy;
            part.vy += 0.075; // gravity pull
            part.alpha -= part.decay;
            // Bouncing sparks on terrain collision
            const groundY = this.terrain.getHeight(part.x);
            if (part.y >= groundY) {
                part.y = groundY - 1;
                part.vy = -part.vy * 0.45; // reverse and dampen vertical velocity
                part.vx = part.vx * 0.65; // dampen horizontal friction sliding
            }
            if (part.alpha <= 0) {
                this.particles.splice(i, 1);
            }
        }
        // Update shockwaves
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const wave = this.shockwaves[i];
            const growth = (wave.maxRadius - wave.radius) * 0.15 + 1.0;
            wave.radius += growth;
            wave.alpha -= 0.035;
            if (wave.alpha <= 0 || wave.radius >= wave.maxRadius) {
                this.shockwaves.splice(i, 1);
            }
        }
        // Update floating nanites drift
        this.nanites.forEach(n => {
            n.y += n.speedY;
            n.x += this.config.wind.x * 2.5 + Math.sin(n.phase + Date.now() / 800) * 0.22;
            // Wrap-around screen bounds
            if (n.y < 0) {
                n.y = this.config.canvasHeight;
                n.x = Math.random() * this.config.canvasWidth;
            }
            if (n.x < 0) {
                n.x = this.config.canvasWidth;
            }
            else if (n.x > this.config.canvasWidth) {
                n.x = 0;
            }
        });
        // 9. Coordinate projectiles flight
        if (this.state === 'PROJECTILE_FLIGHT') {
            let projectileStillActive = false;
            for (let i = this.projectiles.length - 1; i >= 0; i--) {
                const p = this.projectiles[i];
                if (!p.isActive)
                    continue;
                projectileStillActive = true;
                // Sub-stepping
                const speed = Math.sqrt(p.velocity.x * p.velocity.x + p.velocity.y * p.velocity.y);
                const subSteps = Math.ceil(speed / 2.0);
                const dt = 1.0 / subSteps;
                for (let s = 0; s < subSteps; s++) {
                    const prevVy = p.velocity.y;
                    p.position = this.physics.updateProjectile(p.position, p.velocity, dt);
                    p.addTrailPoint();
                    // Spawn trailing exhaust sparks
                    if (Math.random() < 0.25) {
                        const sparkAngle = Math.random() * Math.PI * 2;
                        const sparkSpeed = Math.random() * 0.8;
                        this.particles.push({
                            x: p.position.x,
                            y: p.position.y,
                            vx: -p.velocity.x * 0.12 + Math.cos(sparkAngle) * sparkSpeed,
                            vy: -p.velocity.y * 0.12 - Math.random() * 0.5,
                            color: p.type === 'nuke' ? '#f59e0b' : p.type === 'bouncing_grenade' ? '#c084fc' : p.type === 'dirt_spreader' ? '#34d399' : '#f97316',
                            size: Math.random() * 1.5 + 0.6,
                            alpha: 0.8,
                            decay: Math.random() * 0.04 + 0.02
                        });
                    }
                    // 1. Terrain Collision / Bounce check
                    const terrainHeight = this.terrain.getHeight(p.position.x);
                    if (p.position.y >= terrainHeight) {
                        if (p.type === 'bouncing_grenade' && p.bouncesRemaining > 0) {
                            p.bouncesRemaining--;
                            // Bounce: reverse and dampen Y speed, dampen X speed
                            p.velocity.y = -p.velocity.y * 0.55;
                            p.velocity.x = p.velocity.x * 0.65;
                            p.position.y = terrainHeight - 2; // snap slightly higher
                            this.audio.playBounce();
                            // Spawn tiny purple bouncing sparks
                            for (let sp = 0; sp < 6; sp++) {
                                this.particles.push({
                                    x: p.position.x,
                                    y: p.position.y,
                                    vx: (Math.random() - 0.5) * 4,
                                    vy: -Math.random() * 3 - 1,
                                    color: '#c084fc',
                                    size: Math.random() * 2 + 1,
                                    alpha: 1,
                                    decay: 0.035
                                });
                            }
                            break; // break sub-stepping for this frame to continue flight next frame
                        }
                        else {
                            // Direct detonation
                            p.isActive = false;
                            this.triggerExplosion(p.position.x, terrainHeight, p.radius, p.damage, p.owner);
                            break;
                        }
                    }
                    // 2. Direct Tank Collision check
                    let hitTank = false;
                    for (const player of this.players) {
                        if (p.owner === player.type)
                            continue; // no self-collision
                        const dist = Math.sqrt(Math.pow(p.position.x - player.position.x, 2) +
                            Math.pow(p.position.y - (player.position.y - 10), 2));
                        if (dist < p.projectileRadius + 18) {
                            p.isActive = false;
                            hitTank = true;
                            this.triggerExplosion(p.position.x, p.position.y, p.radius, p.damage, p.owner);
                            break;
                        }
                    }
                    if (hitTank)
                        break;
                    // 3. Side Boundary Bounce / Off-screen check
                    if (p.position.x <= 5 || p.position.x >= this.config.canvasWidth - 5) {
                        if (p.type === 'bouncing_grenade' && p.bouncesRemaining > 0) {
                            p.bouncesRemaining--;
                            p.velocity.x = -p.velocity.x * 0.65;
                            p.position.x = p.position.x <= 5 ? 6 : this.config.canvasWidth - 6;
                            this.audio.playBounce();
                            break;
                        }
                        else {
                            p.isActive = false;
                            break;
                        }
                    }
                    if (p.position.y > this.config.canvasHeight) {
                        p.isActive = false;
                        break;
                    }
                    // 4. Mid-air Apex Burst for Cluster Bombs
                    if (p.type === 'cluster_bomb' && !p.wasSplit) {
                        // Apex check: Y speed changed from upward (negative) to downward (positive)
                        if (p.velocity.y >= 0 && prevVy < 0) {
                            p.wasSplit = true;
                            p.isActive = false;
                            // Spawn 3 smaller bomblets
                            const offsets = [-1.8, 0, 1.8];
                            for (let c = 0; c < 3; c++) {
                                const subShell = new Projectile(`proj-sub-${Date.now()}-${c}-${Math.random()}`, p.owner, Object.assign({}, p.position), { x: p.velocity.x + offsets[c], y: 1.0 }, // push slightly downwards
                                this.weapons.cluster_bomb.damage, this.weapons.cluster_bomb.radius, this.weapons.cluster_bomb.projectileRadius, 'cluster_sub');
                                this.projectiles.push(subShell);
                            }
                            this.audio.playBounce(); // chirp sound
                            this.createFloatingText(p.position.x, p.position.y - 20, "AIR-BURST SPLIT!", '#fda4af');
                            this.uiManager.logMessage("Cluster Bomb split into bomblets in mid-air!");
                            break;
                        }
                    }
                }
            }
            this.projectiles = this.projectiles.filter(p => p.isActive);
            // Transition turn if flight resolves
            if (!projectileStillActive) {
                if (this.burstShotsRemaining > 0) {
                    this.fireSingleProjectile();
                }
                else {
                    if (this.state !== 'GAME_OVER') {
                        const isMyTurnBeforeSwitch = (((_a = this.network) === null || _a === void 0 ? void 0 : _a.role) === 'host' && this.state === 'PLAYER_TURN') ||
                            (((_b = this.network) === null || _b === void 0 ? void 0 : _b.role) === 'guest' && this.state === 'ENEMY_TURN') ||
                            !this.isMultiplayer;
                        this.turnsElapsed++;
                        // Host coordinates environmental randomness
                        if (this.isMultiplayer && this.network.role === 'host') {
                            // Supply drop every 4 turns
                            if (this.turnsElapsed % 4 === 0) {
                                const crateType = Math.random() < 0.45 ? 'heal' : Math.random() < 0.82 ? 'fuel' : 'nuke';
                                const x = 150 + Math.random() * (this.config.canvasWidth - 300);
                                this.spawnSupplyCrateSpecific(x, crateType);
                                this.network.sendEvent('crate_drop', { x, crateType });
                            }
                            // Spawn landmine on random terrain every 6 turns
                            if (this.turnsElapsed % 6 === 0) {
                                const x = 200 + Math.random() * (this.config.canvasWidth - 400);
                                this.spawnMine(x);
                                this.network.sendEvent('mine_spawn', { x });
                            }
                            // Shift turns and randomize wind
                            this.randomizeWind();
                            this.network.sendEvent('wind_sync', { windX: this.config.wind.x });
                        }
                        else if (!this.isMultiplayer) {
                            // Local/AI standard random logic
                            if (this.turnsElapsed % 4 === 0) {
                                this.spawnSupplyCrate();
                            }
                            if (this.turnsElapsed % 6 === 0) {
                                this.spawnMine(200 + Math.random() * (this.config.canvasWidth - 400));
                            }
                            this.randomizeWind();
                        }
                        // Shift turns
                        if (this.state === 'PLAYER_TURN') {
                            this.state = 'ENEMY_TURN';
                            this.aiTurnStartTime = null;
                            this.playerMovedThisTurn = false;
                            if (this.isMultiplayer) {
                                this.uiManager.logMessage("Opponent's Turn.");
                            }
                            else if (this.gameMode === 'vs_ai') {
                                this.uiManager.logMessage("Enemy Turn initiated.");
                            }
                            else {
                                this.uiManager.logMessage("Player 2 Turn initiated. Wind has shifted.");
                            }
                        }
                        else {
                            this.state = 'PLAYER_TURN';
                            this.playerMovedThisTurn = false;
                            if (this.isMultiplayer) {
                                this.uiManager.logMessage("Your Turn.");
                            }
                            else {
                                this.uiManager.logMessage("Player 1 Turn initiated. Wind has shifted.");
                            }
                        }
                        // Sync turn switch from client to client
                        if (this.isMultiplayer && isMyTurnBeforeSwitch) {
                            this.network.sendEvent('turn_end', {});
                        }
                        // Calculate and apply fuel replenishment for the player who just finished their turn
                        const lastActivePlayer = this.burstOwner === 'player' ? this.players[0] : this.players[1];
                        const fuelGain = 20 + (this.playerMovedThisTurn ? 0 : 15);
                        lastActivePlayer.fuel = Math.min(lastActivePlayer.maxFuel, lastActivePlayer.fuel + fuelGain);
                        const rechargeMsg = this.playerMovedThisTurn
                            ? `+20 Fuel`
                            : `+35 Fuel (Stationary Bonus)`;
                        const rechargeColor = lastActivePlayer.type === 'player' ? '#3b82f6' : '#ef4444';
                        this.createFloatingText(lastActivePlayer.position.x, lastActivePlayer.position.y - 45, rechargeMsg, rechargeColor);
                        this.uiManager.logMessage(`${lastActivePlayer.id} recharged: ${rechargeMsg}`);
                        this.playerMovedThisTurn = false;
                        if (this.burstOwner === 'player') {
                            this.state = 'ENEMY_TURN';
                            this.aiTurnStartTime = Date.now();
                            const p2 = this.players[1];
                            this.synchronizeSliders(p2);
                            if (this.gameMode === 'vs_ai') {
                                this.uiManager.logMessage("Enemy Turn initiated. AI planning...");
                                // Reactive AI evasion: drive away if player's shell landed close to AI position
                                if (this.lastLandingX !== null && Math.abs(this.lastLandingX - p2.position.x) < 70) {
                                    const evadeDist = (Math.random() > 0.5 ? 50 : -50);
                                    const newX = Math.max(this.config.canvasWidth / 2 + 50, Math.min(this.config.canvasWidth - 25, p2.position.x + evadeDist));
                                    if (newX !== p2.position.x && p2.fuel > 15) {
                                        this.aiMoveTargetX = newX;
                                        p2.fuel = Math.max(0, p2.fuel - Math.abs(newX - p2.position.x) * 0.25);
                                        this.playerMovedThisTurn = true;
                                        this.uiManager.logMessage("AI detects incoming danger threat! Relocating...");
                                    }
                                }
                            }
                            else {
                                this.uiManager.logMessage("Player 2 Turn initiated. Drive A/D and fire!");
                            }
                        }
                        else {
                            this.state = 'PLAYER_TURN';
                            this.randomizeWind();
                            const p1 = this.players[0];
                            this.synchronizeSliders(p1);
                            this.uiManager.logMessage("Player 1 Turn initiated. Wind has shifted.");
                        }
                    }
                }
            }
        }
        else if (this.state === 'ENEMY_TURN' && this.gameMode === 'vs_ai' && this.aiMoveTargetX === null) {
            if (this.aiTurnStartTime === null) {
                this.aiTurnStartTime = Date.now();
            }
            // AI shot decision calculation delay
            if (Date.now() - this.aiTurnStartTime > 1600) {
                const ai = this.players[1];
                const human = this.players[0];
                const shot = this.ai.decideShot({ x: ai.position.x, y: ai.position.y - 18 }, { x: human.position.x, y: human.position.y - 18 }, this.difficulty, ai.fuel, this.player2HasNuke);
                let selectedWeaponType = shot.weaponType;
                let dynamicCost = this.getDynamicFuelCost(selectedWeaponType, shot.power);
                // If AI cannot afford the selected weapon, it must fall back to the free small_cannon
                if (ai.fuel < dynamicCost) {
                    selectedWeaponType = 'small_cannon';
                    dynamicCost = 0;
                }
                ai.aimAngle = shot.angle;
                ai.aimPower = shot.power;
                ai.weapon = this.weapons[selectedWeaponType];
                ai.fuel = Math.max(0, ai.fuel - dynamicCost);
                // Trigger AI physical recoil kickback & chassis tilt
                const aiRecoilKick = selectedWeaponType === 'nuke' ? 14 : selectedWeaponType === 'heavy_mortar' ? 10 : 6;
                ai.recoilOffset = aiRecoilKick;
                ai.recoilAngle = 0.15;
                this.burstOwner = 'ai';
                this.burstPower = shot.power;
                this.burstAngle = shot.angle;
                this.burstWeapon = ai.weapon;
                this.burstShotsRemaining = ai.weapon.burstCount;
                this.burstDelay = ai.weapon.burstDelay;
                this.burstTimer = 0;
                this.state = 'PROJECTILE_FLIGHT';
                this.fireSingleProjectile();
                this.aiTurnStartTime = null;
            }
        }
    }
    draw() {
        const ctx = this.renderer.getContext();
        this.renderer.clear();
        ctx.save();
        if (this.shakeIntensity > 0) {
            const dx = (Math.random() - 0.5) * this.shakeIntensity;
            const dy = (Math.random() - 0.5) * this.shakeIntensity;
            ctx.translate(dx, dy);
        }
        // 1. Draw Terrain
        this.renderer.drawTerrain(this.terrain, this.turnsElapsed);
        // 1b. Draw wind-responsive nanite fog
        ctx.save();
        this.nanites.forEach(n => {
            ctx.fillStyle = 'rgba(52, 211, 153, ' + (0.18 + Math.sin(n.phase + Date.now() / 600) * 0.08) + ')';
            ctx.shadowColor = '#34d399';
            ctx.shadowBlur = 4;
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
        // 1c. Draw faint digital circuit lines inside the dirt body path
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, this.config.canvasHeight);
        for (let x = 0; x < this.config.canvasWidth; x += 4) {
            ctx.lineTo(x, this.terrain.getHeight(x));
        }
        ctx.lineTo(this.config.canvasWidth, this.config.canvasHeight);
        ctx.closePath();
        ctx.clip(); // Mask to ground boundaries
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.035)'; // very faint green glowing grid
        ctx.lineWidth = 1;
        const gSize = 32;
        for (let gx = 0; gx < this.config.canvasWidth; gx += gSize) {
            ctx.beginPath();
            ctx.moveTo(gx, 0);
            ctx.lineTo(gx, this.config.canvasHeight);
            ctx.stroke();
        }
        for (let gy = 0; gy < this.config.canvasHeight; gy += gSize) {
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(this.config.canvasWidth, gy);
            ctx.stroke();
        }
        ctx.restore();
        // 2. Draw Wind Vector background lines
        this.drawWindParticles(ctx);
        // 3. Draw Aim Guide (Trajectory Preview)
        if (this.state === 'PLAYER_TURN' || (this.state === 'ENEMY_TURN' && this.gameMode === 'pvp')) {
            this.drawAimGuide(ctx);
        }
        // 4. Draw Landmines
        this.drawMines(ctx);
        // 5. Draw Supply Crates
        this.drawCrates(ctx);
        // 6. Draw Players
        const activePlayerType = this.state === 'PLAYER_TURN' ? 'player' : 'ai';
        this.renderer.drawPlayers(this.players, activePlayerType);
        // 7. Draw Projectiles
        this.renderer.drawProjectiles(this.projectiles);
        // 8. Draw Explosion Shockwaves
        ctx.save();
        this.shockwaves.forEach(wave => {
            ctx.strokeStyle = `${wave.color}${wave.alpha})`;
            ctx.lineWidth = 3.5 * wave.alpha;
            ctx.shadowColor = wave.color.replace('rgba', 'rgb').split(',').slice(0, 3).join(',') + ')';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
            ctx.stroke();
        });
        ctx.restore();
        // 8b. Draw Explosion Particles
        ctx.save();
        this.particles.forEach(p => {
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
        // 9. Draw Floating Texts
        ctx.save();
        this.floatingTexts.forEach(t => {
            ctx.globalAlpha = t.alpha;
            ctx.fillStyle = t.color;
            ctx.font = 'bold 12px "Share Tech Mono", monospace';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 4;
            ctx.fillText(t.text, t.x, t.y);
        });
        ctx.restore();
        ctx.restore();
        // 10. Update HUD UIManager
        this.uiManager.updateUI(this.players, this.state, this.config.wind, this.gameMode);
        // 11. Draw Screen Flash Overlay
        if (this.screenFlash > 0) {
            ctx.save();
            ctx.fillStyle = `rgba(255, 253, 244, ${this.screenFlash})`;
            ctx.fillRect(0, 0, this.config.canvasWidth, this.config.canvasHeight);
            ctx.restore();
        }
    }
    drawAimGuide(ctx) {
        const player = this.getActivePlayer();
        if (!player)
            return;
        const spawnPos = { x: player.position.x, y: player.position.y - 18 };
        const speed = player.aimPower * player.weapon.speedMultiplier * (this.config.canvasWidth / 1024);
        let pos = Object.assign({}, spawnPos);
        let vel = {
            x: Math.cos(player.aimAngle) * speed,
            y: -Math.sin(player.aimAngle) * speed
        };
        ctx.save();
        const baseColor = player.type === 'player' ? 'rgba(56, 189, 248, ' : 'rgba(248, 113, 113, ';
        const stepOffset = (Date.now() / 90) % 2.0;
        for (let i = 0; i < 15; i++) {
            const shiftedIndex = i + stepOffset;
            if (Math.round(shiftedIndex) % 2 === 0) {
                const alpha = (1.0 - (i / 15)) * 0.55;
                ctx.fillStyle = `${baseColor}${alpha})`;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 2.2, 0, Math.PI * 2);
                ctx.fill();
            }
            pos = this.physics.updateProjectile(pos, vel, 1.0);
            if (pos.y >= this.terrain.getHeight(pos.x))
                break;
            if (pos.x < 0 || pos.x > this.config.canvasWidth)
                break;
        }
        ctx.restore();
    }
    drawWindParticles(ctx) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        this.windParticles.forEach(part => {
            ctx.beginPath();
            ctx.moveTo(part.x, part.y);
            const streakLength = this.config.wind.x * 40 + (this.config.wind.x >= 0 ? 8 : -8);
            ctx.lineTo(part.x + streakLength, part.y);
            ctx.stroke();
        });
        ctx.restore();
    }
    drawMines(ctx) {
        ctx.save();
        this.mines.forEach(mine => {
            // Draw mine base
            ctx.fillStyle = '#475569';
            ctx.beginPath();
            ctx.arc(mine.position.x, mine.position.y - 2, 5, 0, Math.PI * 2);
            ctx.fill();
            // Blinking red light
            const blink = (Date.now() % 800) > 400;
            ctx.fillStyle = blink ? '#ef4444' : '#7f1d1d';
            ctx.beginPath();
            ctx.arc(mine.position.x, mine.position.y - 4, 1.8, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
    }
    drawCrates(ctx) {
        ctx.save();
        this.crates.forEach(crate => {
            // 0. Draw glowing tactical drop beacon beam
            ctx.save();
            const beaconGradient = ctx.createLinearGradient(crate.position.x, crate.position.y, crate.position.x, 0);
            const beaconColor = crate.type === 'heal' ? 'rgba(16, 185, 129, ' : crate.type === 'fuel' ? 'rgba(59, 130, 246, ' : 'rgba(245, 158, 11, ';
            beaconGradient.addColorStop(0, beaconColor + '0.35)');
            beaconGradient.addColorStop(0.3, beaconColor + '0.15)');
            beaconGradient.addColorStop(1, beaconColor + '0.0)');
            ctx.fillStyle = beaconGradient;
            ctx.fillRect(crate.position.x - 3, 0, 6, crate.position.y);
            // Core pulsing line
            ctx.strokeStyle = '#ffffff';
            ctx.globalAlpha = 0.35 + Math.sin(Date.now() / 150) * 0.15;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(crate.position.x, crate.position.y);
            ctx.lineTo(crate.position.x, 0);
            ctx.stroke();
            ctx.restore();
            // 1. Draw Parachute
            if (crate.velocity.y > 0) {
                ctx.strokeStyle = 'rgba(241, 245, 249, 0.6)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                // Parachute canopy
                ctx.arc(crate.position.x, crate.position.y - 25, 14, Math.PI, 0);
                ctx.stroke();
                // Rigging strings
                ctx.beginPath();
                ctx.moveTo(crate.position.x - 14, crate.position.y - 25);
                ctx.lineTo(crate.position.x - 8, crate.position.y - 8);
                ctx.moveTo(crate.position.x + 14, crate.position.y - 25);
                ctx.lineTo(crate.position.x + 8, crate.position.y - 8);
                ctx.moveTo(crate.position.x, crate.position.y - 25);
                ctx.lineTo(crate.position.x, crate.position.y - 8);
                ctx.stroke();
            }
            // 2. Draw Crate Box
            const color = crate.type === 'heal' ? '#10b981' : crate.type === 'fuel' ? '#3b82f6' : '#f59e0b';
            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(crate.position.x - 9, crate.position.y - 7, 18, 16);
            // Crate body
            ctx.fillStyle = '#78350f'; // wood brown
            ctx.fillRect(crate.position.x - 8, crate.position.y - 8, 16, 16);
            // Color coded banding
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.strokeRect(crate.position.x - 8, crate.position.y - 8, 16, 16);
            // Crate details (wood diagonal brace)
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.beginPath();
            ctx.moveTo(crate.position.x - 6, crate.position.y - 6);
            ctx.lineTo(crate.position.x + 6, crate.position.y + 6);
            ctx.stroke();
        });
        ctx.restore();
    }
    isMyTurnLocal() {
        if (!this.isMultiplayer)
            return true;
        if (this.network.role === 'host') {
            return this.state === 'PLAYER_TURN';
        }
        else if (this.network.role === 'guest') {
            return this.state === 'ENEMY_TURN';
        }
        return false;
    }
    spawnSupplyCrateSpecific(x, type) {
        this.crates.push({
            id: `crate-${Date.now()}`,
            position: { x, y: 0 },
            velocity: { x: 0, y: 1.2 },
            type,
            isActive: true
        });
        this.uiManager.logMessage(`A supply drop is parachuting in containing a ${type.toUpperCase()} crate!`);
    }
    initGameMultiplayer(windX, seed) {
        this.initGame(seed);
        // Override wind
        this.config.wind.x = windX;
        // Clear standard randomized mines and re-spawn them deterministically using the seed
        this.mines = [];
        const mine1X = 250 + (seed % 150);
        const mine2X = this.config.canvasWidth - 400 + ((seed * 7) % 150);
        this.spawnMine(mine1X);
        this.spawnMine(mine2X);
        // Label players based on network role
        if (this.network.role === 'host') {
            this.players[0].id = "YOU (P1)";
            this.players[1].id = "OPPONENT (P2)";
        }
        else {
            this.players[0].id = "OPPONENT (P1)";
            this.players[1].id = "YOU (P2)";
        }
        this.uiManager.logMessage(`REALTIME MULTIPLAYER LAUNCHED! Room Code: ${this.network.activeRoomCode}`);
        this.uiManager.updateUI(this.players, this.state, this.config.wind, this.gameMode);
    }
    checkTriggerRematch() {
        if (this.localReadyForRematch && this.remoteReadyForRematch) {
            if (this.network.role === 'host') {
                const initialWind = (Math.random() - 0.5) * 2.0;
                const terrainSeed = Date.now();
                this.initGameMultiplayer(initialWind, terrainSeed);
                this.network.startRematch(initialWind, terrainSeed);
            }
        }
    }
    setupLobbyHandlers() {
        const lobbyOverlay = document.getElementById('lobby-overlay');
        const quickMatchBtn = document.getElementById('quick-match-btn');
        const createRoomBtn = document.getElementById('create-room-btn');
        const joinRoomBtn = document.getElementById('join-room-btn');
        const roomInput = document.getElementById('room-input');
        const localPlayBtn = document.getElementById('local-play-btn');
        const lobbyStatus = document.getElementById('lobby-status');
        const lobbyStatusText = document.getElementById('lobby-status-text');
        const cancelMatchmakingBtn = document.getElementById('cancel-matchmaking-btn');
        this.network = new NetworkManager();
        this.network.onRematchReady(() => {
            this.remoteReadyForRematch = true;
            this.checkTriggerRematch();
        });
        this.network.onGameStart((windX, seed) => {
            this.isMultiplayer = true;
            this.gameMode = 'pvp';
            lobbyStatus === null || lobbyStatus === void 0 ? void 0 : lobbyStatus.classList.add('hidden');
            lobbyOverlay === null || lobbyOverlay === void 0 ? void 0 : lobbyOverlay.classList.add('hidden');
            this.initGameMultiplayer(windX, seed);
        });
        this.network.onMove((x) => {
            const activePlayer = this.getActivePlayer();
            if (activePlayer) {
                activePlayer.targetX = x;
            }
        });
        this.network.onFire((power, angle, weaponType) => {
            const activePlayer = this.getActivePlayer();
            activePlayer.aimPower = power;
            activePlayer.aimAngle = angle;
            activePlayer.weapon = Object.assign({}, this.weapons[weaponType]);
            this.burstOwner = activePlayer.type;
            this.burstPower = power;
            this.burstAngle = angle;
            this.burstWeapon = activePlayer.weapon;
            this.burstShotsRemaining = activePlayer.weapon.burstCount;
            this.burstDelay = activePlayer.weapon.burstDelay;
            this.burstTimer = 0;
            const recoilKick = weaponType === 'nuke' ? 14 : weaponType === 'heavy_mortar' ? 10 : 6;
            activePlayer.recoilOffset = recoilKick;
            activePlayer.recoilAngle = -0.15;
            const dynamicCost = this.getDynamicFuelCost(weaponType, power);
            activePlayer.fuel = Math.max(0, activePlayer.fuel - dynamicCost);
            this.state = 'PROJECTILE_FLIGHT';
            this.fireSingleProjectile();
        });
        this.network.onWindSync((windX) => {
            this.config.wind.x = windX;
            this.uiManager.updateUI(this.players, this.state, this.config.wind, this.gameMode);
        });
        this.network.onCrateDrop((x, crateType) => {
            this.spawnSupplyCrateSpecific(x, crateType);
        });
        this.network.onMineSpawn((x) => {
            this.spawnMine(x);
        });
        this.network.onTurnEnd(() => {
            this.turnsElapsed++;
            if (this.state === 'PLAYER_TURN') {
                this.state = 'ENEMY_TURN';
                this.aiTurnStartTime = null;
                this.playerMovedThisTurn = false;
                this.uiManager.logMessage("Opponent's Turn.");
            }
            else {
                this.state = 'PLAYER_TURN';
                this.playerMovedThisTurn = false;
                this.uiManager.logMessage("Your Turn.");
            }
            this.uiManager.updateUI(this.players, this.state, this.config.wind, this.gameMode);
        });
        this.network.onDisconnect((reason) => {
            this.uiManager.logMessage(`MULTIPLAYER: ${reason}`);
            alert(reason);
            this.isMultiplayer = false;
            this.network.disconnect();
            lobbyOverlay === null || lobbyOverlay === void 0 ? void 0 : lobbyOverlay.classList.remove('hidden');
        });
        quickMatchBtn === null || quickMatchBtn === void 0 ? void 0 : quickMatchBtn.addEventListener('click', () => __awaiter(this, void 0, void 0, function* () {
            lobbyStatus === null || lobbyStatus === void 0 ? void 0 : lobbyStatus.classList.remove('hidden');
            if (lobbyStatusText)
                lobbyStatusText.innerText = "Connecting to matchmaking lobby...";
            const success = yield this.network.init();
            if (!success) {
                alert("Realtime networking failed to initialize.");
                lobbyStatus === null || lobbyStatus === void 0 ? void 0 : lobbyStatus.classList.add('hidden');
                return;
            }
            if (lobbyStatusText)
                lobbyStatusText.innerText = "Searching for opponent...";
            yield this.network.startQuickMatch((role) => {
                this.isMultiplayer = true;
                this.gameMode = 'pvp';
                if (role === 'guest') {
                    if (lobbyStatusText)
                        lobbyStatusText.innerText = "Joining host lobby...";
                }
                else {
                    if (lobbyStatusText)
                        lobbyStatusText.innerText = "Opponent found! Initializing battleground...";
                }
            });
        }));
        createRoomBtn === null || createRoomBtn === void 0 ? void 0 : createRoomBtn.addEventListener('click', () => __awaiter(this, void 0, void 0, function* () {
            lobbyStatus === null || lobbyStatus === void 0 ? void 0 : lobbyStatus.classList.remove('hidden');
            if (lobbyStatusText)
                lobbyStatusText.innerText = "Provisioning private room...";
            const success = yield this.network.init();
            if (!success) {
                alert("Realtime networking failed to initialize.");
                lobbyStatus === null || lobbyStatus === void 0 ? void 0 : lobbyStatus.classList.add('hidden');
                return;
            }
            const code = yield this.network.hostPrivateRoom(() => {
                lobbyStatus === null || lobbyStatus === void 0 ? void 0 : lobbyStatus.classList.add('hidden');
                lobbyOverlay === null || lobbyOverlay === void 0 ? void 0 : lobbyOverlay.classList.add('hidden');
                this.isMultiplayer = true;
                this.gameMode = 'pvp';
            });
            if (lobbyStatusText) {
                lobbyStatusText.innerHTML = `PRIVATE ROOM OPENED!<br><br><span style="font-size: 2.2rem; font-weight:800; color:#06b6d4; letter-spacing:0.1em;">${code}</span><br><br>Share this code with your friend to connect.`;
            }
        }));
        joinRoomBtn === null || joinRoomBtn === void 0 ? void 0 : joinRoomBtn.addEventListener('click', () => __awaiter(this, void 0, void 0, function* () {
            const code = roomInput === null || roomInput === void 0 ? void 0 : roomInput.value.trim().toUpperCase();
            if (!code || code.length !== 4) {
                alert("Please enter a valid 4-character room code.");
                return;
            }
            lobbyStatus === null || lobbyStatus === void 0 ? void 0 : lobbyStatus.classList.remove('hidden');
            if (lobbyStatusText)
                lobbyStatusText.innerText = `Connecting to room ${code}...`;
            const success = yield this.network.init();
            if (!success) {
                alert("Realtime networking failed to initialize.");
                lobbyStatus === null || lobbyStatus === void 0 ? void 0 : lobbyStatus.classList.add('hidden');
                return;
            }
            yield this.network.joinPrivateRoom(code);
        }));
        localPlayBtn === null || localPlayBtn === void 0 ? void 0 : localPlayBtn.addEventListener('click', () => {
            lobbyOverlay === null || lobbyOverlay === void 0 ? void 0 : lobbyOverlay.classList.add('hidden');
            this.isMultiplayer = false;
            this.initGame();
        });
        cancelMatchmakingBtn === null || cancelMatchmakingBtn === void 0 ? void 0 : cancelMatchmakingBtn.addEventListener('click', () => {
            this.network.disconnect();
            lobbyStatus === null || lobbyStatus === void 0 ? void 0 : lobbyStatus.classList.add('hidden');
        });
        // Request fullscreen on first lobby button tap (mobile only)
        const lobbyButtons = [quickMatchBtn, createRoomBtn, joinRoomBtn, localPlayBtn];
        lobbyButtons.forEach(btn => {
            btn === null || btn === void 0 ? void 0 : btn.addEventListener('click', () => this.requestMobileFullscreen(), { once: true });
        });
    }
    sendMoveEventThrottled(x, force = false) {
        if (!this.isMultiplayer)
            return;
        const now = Date.now();
        if (force || now - this.lastMovePublishTime > 120) {
            this.network.sendEvent('move', { x });
            this.lastMovePublishTime = now;
        }
    }
    setupTouchControls() {
        const canvas = document.getElementById('gameCanvas');
        if (!canvas)
            return;
        canvas.addEventListener('touchstart', (e) => {
            if (!this.isMyTurnLocal())
                return;
            if (this.state !== 'PLAYER_TURN' && this.state !== 'ENEMY_TURN')
                return;
            const rect = canvas.getBoundingClientRect();
            const touch = e.touches[0];
            const touchX = (touch.clientX - rect.left) * (this.config.canvasWidth / rect.width);
            const touchY = (touch.clientY - rect.top) * (this.config.canvasHeight / rect.height);
            const player = this.getActivePlayer();
            if (!player)
                return;
            const dist = Math.sqrt(Math.pow(touchX - player.position.x, 2) +
                Math.pow(touchY - (player.position.y - 10), 2));
            if (dist < 80) {
                this.isDraggingAim = true;
                this.dismissTouchAimHint();
                e.preventDefault();
            }
        });
        canvas.addEventListener('touchmove', (e) => {
            if (!this.isDraggingAim)
                return;
            if (!this.isMyTurnLocal())
                return;
            const rect = canvas.getBoundingClientRect();
            const touch = e.touches[0];
            const touchX = (touch.clientX - rect.left) * (this.config.canvasWidth / rect.width);
            const touchY = (touch.clientY - rect.top) * (this.config.canvasHeight / rect.height);
            const player = this.getActivePlayer();
            if (!player)
                return;
            const dx = player.position.x - touchX;
            const dy = (player.position.y - 15) - touchY;
            const dragPower = Math.min(150, Math.max(10, Math.sqrt(dx * dx + dy * dy) * 1.1));
            let dragAngle = Math.atan2(dy, dx);
            if (dragAngle < 0)
                dragAngle = 0;
            if (dragAngle > Math.PI)
                dragAngle = Math.PI;
            player.aimPower = dragPower;
            player.aimAngle = dragAngle;
            const powerSlider = document.getElementById('power-slider');
            const angleSlider = document.getElementById('angle-slider');
            if (powerSlider)
                powerSlider.value = Math.round(dragPower).toString();
            if (angleSlider)
                angleSlider.value = Math.round(dragAngle * (180 / Math.PI)).toString();
            this.updateSliderOutputs();
            e.preventDefault();
        });
        canvas.addEventListener('touchend', (e) => {
            if (this.isDraggingAim) {
                this.isDraggingAim = false;
                this.handleFire();
                e.preventDefault();
            }
        });
        const leftBtn = document.getElementById('mobile-left-btn');
        const rightBtn = document.getElementById('mobile-right-btn');
        let moveInterval = null;
        const startDriving = (direction) => {
            if (moveInterval)
                return;
            const driveStep = () => {
                if (!this.isMyTurnLocal())
                    return;
                const player = this.getActivePlayer();
                if (!player || player.fuel <= 0)
                    return;
                const moveAmount = 2.0;
                const fuelCost = 0.5;
                if (!this.audioMovePlaying) {
                    this.audio.startMove();
                    this.audioMovePlaying = true;
                }
                if (direction === 'left') {
                    const minBound = player.type === 'player' ? 25 : this.config.canvasWidth / 2 + 50;
                    const newX = Math.max(minBound, player.position.x - moveAmount);
                    if (newX !== player.position.x) {
                        player.position.x = newX;
                        player.fuel = Math.max(0, player.fuel - fuelCost);
                        this.playerMovedThisTurn = true;
                        player.update(this.terrain);
                        this.sendMoveEventThrottled(player.position.x);
                    }
                }
                else {
                    const maxBound = player.type === 'player' ? this.config.canvasWidth / 2 - 50 : this.config.canvasWidth - 25;
                    const newX = Math.min(maxBound, player.position.x + moveAmount);
                    if (newX !== player.position.x) {
                        player.position.x = newX;
                        player.fuel = Math.max(0, player.fuel - fuelCost);
                        this.playerMovedThisTurn = true;
                        player.update(this.terrain);
                        this.sendMoveEventThrottled(player.position.x);
                    }
                }
                this.uiManager.updateUI(this.players, this.state, this.config.wind, this.gameMode);
            };
            driveStep();
            moveInterval = window.setInterval(driveStep, 35);
        };
        const stopDriving = () => {
            if (moveInterval) {
                clearInterval(moveInterval);
                moveInterval = null;
            }
            this.audio.stopMove();
            this.audioMovePlaying = false;
            if (this.isMultiplayer) {
                const player = this.getActivePlayer();
                if (player) {
                    this.sendMoveEventThrottled(player.position.x, true); // force final sync
                }
            }
        };
        leftBtn === null || leftBtn === void 0 ? void 0 : leftBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startDriving('left'); });
        leftBtn === null || leftBtn === void 0 ? void 0 : leftBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopDriving(); });
        rightBtn === null || rightBtn === void 0 ? void 0 : rightBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startDriving('right'); });
        rightBtn === null || rightBtn === void 0 ? void 0 : rightBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopDriving(); });
    }
    // ── MOBILE FULLSCREEN API ────────────────────────────────
    requestMobileFullscreen() {
        if (!this.isMobile || this.hasRequestedFullscreen)
            return;
        this.hasRequestedFullscreen = true;
        const el = document.documentElement;
        const requestFS = el.requestFullscreen
            || el.webkitRequestFullscreen
            || el.msRequestFullscreen;
        if (requestFS) {
            requestFS.call(el).catch(() => {
                // Silently fail — some browsers block fullscreen even with user gesture
            });
        }
        // Listen for fullscreen exit to show re-entry button
        document.addEventListener('fullscreenchange', () => this.onFullscreenChange());
        document.addEventListener('webkitfullscreenchange', () => this.onFullscreenChange());
    }
    onFullscreenChange() {
        const isFS = !!document.fullscreenElement || !!document.webkitFullscreenElement;
        const fsBtn = document.getElementById('fullscreen-btn');
        if (fsBtn) {
            // Show the re-entry button when NOT in fullscreen, hide when in fullscreen
            fsBtn.classList.toggle('hidden', isFS);
        }
    }
    setupFullscreenButton() {
        const fsBtn = document.getElementById('fullscreen-btn');
        if (!fsBtn)
            return;
        fsBtn.addEventListener('click', () => {
            const el = document.documentElement;
            const requestFS = el.requestFullscreen
                || el.webkitRequestFullscreen
                || el.msRequestFullscreen;
            if (requestFS) {
                requestFS.call(el).catch(() => { });
            }
        });
        // Only show on mobile when not in fullscreen and after first use
        if (!this.isMobile) {
            fsBtn.classList.add('hidden');
        }
    }
    // ── TOUCH AIM HINT ───────────────────────────────────────
    showTouchAimHint() {
        if (!this.isMobile || this.touchAimHintShown)
            return;
        if (sessionStorage.getItem('tankwars_aim_hint_shown'))
            return;
        this.touchAimHintShown = true;
        sessionStorage.setItem('tankwars_aim_hint_shown', '1');
        const hint = document.getElementById('touch-aim-hint');
        if (hint) {
            hint.classList.remove('hidden');
            // Auto-dismiss after 4s (the CSS animation handles fade out)
            setTimeout(() => {
                hint.classList.add('hidden');
            }, 4000);
        }
    }
    dismissTouchAimHint() {
        const hint = document.getElementById('touch-aim-hint');
        if (hint && !hint.classList.contains('hidden')) {
            hint.classList.add('hidden');
        }
    }
}
// Initialize the engine
window.addEventListener('load', () => {
    new GameEngine('gameCanvas');
});
//# sourceMappingURL=engine.js.map