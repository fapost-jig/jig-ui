import type { InjectionKey } from 'vue';

/**
 * Whether a question or a report that opens as a dialog on the page draws in place instead: the canvas, which shows
 * every one of them at once, provides `true`.
 */
export const INLINE_DIALOGS: InjectionKey<boolean> = Symbol('inline dialogs');
