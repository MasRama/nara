const FEATURE_NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function featureNameIsValid(name: string): boolean {
  return FEATURE_NAME_PATTERN.test(name);
}
