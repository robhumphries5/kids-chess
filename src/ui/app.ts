import type { Profile, ProfileStore } from '../core/profiles';
import { startGame, type Game, type GameAudio } from './game-screen';
import { createMenuChoice, type Choice } from './menu';
import { AVATARS, avatarById, MINI_GAMES_SVG, NEW_PROFILE_SVG, PLAY_SVG, PUZZLES_SVG, type Avatar } from './pictures';
import { spokenMessage } from './spoken';

export interface AppElements {
  menu: HTMLElement;
  menuChoices: HTMLElement;
  menuMessage: HTMLElement;
  game: HTMLElement;
  board: HTMLElement;
  message: HTMLElement;
  overlay: HTMLElement;
  /** The one Go Button, shared by every menu screen so it never moves. */
  go: HTMLButtonElement;
  /** Top-left: Back, Change player or Home, depending on the screen. */
  corner: HTMLButtonElement;
  /** The chosen Profile's avatar, top centre. */
  profileBadge: HTMLElement;
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
export function startApp(el: AppElements, store: ProfileStore, audio: GameAudio): void {
  let game: Game | undefined;

  function avatarPicker(): void {
    const profiles = store.list();
    // First run: every avatar is a new Profile waiting to be picked.
    if (profiles.length === 0) return newProfile();
    const items = profiles.map((p) => avatarItem(p.id, avatarById(p.avatar), () => home(p)));
    if (unusedAvatars().length > 0) {
      items.push({ id: 'new-profile', name: 'New player', picture: NEW_PROFILE_SVG, onGo: newProfile });
    }
    showMenu(items, undefined, undefined);
  }

  function newProfile(): void {
    const items = unusedAvatars().map((a) => avatarItem(a.id, a, () => home(store.add(a.id))));
    // On first run there is nowhere to go back to.
    const back = store.list().length > 0 ? { label: '↩', name: 'Back', action: avatarPicker } : undefined;
    showMenu(items, back, undefined);
  }

  function home(profile: Profile): void {
    const comingSoon = (name: string) => () => {
      const text = `${name}: coming soon!`;
      audio.speaker.say(text);
      el.menuMessage.replaceChildren(spokenMessage(text, audio.speaker));
    };
    showMenu(
      [
        { id: 'puzzles', name: 'Puzzles', picture: PUZZLES_SVG, onGo: comingSoon('Puzzles') },
        { id: 'play', name: 'Play', picture: PLAY_SVG, onGo: () => play(profile) },
        { id: 'mini-games', name: 'Mini-games', picture: MINI_GAMES_SVG, onGo: comingSoon('Mini-games') },
      ],
      { label: '↩', name: 'Change player', action: avatarPicker },
      profile,
    );
  }

  function play(profile: Profile): void {
    el.menu.hidden = true;
    el.go.hidden = true;
    el.game.hidden = false;
    game = startGame({ board: el.board, message: el.message, overlay: el.overlay }, audio);
    showCorner({
      label: '🏠',
      name: 'Home',
      action: () => {
        game?.stop();
        game = undefined;
        home(profile);
      },
    });
    showProfileBadge(profile);
  }

  function showMenu(items: MenuItem[], corner: CornerAction | undefined, profile: Profile | undefined): void {
    const menu = createMenuChoice(items, audio.speaker);
    el.game.hidden = true;
    el.menu.hidden = false;
    el.menuMessage.replaceChildren();
    el.go.hidden = false;
    el.go.classList.remove('ready');
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
    if (avatar) el.profileBadge.setAttribute('aria-label', avatar.name);
  }

  function unusedAvatars(): Avatar[] {
    const used = new Set(store.list().map((p) => p.avatar));
    return AVATARS.filter((a) => !used.has(a.id));
  }

  avatarPicker();
}

/** An avatar as a menu choice. A Profile whose avatar is unknown still shows, as a plain picture. */
function avatarItem(id: string, avatar: Avatar | undefined, onGo: () => void): MenuItem {
  return {
    id,
    name: avatar?.name ?? 'Player',
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
