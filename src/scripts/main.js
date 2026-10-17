// Main application entry point
import { createApp } from './components';
import { initializeGame } from './services/game';

createApp()
  .use(initializeGame)
  .start();