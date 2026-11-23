import {
  HELP_PRESET_NAMES,
  HELP_PRESETS,
  type HelpPreset,
  type KindSwitches,
  type Profile,
  type ProfileSettings,
  type ProfileStore,
} from '../core/profiles';
import { AVATARS, avatarById, NEW_PROFILE_SVG } from './pictures';

/**
 * A per-Profile on/off switch in the Settings box. Later features add their switches to this list
 * (Move Colours, Blunder Warnings, Missed-Chance Alerts…); their defaults come from the help preset.
 */
interface SettingSwitch {
  label: string;
  get(settings: ProfileSettings): boolean;
  set(settings: ProfileSettings, on: boolean): ProfileSettings;
}

/** What each of the four kinds is called on its switch. */
const KIND_LABELS: Readonly<Record<keyof KindSwitches, string>> = {
  checkmate: 'checkmate',
  queen: 'losing the queen',
  rook: 'losing a rook',
  bishopKnight: 'losing a bishop or knight',
};

/** One switch per kind for a four-kind help feature (Blunder Warnings, Missed-Chance Alerts). */
function kindSwitches(group: 'blunderWarning' | 'missedChance', name: string): SettingSwitch[] {
  return (Object.keys(KIND_LABELS) as (keyof KindSwitches)[]).map((kind) => ({
    label: `${name}: ${KIND_LABELS[kind]}`,
    get: (s) => s[group][kind],
    set: (s, on) => ({ ...s, [group]: { ...s[group], [kind]: on } }),
  }));
}

const SETTING_SWITCHES: readonly SettingSwitch[] = [
  {
    label: 'Speak out loud',
    get: (s) => s.voice,
    set: (s, on) => ({ ...s, voice: on }),
  },
  ...kindSwitches('blunderWarning', 'Blunder Warning'),
];

/** Long enough for any real name; keeps the layout sane. */
const NAME_MAX_LENGTH = 20;

/**
 * The Grown-up Area: add, rename, re-picture and delete Profiles, and set their Settings. Written for
 * adults, so it uses words and ordinary controls rather than pictures and the Go Button.
 */
