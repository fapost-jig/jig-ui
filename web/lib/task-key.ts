/**
 * What a closed card's head names its task by: the tracker's key at the head of its id (`SRD-2598` of
 * `SRD-2598-long-term-storage-threshold`), whose rest the goal says. `null` where the card shows the whole id: no goal
 * — the id is the card's title —, an open card, or an id with no key.
 */
export function cardKey(id: string, goal: string | null, open: boolean): string | null {
  if (!goal || open) return null;
  return /^[A-Z][A-Z0-9]*-\d+(?=-|$)/.exec(id)?.[0] ?? null;
}
