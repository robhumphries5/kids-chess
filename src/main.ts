import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.cburnett.css';
import './board-theme.css';
import './style.css';
import { startGame } from './ui/game-screen';

startGame({
  board: document.getElementById('board')!,
  status: document.getElementById('status')!,
  overlay: document.getElementById('overlay')!,
});