export function showGrownUpArea(root: HTMLElement, store: ProfileStore, onDone: () => void): void {
  /** The Profile whose delete is waiting for a yes, if any. */
  let confirmingDelete: string | undefined;
  /** The add form's choices, kept across re-renders. */
  let newAvatar: string | undefined;
  let newPreset: HelpPreset | undefined;
  let newName = '';

  function render(): void {
    const header = el('header', 'grown-up-header');
    const title = el('h1');
    title.textContent = 'Grown-ups';
    const done = button('Done', 'small-button', onDone);
    header.append(title, done);

    const profiles = store.list();
    const cards = profiles.map(profileCard);
    root.replaceChildren(header, ...cards, ...(unusedAvatars().length > 0 ? [addForm()] : []));
  }

  function profileCard(profile: Profile): HTMLElement {
    const data = store.load(profile.id);
    const card = el('section', 'grown-up-card');

    const heading = el('div', 'grown-up-card-heading');
    const title = el('h2');
    title.textContent = displayName(profile);
    heading.append(picture(profile.avatar), title);

    const name = field('Name', nameInput(profile.name ?? '', (value) => {
      store.update(profile.id, { name: value });
      render();
    }));

    const pictures = field(
      'Picture',
      avatarChoices([profile.avatar, ...unusedAvatars().map((a) => a.id)], profile.avatar, (id) => {
        store.update(profile.id, { avatar: id });
        render();
      }),
    );

    const preset = el('select') as HTMLSelectElement;
    for (const p of HELP_PRESETS) {
      const option = el('option') as HTMLOptionElement;
      option.value = p;
      option.textContent = HELP_PRESET_NAMES[p];
      option.selected = p === data.helpPreset;
      preset.append(option);
    }
    preset.addEventListener('change', () => {
      const chosen = HELP_PRESETS.find((p) => p === preset.value);
      if (chosen) store.setHelpPreset(profile.id, chosen);
      render();
    });
    const help = field('Help', preset);
    const helpNote = el('p', 'grown-up-note');
    helpNote.textContent = 'Changing this puts the help switches back to that level’s settings.';
    help.append(helpNote);

    const settings = el('fieldset', 'grown-up-settings');
    const legend = el('legend');
    legend.textContent = 'Settings';
    settings.append(legend);
    for (const s of SETTING_SWITCHES) {
      const label = el('label', 'grown-up-switch');
      const box = el('input') as HTMLInputElement;
      box.type = 'checkbox';
      box.checked = s.get(data.settings);
      box.addEventListener('change', () => {
        const latest = store.load(profile.id);
        store.save(profile.id, { ...latest, settings: s.set(latest.settings, box.checked) });
      });
      label.append(box, document.createTextNode(s.label));
      settings.append(label);
    }

    card.append(heading, name, pictures, help, settings, deleteRow(profile));
    return card;
  }

  function deleteRow(profile: Profile): HTMLElement {
    const row = el('div', 'grown-up-delete');
    if (confirmingDelete !== profile.id) {
      row.append(
        button('Delete…', 'small-button danger', () => {
          confirmingDelete = profile.id;
          render();
        }),
      );
      return row;
    }
    const question = el('p');
    question.textContent = `Delete ${displayName(profile)}? Their points, stickers and settings will be gone for good.`;
    row.append(
      question,
      button('Keep', 'small-button', () => {
        confirmingDelete = undefined;
        render();
      }),
      button('Yes, delete', 'small-button danger', () => {
        confirmingDelete = undefined;
        store.remove(profile.id);
        render();
      }),
    );
    return row;
  }

  function addForm(): HTMLElement {
    const card = el('section', 'grown-up-card');
    const title = el('h2');
    title.textContent = 'Add a player';
    const unused = unusedAvatars().map((a) => a.id);
    if (newAvatar && !unused.includes(newAvatar)) newAvatar = undefined;

    const add = button('Add player', 'big-button', () => {
      if (!newAvatar || !newPreset) return;
      store.add(newAvatar, { preset: newPreset, name: newName });
      newAvatar = undefined;
      newPreset = undefined;
      newName = '';
      render();
    });
    const showReady = () => (add.disabled = !newAvatar || !newPreset);

    const pictures = field(
      'Picture',
      avatarChoices(unused, newAvatar, (id) => {
        newAvatar = id;
        render();
      }),
    );
    const name = field('Name (optional)', nameInput(newName, (value) => (newName = value), 'input'));

    const presets = el('div', 'grown-up-presets');
    for (const p of HELP_PRESETS) {
      const label = el('label', 'grown-up-switch');
      const radio = el('input') as HTMLInputElement;
      radio.type = 'radio';
      radio.name = 'new-preset';
      radio.checked = p === newPreset;
      radio.addEventListener('change', () => {
        newPreset = p;
        showReady();
      });
      label.append(radio, document.createTextNode(HELP_PRESET_NAMES[p]));
      presets.append(label);
    }
    const help = field('Help', presets);
    const helpNote = el('p', 'grown-up-note');
    helpNote.textContent =
      'Lots of help: every warning, alert and move colour is on. Some help: move colours stay on, but warnings and alerts are only about checkmate and the queen.';
    help.append(helpNote);

    showReady();
    card.append(title, pictures, name, help, add);
    return card;
  }

  function unusedAvatars() {
    const used = new Set(store.list().map((p) => p.avatar));
    return AVATARS.filter((a) => !used.has(a.id));
  }

  render();
}

function displayName(profile: Profile): string {
  return profile.name ?? avatarById(profile.avatar)?.name ?? 'Player';
}

/** A row of avatar pictures; the selected one is marked. */
function avatarChoices(ids: string[], selected: string | undefined, onPick: (id: string) => void): HTMLElement {
  const row = el('div', 'grown-up-avatars');
  for (const id of ids) {
    const b = el('button', 'grown-up-avatar') as HTMLButtonElement;
    b.type = 'button';
    b.setAttribute('aria-label', avatarById(id)?.name ?? 'Player');
    b.setAttribute('aria-pressed', String(id === selected));
    b.append(picture(id));
    b.addEventListener('click', () => onPick(id));
    row.append(b);
  }
  return row;
}

/** Saves on `change` (leaving the box or pressing Enter), or on every keystroke with `input`. */
function nameInput(value: string, onValue: (value: string) => void, on: 'change' | 'input' = 'change'): HTMLInputElement {
  const input = el('input', 'grown-up-name') as HTMLInputElement;
  input.type = 'text';
  input.value = value;
  input.maxLength = NAME_MAX_LENGTH;
  input.autocomplete = 'off';
  input.addEventListener(on, () => onValue(input.value));
  return input;
}

function field(label: string, control: HTMLElement): HTMLElement {
  const wrap = el('div', 'grown-up-field');
  const heading = el('span', 'grown-up-label');
  heading.textContent = label;
  wrap.append(heading, control);
  return wrap;
}

function picture(avatarId: string): HTMLElement {
  const span = el('span', 'grown-up-picture');
  span.innerHTML = avatarById(avatarId)?.svg ?? NEW_PROFILE_SVG; // Our own constant art, never user text.
  return span;
}

function button(label: string, className: string, onTap: () => void): HTMLButtonElement {
  const b = el('button', className) as HTMLButtonElement;
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', onTap);
  return b;
}

function el(tag: string, className?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}
