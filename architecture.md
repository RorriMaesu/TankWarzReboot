# Tank Wars Architecture Blueprint

## 1. CORE MECHANICS & PHYSICS ENGINE

### 2D Destructible Terrain
- **Data Structure**: Array-backed heightmap grid (2D array of integers/floats).
- **Dynamics**: Each cell represents a height value. Projectile impacts will calculate a radius and subtract height values from the grid.
- **Rendering**: Canvas `lineTo` or `fill` operations based on the heightmap values to create a continuous terrain line.

### Ballistic Physics Model
- **Gravity**: Constant downward acceleration vector.
- **Velocity**: Initial velocity vector derived from power and angle.
- **Wind Resistance**: Dynamic vector added to the velocity each frame/turn.
- **Wind Logic**: Randomly generated or shifted every turn (e.g., a "Wind Speed" and "Wind Direction" variable).
- **Integration**: Euler or Verlet integration to update position based on velocity and acceleration.

### Turn Management & Economy
- **State Machine**: `PLAYER_TURN`, `PROJECTILE_FLIGHT`, `ENEMY_TURN`, `GAME_OVER`.
- **Economy**: Player health (HP) and fuel/ammo points.
- **Weapon Phase**: UI for selecting weapon type and setting power/angle.
- **Tracking**: Array of active projectiles with properties (position, velocity, owner, damage).

## 2. SPECIFIC AI OPPONENT ARCHITECTURE

### Heuristic Trajectory-Solving AI Engine
The AI will not use "cheating" (direct target coordinates). Instead, it will simulate physics to "guess" the correct shot.

#### Trajectory Simulation Loop
- The AI maintains a "Virtual Physics Engine" identical to the game's physics.
- It simulates a shot with a given power and angle to see where it lands.
- It compares the landing point to the player's current coordinates.

#### Difficulty/Error Injection
- **Easy AI**: High Gaussian noise added to the final calculated power and angle.
- **Medium AI**: Moderate noise. The AI remembers the result of its last shot (e.g., "too short" or "too long").
- **Expert AI**: Minimal noise. The AI factors in the current wind drag vector into its simulation.

#### Binary Search Adjustment Loop
- **Memory State**: The AI stores the result of its previous shot (e.g., "Overshot" or "Undershot").
- **Bisection Algorithm**:
  - If the last shot was "Undershot", the next shot's power is increased by a percentage.
  - If "Overshot", power is decreased.
  - The AI narrows the range of possible power/angle values each turn until it converges on the target.

## 3. WORKSPACE ROADMAP

### Phase 1: Foundation & Engine
- `index.html`: Basic structure and Canvas setup.
- `style.css`: Game UI and layout.
- `types.ts`: Shared interfaces (Vector2D, Projectile, Player, etc.).
- `engine.ts`: Main game loop, state management, and rendering coordinator.

### Phase 2: Terrain & Physics
- `terrain.ts`: Heightmap grid management and deformation logic.
- `physics.ts`: Ballistic calculations, gravity, and wind application.

### Phase 3: Entities & AI
- `player.ts`: Player state and input handling.
- `projectile.ts`: Projectile behavior and collision detection.
- `ai.ts`: The Heuristic Trajectory-Solving AI Engine.

### Phase 4: UI & Polish
- `ui.ts`: HUD, weapon selection menu, and turn indicators.
- `game.ts`: Orchestration of turns and game-over logic.