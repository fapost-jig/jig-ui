/** What Jig answers for a document it read: its words, or why not (an older Jig, an unreadable project, a refusal). */
export type DocumentAnswer =
  | {
      state: 'ready';
      content: string;
      lossy: boolean;
    }
  | {
      state: 'unsupported' | 'incompatible' | 'unavailable' | 'unreadable';
      code?: string;
    };

/**
 * A document open in a dialog, being read or as read: what a page holds while it asks Jig for the document's words.
 * `T` is the answer of the RPC call that reads it, so a renamed field fails the typecheck where the document is read.
 */
export type DocumentRead<T extends DocumentAnswer = DocumentAnswer> = 'reading' | 'not-found' | 'failed' | T;

/** What a document's dialog shows: being read, gone, unreadable (and for what reason), or its words. */
export type ShownDocument =
  | { state: 'reading' | 'not-found' | 'failed' | 'epic-missing' }
  | {
      state: 'ready';
      content: string;
      lossy: boolean;
    };

/**
 * An open document as its dialog shows it: anything Jig answered but its words — an older Jig, an unreadable project — is a
 * failure, except a roadmap Jig refuses because its epic's branch is nowhere: that is read again to no avail.
 */
export function shownDocument(read: DocumentRead): ShownDocument {
  if (typeof read === 'string') return { state: read };
  if (read.state === 'ready') return { state: 'ready', content: read.content, lossy: read.lossy };
  return { state: read.state === 'unreadable' && read.code === 'epic-missing' ? 'epic-missing' : 'failed' };
}

/** A document a page holds open: whose it is (a spec's, a task's), which one, and how far its read is. */
export type OpenDocument<K extends string, T extends DocumentAnswer = DocumentAnswer> = {
  owner: string;
  kind: K;
  read: DocumentRead<T>;
};

/** A document just opened, or opened again (Read again): being read. */
export function opened<K extends string, T extends DocumentAnswer>(owner: string, kind: K): OpenDocument<K, T> {
  return { owner, kind, read: 'reading' };
}

/** The open document as its owner shows it: none once another owner is chosen. */
export function ownedBy<D extends { owner: string }>(open: D | undefined, owner: string): D | undefined {
  return open?.owner === owner ? open : undefined;
}

/** The open document with `read` landed in it, only when that read is of the document still open: a late read of a closed or replaced one is discarded. */
export function landed<K extends string, T extends DocumentAnswer>(
  open: OpenDocument<K, T> | undefined,
  read: OpenDocument<K, T>,
): OpenDocument<K, T> | undefined {
  return open?.owner === read.owner && open.kind === read.kind ? { ...open, read: read.read } : open;
}
