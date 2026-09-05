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
export { detectApplicationFeatureInternalImports, detectCrossFeatureInternalImports } from './validate-boundaries';
export type { ApplicationBoundaryViolation, BoundaryViolation } from './validate-boundaries';
export { detectFeatureDependencyCycles } from './detect-cycles';
export type { FeatureDependencyCycle } from './detect-cycles';
export { detectServerClientLeaks } from './detect-client-leaks';
export type { ServerClientLeak } from './detect-client-leaks';
export { analyzeArchitecture } from './doctor';
export type { DoctorIssue, DoctorIssueCode, DoctorReport } from './doctor';
export { captureArchitectureSnapshot } from './snapshot';
export type {
  ArchitectureSnapshot,
  SnapshotDiagnostic,
  SnapshotEdge,
  SnapshotFeature,
} from './snapshot';
export { computeAffected, diffSnapshots } from './diff';
export type {
  AffectedSet,
  ArchitectureChanges,
  DependencyDelta,
  DiagnosticDelta,
  ExportDelta,
  SurfaceDelta,
} from './diff';
export { inspectFeature } from './inspect';
export type { FeatureInspection, InspectFeatureResult } from './inspect';
export { ARCHITECTURE_CONSTRAINTS, buildFeatureContext, buildFeatureContextForFile, resolveOwningFeature } from './context';
export type {
  ArchitectureConstraint,
  ArchitectureContextOwnership,
  ArchitectureContextPack,
  ArchitectureContextPublicApi,
  ArchitectureContextRelationships,
  ArchitectureContextSurfaces,
  ArchitectureContextTarget,
  ArchitectureReadingEntry,
  FeatureContextResult,
  OwningFeatureResult,
} from './context';
export { inspectFeatureImpact } from './impact';
export type { FeatureImpact, FeatureImpactResult } from './impact';
