import { ref } from 'vue';
import type { Place, Task } from '../api';
import { placement } from './placement';

/**
 * Dragging a card: within its list (a column), with the gap it would land in and the place Jig's queue would give it;
 * onto the Paused column, a pause — asked of the task, or made at once for a task nobody started; out of Paused, or a
 * task parked at the staging branch out of Review or On staging, a resume; out of Review onto On staging, a landing.
 * A drop is allowed only where `placement` says one `jig queue move` puts it, on Paused when Jig offers the request or
 * pauses the task at once, on the one list a resume would put the task in, or on On staging when Jig offers to land a
 * Review card; any other list allows none.
 */
export function useDrop(
  onMove: (task: string, place: Place) => void,
  onPause: (task: string) => void,
  onResume: (task: string) => void,
  onLand: (task: string) => void,
) {
  const dragged = ref<{
    task: string;
    list: string;
    /** May go onto Paused: a pause asked of it, or made at once. */
    toPaused: boolean;
    resumesTo: string | null;
    /** May go onto On staging: a Review card Jig offers to land. */
    lands: boolean;
  }>();
  /** Where the card would land: a gap in its own list, or another list as a whole (`index` -1, no place). */
  const gap = ref<{
    list: string;
    index: number;
    place?: Place;
  }>();

  function start(event: DragEvent, list: string, task: Task): void {
    dragged.value = {
      task: task.id,
      list,
      toPaused: task.pauseRequestable || task.pausable,
      resumesTo: task.resumesTo,
      lands: list === 'review' && task.landable,
    };
    event.dataTransfer?.setData('text/plain', task.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  /**
   * On `dragover` of the list's element; its cards are the children marked `data-card`, in `cards`' order. Without
   * `cards` — a board sorted other than by Jig's queue — the list allows no drop of its own cards.
   */
  function over(event: DragEvent, list: string, cards?: Task[]): void {
    const d = dragged.value;
    if (!d) return;
    if (d.list !== list) {
      if (!(list === 'paused' ? d.toPaused : list === d.resumesTo || (list === 'on-staging' && d.lands))) return;
      gap.value = { list, index: -1 };
      event.preventDefault(); // allows the drop here
      return;
    }
    if (!cards) {
      gap.value = undefined; // a gap left by another list would shade it
      return;
    }
    const items = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[data-card]')];
    const below = items.findIndex((el) => {
      const box = el.getBoundingClientRect();
      return event.clientY < box.top + box.height / 2;
    });
    const index = below < 0 ? items.length : below;
    const place = placement(cards, d.task, index);
    gap.value = place && { list, index, place };
    if (place) event.preventDefault(); // allows the drop here
  }

  function drop(list: string): void {
    const [d, g] = [dragged.value, gap.value];
    end();
    if (!d || g?.list !== list) return;
    if (g.place) onMove(d.task, g.place);
    else if (list === 'paused') onPause(d.task);
    else if (list === d.resumesTo) onResume(d.task);
    else onLand(d.task);
  }

  function end(): void {
    dragged.value = undefined;
    gap.value = undefined;
  }

  return { dragged, gap, start, over, drop, end };
}
