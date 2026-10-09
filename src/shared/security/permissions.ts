/**
 * An action a Feature gates, declared by the Feature in provider-neutral
 * terms. The application's binding hands it to whichever Feature owns access
 * control, which turns it into the `<resource>.<action>` permission slug.
 */
export interface PermissionDeclaration {
  action: string;
  name: string;
  description?: string;
}
