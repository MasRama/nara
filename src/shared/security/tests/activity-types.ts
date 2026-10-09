import type { ActivityDeclaration, ActivityReporter } from '../activity';

const BILLING_ACTIVITY = [
  { action: 'invoice-sent', label: 'Invoice sent', kind: 'create' },
] as const satisfies readonly ActivityDeclaration[];

/**
 * Compile-time checks that a reporter only takes what its Feature declared:
 * `npm run lint` fails when an `@ts-expect-error` below stops being an error.
 * Never called.
 */
export function activityReportTypes(activity: ActivityReporter): void {
  const report = activity.declare('billing', BILLING_ACTIVITY);

  report({ action: 'billing.invoice-sent', resource: 'billing', actorId: null });
  // @ts-expect-error billing never declared a refund
  report({ action: 'billing.refunded', resource: 'billing', actorId: null });
  // @ts-expect-error the action belongs to the declared resource
  report({ action: 'auth.invoice-sent', resource: 'billing', actorId: null });
  // @ts-expect-error the resource is the one declared
  report({ action: 'billing.invoice-sent', resource: 'auth', actorId: null });

  // @ts-expect-error kinds are create, update, delete, or access
  activity.declare('billing', [{ action: 'sent', label: 'Sent', kind: 'moved' }]);
}
