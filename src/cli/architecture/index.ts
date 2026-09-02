export { discoverFeatures } from './discover-features';
export type {
  DiscoveredFeature,
  FeatureDiscovery,
  MalformedFeatureEntry,
} from './discover-features';
export { discoverFeatureDependencies } from './discover-dependencies';
export type {
  DependencyDiscovery,
  FeatureDependency,
} from './discover-dependencies';
export { detectCrossFeatureInternalImports } from './validate-boundaries';
export type { BoundaryViolation } from './validate-boundaries';
export { detectFeatureDependencyCycles } from './detect-cycles';
export type { FeatureDependencyCycle } from './detect-cycles';
export { detectServerClientLeaks } from './detect-client-leaks';
export type { ServerClientLeak } from './detect-client-leaks';
export { analyzeArchitecture } from './doctor';
export type { DoctorIssue, DoctorIssueCode, DoctorReport } from './doctor';
export { inspectFeature } from './inspect';
export type { FeatureInspection, InspectFeatureResult } from './inspect';
export { buildFeatureContext } from './context';
export type { FeatureContext, FeatureContextResult } from './context';
export { inspectFeatureImpact } from './impact';
export type { FeatureImpact, FeatureImpactResult } from './impact';
