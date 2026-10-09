import type { ActivityDeclaration } from '../../../shared/security';
import type { DeclaredActivity } from '../contract';

const SEGMENT = /^[a-z][a-z0-9-]*$/;

/**
 * What reporting Features declared, in declaration order. The feed labels and
 * offers filters from it; Activity never lists another Feature's actions.
 * Stored events whose action nobody declares still show, with a plain label.
 */
export function createActivityCatalog() {
  const declared = new Map<string, DeclaredActivity>();

  // An identical declaration may arrive again: the dev server re-evaluates
  // bindings after a server-side edit while this module stays loaded.
  function declare(resource: string, declarations: readonly ActivityDeclaration[]): void {
    const incoming: DeclaredActivity[] = [];
    for (const declaration of declarations) {
      const action = `${resource}.${declaration.action}`;
      if (!SEGMENT.test(resource) || !SEGMENT.test(declaration.action)) {
        throw new Error(`Activity "${action}" must be <resource>.<action> in lowercase kebab-case.`);
      }
      const known = declared.get(action) ?? incoming.find((pending) => pending.action === action);
      if (known) {
        if (known.label !== declaration.label || known.kind !== declaration.kind) {
          throw new Error(`Activity "${action}" is declared twice with different labels or kinds.`);
        }
        continue;
      }
      incoming.push({ action, label: declaration.label, kind: declaration.kind });
    }
    for (const activity of incoming) declared.set(activity.action, activity);
  }

  return {
    declare,
    list: (): DeclaredActivity[] => [...declared.values()],
  };
}

const catalog = createActivityCatalog();

/** Called by the bindings of Features that report activity, while composing the application. */
export const declareActivity = catalog.declare;
export const declaredActivity = catalog.list;
