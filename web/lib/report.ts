import { toast } from 'vue-sonner';
import type { Tone } from './tones';

/** What a toast says of an action: its kind decides how long it stays. */
export interface Report {
  kind: 'loading' | 'success' | 'info' | 'warning' | 'error';
  title: string;
  description?: string;
  descriptionClass?: string;
  /** One press on the toast; it keeps the toast up. */
  action?: {
    label: string;
    run: () => void;
  };
}

/**
 * The kind of toast a result of a tone is: what went wrong and what needs a look stay until closed, what went well and
 * what is only said go by themselves.
 */
export function kindOf(tone: Tone): Report['kind'] {
  return { bad: 'error', attention: 'warning', good: 'success', quiet: 'info' }[tone] as Report['kind'];
}

/** How long a result that went well stays, in ms; a warning, an error and a spinner stay until closed or replaced. */
export const SHOWN_MS = 8000;

/** The whole page's toast ids are fresh: sonner never forgets an id, and a re-raised one merges into the old toast. */
let counter = 0;

/**
 * One report on the page, as a toast under `key`: each `show` replaces the last under a fresh id, so nothing of the old
 * toast carries over. `onClosed` runs when the person closes the toast shown, or it closes by itself — never for one
 * replaced or cleared here. `clear` drops the toast silently: use it when the view that holds the state goes.
 */
export function reporter(
  key: string,
  onClosed?: () => void,
): {
  show: (report: Report) => void;
  clear: () => void;
} {
  let current: string | undefined;

  const clear = () => {
    const old = current;
    current = undefined;
    if (old !== undefined) toast.dismiss(old);
  };

  const show = (report: Report) => {
    clear();
    const id = `${key}#${++counter}`;
    current = id;
    const closed = () => {
      if (current !== id) return;
      current = undefined;
      onClosed?.();
    };

    const action = report.action;
    toast[report.kind](report.title, {
      id,
      description: report.description,
      descriptionClass: report.descriptionClass,
      duration: report.kind === 'success' || report.kind === 'info' ? SHOWN_MS : Infinity,
      onDismiss: closed,
      onAutoClose: closed,
      action: action
        ? {
            label: action.label,
            onClick: (event: MouseEvent) => {
              event.preventDefault();
              action.run();
            },
          }
        : undefined,
    });
  };

  return { show, clear };
}
