/**
 * Pure multi-select logic for file lists: plain click selects one item,
 * Cmd/Ctrl toggles, Shift selects the range from the anchor.
 */

export interface SelectionState {
  /** Selected item keys (paths). */
  selected: ReadonlySet<string>;
  /** Index of the last non-shift click; range start for shift-clicks. */
  anchor: number | null;
}

export const EMPTY_SELECTION: SelectionState = { selected: new Set(), anchor: null };

export interface ClickModifiers {
  meta?: boolean;
  shift?: boolean;
}

export function applyClick(
  state: SelectionState,
  keys: readonly string[],
  index: number,
  modifiers: ClickModifiers = {},
): SelectionState {
  const key = keys[index];
  if (key === undefined) return state;

  if (modifiers.shift && state.anchor !== null) {
    const [from, to] = state.anchor <= index ? [state.anchor, index] : [index, state.anchor];
    return { selected: new Set(keys.slice(from, to + 1)), anchor: state.anchor };
  }

  if (modifiers.meta) {
    const next = new Set(state.selected);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    return { selected: next, anchor: index };
  }

  return { selected: new Set([key]), anchor: index };
}

/** Drop selections that no longer exist after a refresh/navigation. */
export function pruneSelection(state: SelectionState, keys: readonly string[]): SelectionState {
  const valid = new Set(keys);
  const selected = new Set([...state.selected].filter((k) => valid.has(k)));
  return selected.size === state.selected.size ? state : { selected, anchor: null };
}
