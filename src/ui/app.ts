import type { ColourChoice } from '../core/colour';
import type { Profile, ProfileStore } from '../core/profiles';
import { createSavedGameStore, type SavedGame, type SavedGameStore } from '../core/saved-game';
import { OPPONENTS, opponentById, type OpponentCharacter } from '../opponents/roster';
import { startGame, type Game, type GameAudio } from './game-screen';
import { showGrownUpArea } from './grown-up-area';
import { createHold } from './hold';
import { createMenuChoice, type Choice } from './menu';
import {
  AVATARS,
  avatarById,
  BLACK_PAWN_SVG,
  DICE_SVG,
  MINI_GAMES_SVG,
  NEW_GAME_SVG,
  NEW_PROFILE_SVG,
  OPPONENT_PICTURES,
  PLAY_SVG,
  PUZZLES_SVG,
  WHITE_PAWN_SVG,
  type Avatar,
} from './pictures';
import { startPuzzles } from './puzzle-screen';
import { voiceSwitched } from './speech';
import { spokenMessage } from './spoken';
import { showStarJar } from './star-jar';
import { celebrateStickers, showStickerBook } from './sticker-book';
import { createStickerBook } from '../core/stickers';

/** How long the Grown-up button must be held. Shorter holds do nothing. */
const GROWN_UP_HOLD_MS = 3000;

export interface AppElements {
  menu: HTMLElement;
  menuChoices: HTMLElement;
  menuMessage: HTMLElement;
  game: HTMLElement;
  board: HTMLElement;
  message: HTMLElement;
  overlay: HTMLElement;
  /** Undo and Redo, beside the board in games against an Opponent. */
  gameControls: HTMLElement;
  /** The one Go Button, shared by every menu screen so it never moves. */
  go: HTMLButtonElement;
  /** Top-left: Back, Change player or Home, depending on the screen. */
  corner: HTMLButtonElement;
  /** The chosen Profile's avatar, top centre. */
  profileBadge: HTMLElement;
  /** The chosen Profile's Points, as a jar of stars. Shown wherever the badge is. */
  starJar: HTMLElement;
  grownUpArea: HTMLElement;
  /** The Sticker Book screen, opened by tapping the star jar on the home screen. */
  stickerBook: HTMLElement;
  /** Hold for 3 seconds to open the Grown-up Area. Only shown on the avatar picker. */
  grownUpButton: HTMLButtonElement;
}

/** A picture on a menu screen and what Go does once it is selected. */
interface MenuItem extends Choice {
  picture: string;
  onGo: () => void;
}

/** What the top-left button does on the current screen. */
interface CornerAction {
  label: string;
  name: string;
  action: () => void;
}

