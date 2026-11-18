import { describe, expect, it } from 'vitest';
import type { Column, Task } from '../api';
import { filtered, fromQuery, reorders, sift, type Sift, specsOf, toQuery } from './sift';

const task = (id: string, more: Partial<Task> = {}): Task => ({
  id,
  class: null,
  status: 'active',
  goal: null,
  paused: false,
  pauseRequest: null,
  pauseRequestable: true,
  pausable: false,
  resumable: false,
  closable: false,
  staging: null,
  parked: null,
  stagingFlow: false,
  spec: null,
  promotion: null,
  resumesTo: null,
  started: false,
  gate: null,
  autopilot: null,
  pullRequest: null,
  priority: null,
  queue: null,
  ...more,
});

const backlog = (...cards: Task[]): Column[] => [{ id: 'backlog', title: 'Backlog', cards }];
const ids = (columns: Column[]) => columns.flatMap((c) => c.cards.map((t) => t.id));
const view = (more: Partial<Sift> = {}): Sift => ({ sort: 'queue', classes: [], priorities: [], specs: [], text: '', ...more });

const cards = [
  task('test-gaps', { class: 'T1', priority: 3, goal: 'From the triage tasks' }),
  task('docs-touchups', { class: 'T0', priority: 4 }),
  task('unset'),
  task('review-smells', { class: 'T3', priority: 0, goal: 'Чтобы jig-review находил' }),
  task('other-p3', { class: 'T1', priority: 3 }),
];

describe('sift', () => {
  it("keeps Jig's order by default", () => {
    expect(ids(sift(backlog(...cards), view()))).toEqual(['test-gaps', 'docs-touchups', 'unset', 'review-smells', 'other-p3']);
  });

  it("sorts by priority, P0 first and none last, equals in Jig's order", () => {
    expect(ids(sift(backlog(...cards), view({ sort: 'priority' })))).toEqual([
      'review-smells',
      'test-gaps',
      'other-p3',
      'docs-touchups',
      'unset',
    ]);
  });

  it('sorts by class, T0 first and none last', () => {
    expect(ids(sift(backlog(...cards), view({ sort: 'class' })))).toEqual([
      'docs-touchups',
      'test-gaps',
      'other-p3',
      'review-smells',
      'unset',
    ]);
  });

  it('filters by class and priority, `none` for the unset', () => {
    expect(ids(sift(backlog(...cards), view({ classes: ['T1', 'none'] })))).toEqual(['test-gaps', 'unset', 'other-p3']);
    expect(ids(sift(backlog(...cards), view({ priorities: ['P0', 'none'] })))).toEqual(['unset', 'review-smells']);
    expect(ids(sift(backlog(...cards), view({ classes: ['T1'], priorities: ['P4'] })))).toEqual([]);
  });

  it('filters by the spec a task was filed from, `none` for a task of none', () => {
    const of = (id: string, title: string | null = null) => ({ id, title, phase: 4, epic: false });
    const board = backlog(
      task('a', { spec: of('jig-ui') }),
      task('b'),
      task('c', { spec: of('team-board') }),
      task('d', { spec: of('jig-ui') }),
    );
    expect(ids(sift(board, view({ specs: ['jig-ui'] })))).toEqual(['a', 'd']);
    expect(ids(sift(board, view({ specs: ['team-board', 'none'] })))).toEqual(['b', 'c']);
  });

  it('finds text in the id or the goal, in any case', () => {
    expect(ids(sift(backlog(...cards), view({ text: ' TRIAGE ' })))).toEqual(['test-gaps']);
    expect(ids(sift(backlog(...cards), view({ text: 'находил' })))).toEqual(['review-smells']);
    expect(ids(sift(backlog(...cards), view({ text: 'docs' })))).toEqual(['docs-touchups']);
  });

  it('keeps every column, emptied or not, and leaves the board it was given alone', () => {
    const board: Column[] = [...backlog(...cards), { id: 'paused', title: 'Paused', cards: [task('set-aside')] }];
    const shown = sift(board, view({ text: 'gaps', sort: 'priority' }));
    expect(shown.map((c) => [c.id, c.cards.length])).toEqual([
      ['backlog', 1],
      ['paused', 0],
    ]);
    expect(ids(board)).toHaveLength(6);
  });
});

describe('the address', () => {
  it('reads a view and writes it back, defaults left out', () => {
    const read = fromQuery({ sort: 'priority', class: 'T2,T0', priority: 'none,P1', from: 'jig-ui,none', q: 'login', spec: 'team-board' });
    expect(read).toEqual(
      view({ sort: 'priority', classes: ['T0', 'T2'], priorities: ['P1', 'none'], specs: ['jig-ui', 'none'], text: 'login' }),
    );
    expect(toQuery(read)).toEqual({ sort: 'priority', class: 'T0,T2', priority: 'P1,none', from: 'jig-ui,none', q: 'login' });
    expect(toQuery(view())).toEqual({});
  });

  it('takes the default for what it does not know', () => {
    expect(fromQuery({ sort: 'rank', class: 'T9', priority: ['P2', 'P3'], q: null })).toEqual(view({ priorities: ['P2'] }));
  });

  it("offers a move within a column only in the queue's order, filtered or not", () => {
    expect(reorders(view({ text: 'login', priorities: ['P1'] }))).toBe(true);
    expect(reorders(view({ sort: 'priority' }))).toBe(false);
    expect(reorders(view({ sort: 'class' }))).toBe(false);
  });

  it('says whether a filter is on; a sort alone is none', () => {
    expect(filtered(view({ sort: 'class' }))).toBe(false);
    expect(filtered(view({ text: '  ' }))).toBe(false);
    expect(filtered(view({ priorities: ['P0'] }))).toBe(true);
    expect(filtered(view({ specs: ['none'] }))).toBe(true);
  });
});

describe('specsOf', () => {
  const of = (id: string, title: string | null) => ({ id, title, phase: null, epic: false });

  it('offers the specs of the board’s tasks by title, the id where Jig has none, then none for the rest', () => {
    const board = backlog(
      task('a', { spec: of('team-board', 'Team board') }),
      task('b'),
      task('c', { spec: of('jig-ui', 'Jig UI — a local control center') }),
      task('d', { spec: of('team-board', 'Team board') }),
      task('e', { spec: of('away', null) }),
    );
    expect(specsOf(board)).toEqual([
      { id: 'away', title: 'away' },
      { id: 'jig-ui', title: 'Jig UI — a local control center' },
      { id: 'team-board', title: 'Team board' },
      { id: 'none', title: 'None' },
    ]);
  });

  it('offers nothing while no task names a spec', () => {
    expect(specsOf(backlog(task('a'), task('b')))).toEqual([]);
    expect(specsOf(backlog(task('a', { spec: of('jig-ui', 'Jig UI') })))).toEqual([{ id: 'jig-ui', title: 'Jig UI' }]);
  });
});
