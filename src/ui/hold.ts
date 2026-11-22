/** Hold-to-open: `onHeld` runs only after an unbroken press of `ms`. Letting go early does nothing. */
export interface Hold {
  press(): void;
  release(): void;
}

export function createHold(ms: number, onHeld: () => void): Hold {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    press() {
      if (timer !== undefined) return;
      timer = setTimeout(() => {
        timer = undefined;
        onHeld();
      }, ms);
    },
    release() {
      clearTimeout(timer);
      timer = undefined;
    },
  };
}
