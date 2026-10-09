/** How a reported action changed things; feeds group and mark entries by it. */
export const ACTIVITY_KINDS = ['create', 'update', 'delete', 'access'] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

/**
 * Something a Feature reports happened, declared by the Feature in
 * provider-neutral terms. Whichever Feature keeps the activity trail turns it
 * into the `<resource>.<action>` slug and shows `label` for it.
 */
export interface ActivityDeclaration {
  action: string;
  label: string;
  kind: ActivityKind;
}

export type ActivityMetadataValue = string | number | boolean | null;

/** One report, typed by what its Feature declared: an undeclared action does not compile. */
export interface ReportedActivity<Resource extends string, Declared extends readonly ActivityDeclaration[]> {
  action: `${Resource}.${Declared[number]['action']}`;
  resource: Resource;
  actorId: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  metadata?: Record<string, ActivityMetadataValue>;
}

/**
 * Supplied by the application to the bindings of Features that report
 * activity: `declare` registers what a resource reports and returns the sink
 * its Feature reports through, so a sink never exists for undeclared actions.
 */
export interface ActivityReporter {
  declare<Resource extends string, const Declared extends readonly ActivityDeclaration[]>(
    resource: Resource,
    declarations: Declared,
  ): (activity: ReportedActivity<Resource, Declared>) => void;
}