/** Thin UI: avatar picker → home → game. Menu choices are spoken and selected; Go confirms. */
export function startApp(
  el: AppElements,
  store: ProfileStore,
  deviceAudio: GameAudio,
  savedGames: SavedGameStore = createSavedGameStore(),
): void {
  let game: Game | undefined;
  /** The Profile playing now. Before one is picked, the device's voice is used. */
  let current: Profile | undefined;
  // Read at each line spoken, so a change in the Grown-up Area applies straight away.
  const audio: GameAudio = {
    ...deviceAudio,
    speaker: voiceSwitched(deviceAudio.speaker, () => !current || store.load(current.id).settings.voice),
  };

  const hold = createHold(GROWN_UP_HOLD_MS, grownUpArea);
  // The button's fill animation runs for exactly the hold time.
  el.grownUpButton.style.setProperty('--hold-ms', `${GROWN_UP_HOLD_MS}ms`);
  const press = () => {
    el.grownUpButton.classList.add('holding');
    hold.press();
  };
  const release = () => {
    hold.release();
    el.grownUpButton.classList.remove('holding');
  };
  el.grownUpButton.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    press();
  });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel'] as const) {
    el.grownUpButton.addEventListener(type, release);
  }
  // A long press on a touch screen would otherwise open the browser's menu.
  el.grownUpButton.addEventListener('contextmenu', (e) => e.preventDefault());
  el.grownUpButton.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) press();
  });
  el.grownUpButton.addEventListener('keyup', release);

  function avatarPicker(): void {
    current = undefined;
    const profiles = store.list();
    // First run: every avatar is a new Profile waiting to be picked.
    if (profiles.length === 0) return newProfile();
    const items = profiles.map((p) => avatarItem(p.id, avatarById(p.avatar), () => home(p), p.name));
    if (unusedAvatars().length > 0) {
      items.push({ id: 'new-profile', name: 'New player', picture: NEW_PROFILE_SVG, onGo: newProfile });
    }
    showMenu(items, undefined, undefined);
    el.grownUpButton.hidden = false;
  }

  function newProfile(): void {
    const items = unusedAvatars().map((a) => avatarItem(a.id, a, () => home(store.add(a.id))));
    // On first run there is nowhere to go back to.
    const firstRun = store.list().length === 0;
    const back = firstRun ? undefined : { label: '↩', name: 'Back', action: avatarPicker };
    showMenu(items, back, undefined);
    // On first run this is the picker, so a grown-up can set Profiles up from here.
    el.grownUpButton.hidden = !firstRun;
  }

  function grownUpArea(): void {
    release();
    el.menu.hidden = true;
    el.go.hidden = true;
    el.grownUpButton.hidden = true;
    showCorner(undefined);
    showProfileBadge(undefined);
    el.grownUpArea.hidden = false;
    showGrownUpArea(el.grownUpArea, store, () => {
      el.grownUpArea.hidden = true;
      el.grownUpArea.replaceChildren();
      avatarPicker();
    });
  }

  function home(profile: Profile): void {
    current = profile;
    const comingSoon = (name: string) => () => {
      const text = `${name}: coming soon!`;
      audio.speaker.say(text);
      el.menuMessage.replaceChildren(spokenMessage(text, audio.speaker));
    };
    showMenu(
      [
        { id: 'puzzles', name: 'Puzzles', picture: PUZZLES_SVG, onGo: () => puzzles(profile) },
        { id: 'play', name: 'Play', picture: PLAY_SVG, onGo: () => carryOnOrNew(profile) },
        { id: 'mini-games', name: 'Mini-games', picture: MINI_GAMES_SVG, onGo: comingSoon('Mini-games') },
      ],
      { label: '↩', name: 'Change player', action: avatarPicker },
      profile,
    );
    // On home, the star jar opens the Sticker Book.
    el.starJar.classList.add('opens-sticker-book');
    el.starJar.setAttribute('role', 'button');
    el.starJar.tabIndex = 0;
    el.starJar.onclick = () => stickerBook(profile);
    el.starJar.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') stickerBook(profile);
    };
    // Points from anywhere (a game, a Mini-game) may have unlocked a sticker not yet celebrated.
    celebrateStickers(el.overlay, createStickerBook(store, profile.id).takeNew(), audio);
  }

  function stickerBook(profile: Profile): void {
    el.menu.hidden = true;
    el.go.hidden = true;
    el.grownUpButton.hidden = true;
    el.game.hidden = true;
    showCorner({ label: '↩', name: 'Back', action: () => home(profile) });
    showProfileBadge(profile);
    el.stickerBook.hidden = false;
    showStickerBook(el.stickerBook, createStickerBook(store, profile.id), audio.speaker);
  }

  /**
   * A game left unfinished last time is offered first: carry on (the Opponent's picture) or start a
   * new one. The saved game is only replaced once a new game has a move in it.
   */
  function carryOnOrNew(profile: Profile): void {
    const saved = savedGames.load(profile.id);
    const character = saved && opponentById(saved.opponentId);
    if (!saved || !character) return opponentPicker(profile);
    showMenu(
      [
        {
          id: 'carry-on',
          name: `Carry on playing ${character.name}`,
          picture: OPPONENT_PICTURES[character.id] ?? PLAY_SVG,
          onGo: () => play(profile, character, saved.childColour, saved),
        },
        { id: 'new-game', name: 'New game', picture: NEW_GAME_SVG, onGo: () => opponentPicker(profile) },
      ],
      { label: '↩', name: 'Back', action: () => home(profile) },
      profile,
    );
  }

  /** Who to play: every Opponent's picture. */
  function opponentPicker(profile: Profile): void {
    const items = OPPONENTS.map((o) => ({
      id: o.id,
      name: o.name,
      picture: OPPONENT_PICTURES[o.id] ?? PLAY_SVG,
      onGo: () => colourPicker(profile, o),
    }));
    showMenu(items, { label: '↩', name: 'Back', action: () => home(profile) }, profile);
  }

  /** Which side to play: white, black or 🎲. */
  function colourPicker(profile: Profile, opponent: OpponentCharacter): void {
    const choose = (colour: ColourChoice) => () => play(profile, opponent, colour);
    showMenu(
      [
        { id: 'white', name: 'White', picture: WHITE_PAWN_SVG, onGo: choose('white') },
        { id: 'black', name: 'Black', picture: BLACK_PAWN_SVG, onGo: choose('black') },
        { id: 'random', name: 'Roll the dice', picture: DICE_SVG, onGo: choose('random') },
      ],
      { label: '↩', name: 'Back', action: () => opponentPicker(profile) },
      profile,
    );
  }

  function play(profile: Profile, opponent: OpponentCharacter, colour: ColourChoice, resume?: SavedGame): void {
    el.menu.hidden = true;
    el.go.hidden = true;
    el.grownUpButton.hidden = true;
    el.game.hidden = false;
    game = startGame(
      { board: el.board, message: el.message, overlay: el.overlay, controls: el.gameControls },
      audio,
      opponent,
      colour,
      { store: savedGames, profileId: profile.id, resume },
    );
    const leave = () => {
      game?.stop();
      game = undefined;
      home(profile);
    };
    showCorner({ label: '🏠', name: 'Home', action: () => confirmHome(leave) });
    showProfileBadge(profile);
  }

  function puzzles(profile: Profile): void {
    el.menu.hidden = true;
    el.go.hidden = true;
    el.grownUpButton.hidden = true;
    el.game.hidden = false;
    game = startPuzzles(
      { board: el.board, message: el.message, overlay: el.overlay, starJar: el.starJar },
      audio,
      store,
      profile.id,
    );
    const leave = () => {
      game?.stop();
      game = undefined;
      home(profile);
    };
    // Nothing is lost by leaving a puzzle, so Home goes straight there.
    showCorner({ label: '🏠', name: 'Home', action: leave });
    showProfileBadge(profile);
  }

  /**
   * One tap on 🏠 mid-game asks first, so a game isn't left by accident (it is saved either way, and
   * leaving costs nothing: Play offers to carry on). No Go Button on the game
   * screen: the card's own two big buttons answer. "Keep playing" puts back whatever card was showing
   * (say, the Promotion Picker).
   */
  function confirmHome(leave: () => void): void {
    const before = [...el.overlay.childNodes];
    const wasHidden = el.overlay.hidden;
    const question = 'Go home?';
    audio.speaker.say(question);

    const card = document.createElement('div');
    card.className = 'card';
    const heading = document.createElement('h2');
    heading.append(spokenMessage(question, audio.speaker));
    const choices = document.createElement('div');
    choices.className = 'confirm-choices';
    const yes = confirmButton('🏠', 'Go home', () => {
      el.overlay.hidden = true;
      leave();
    });
    const no = confirmButton('♟️', 'Keep playing', () => {
      el.overlay.replaceChildren(...before);
      el.overlay.hidden = wasHidden;
    });
    choices.append(no, yes);
    card.append(heading, choices);
    el.overlay.replaceChildren(card);
    el.overlay.hidden = false;
  }

  function showMenu(items: MenuItem[], corner: CornerAction | undefined, profile: Profile | undefined): void {
    const menu = createMenuChoice(items, audio.speaker);
    el.game.hidden = true;
    el.stickerBook.hidden = true;
    el.menu.hidden = false;
    el.menuMessage.replaceChildren();
    el.go.hidden = false;
    el.go.classList.remove('ready');
    el.grownUpButton.hidden = true;
    showCorner(corner);
    showProfileBadge(profile);

    const buttons = items.map((item) => {
      const button = document.createElement('button');
      button.className = 'menu-choice';
      button.type = 'button';
      button.setAttribute('aria-label', item.name);
      button.setAttribute('aria-pressed', 'false');
      button.append(svgPicture(item.picture));
      button.addEventListener('click', () => {
        el.menuMessage.replaceChildren();
        menu.tap(item.id);
        for (const b of buttons) b.setAttribute('aria-pressed', String(b === button));
        el.go.classList.add('ready');
      });
      return button;
    });
    el.menuChoices.replaceChildren(...buttons);
    // Lets the CSS fit every choice on one row on short landscape screens.
    el.menuChoices.style.setProperty('--count', String(items.length));

    el.go.onclick = () => menu.go()?.onGo();
  }

  function showCorner(corner: CornerAction | undefined): void {
    el.corner.hidden = !corner;
    if (!corner) return;
    el.corner.textContent = corner.label;
    el.corner.setAttribute('aria-label', corner.name);
    el.corner.onclick = corner.action;
  }

  function showProfileBadge(profile: Profile | undefined): void {
    const avatar = profile && avatarById(profile.avatar);
    el.profileBadge.hidden = !avatar;
    el.profileBadge.replaceChildren(...(avatar ? [svgPicture(avatar.svg)] : []));
    if (avatar) el.profileBadge.setAttribute('aria-label', profile.name ?? avatar.name);
    el.starJar.hidden = !profile;
    if (profile) showStarJar(el.starJar, store.load(profile.id).points);
    // Only the home screen makes the jar a button (see home).
    el.starJar.classList.remove('opens-sticker-book');
    el.starJar.setAttribute('role', 'img');
    el.starJar.removeAttribute('tabindex');
    el.starJar.onclick = null;
    el.starJar.onkeydown = null;
  }

  function unusedAvatars(): Avatar[] {
    const used = new Set(store.list().map((p) => p.avatar));
    return AVATARS.filter((a) => !used.has(a.id));
  }

  avatarPicker();
}

/**
 * An avatar as a menu choice, spoken as the Profile's name if a grown-up gave it one. A Profile whose
 * avatar is unknown still shows, as a plain picture.
 */
function avatarItem(id: string, avatar: Avatar | undefined, onGo: () => void, profileName?: string): MenuItem {
  return {
    id,
    name: profileName ?? avatar?.name ?? 'Player',
    picture: avatar?.svg ?? NEW_PROFILE_SVG,
    onGo,
  };
}

function svgPicture(svg: string): HTMLElement {
  const picture = document.createElement('span');
  picture.className = 'picture';
  picture.innerHTML = svg; // Our own constant art, never user text.
  return picture;
}

/** A big picture-and-word button on a confirmation card. */
function confirmButton(picture: string, label: string, onTap: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'confirm-choice';
  button.setAttribute('aria-label', label);
  const icon = document.createElement('span');
  icon.className = 'confirm-icon';
  icon.textContent = picture;
  const words = document.createElement('span');
  words.textContent = label;
  button.append(icon, words);
  button.addEventListener('click', onTap);
  return button;
}
