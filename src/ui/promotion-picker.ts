import type { Role } from 'chessground/types';
import type { Colour } from '../core/session';
import type { PromotionPiece } from '../opponents/opponent';

/** The Promotion Picker's choices, in order. `role` is chessground's piece class, so the pictures match the board. */
const PROMOTION_CHOICES: readonly { piece: PromotionPiece; name: string; role: Role }[] = [
  { piece: 'q', name: 'Queen', role: 'queen' },
  { piece: 'r', name: 'Rook', role: 'rook' },
  { piece: 'b', name: 'Bishop', role: 'bishop' },
  { piece: 'n', name: 'Knight', role: 'knight' },
];

/**
 * The Promotion Picker card's body: big pictures of the four pieces in the child's colour, and a Back
 * button. Nothing is ever chosen for the child, and no choice is special.
 */
export function promotionChoices(
  colour: Colour,
  onPick: (piece: PromotionPiece) => void,
  onBack: () => void,
): HTMLElement[] {
  const choices = document.createElement('div');
  choices.className = 'promotion-choices cg-wrap';
  for (const { piece, name, role } of PROMOTION_CHOICES) {
    const button = document.createElement('button');
    button.className = 'promotion-choice';
    button.setAttribute('aria-label', name);
    const picture = document.createElement('piece');
    picture.className = `${role} ${colour}`;
    const label = document.createElement('span');
    label.textContent = name;
    button.append(picture, label);
    button.addEventListener('click', () => onPick(piece));
    choices.append(button);
  }
  const back = document.createElement('button');
  back.className = 'small-button';
  back.textContent = '↩ Back';
  back.addEventListener('click', onBack);
  return [choices, back];
}
