// Database models
// Placeholder models for the game database

class Player {
  constructor(id, name, level) {
    this.id = id;
    this.name = name;
    this.level = level;
  }
}

class GameState {
  constructor() {
    this.state = {};
  }
}

export { Player, GameState };