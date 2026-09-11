/**
 * Public entry point for @b41ex/qubership-apihub-api-diff.
 *
 * Everything re-exported below is API surface. Anything not listed here is internal and may
 * change without a major bump, so add an export deliberately rather than to reach one symbol.
 *
 * Deep imports are not supported. Reach a symbol through this entry point or not at all;
 * `dist/` layout is an implementation detail and is free to move between releases.
 */
export { COMPARE_MODE_DEFAULT, COMPARE_MODE_OPERATION, API_COMPATIBILITY_KIND_BACKWARD_COMPATIBLE, API_COMPATIBILITY_KIND_NOT_BACKWARD_COMPATIBLE } from './types'

export {
  ClassifierType,
  DiffAction,
  DIFFS_AGGREGATED_META_KEY,
  DIFF_META_KEY,
  breaking,
  nonBreaking,
  unclassified,
  annotation,
  deprecated,
  risky,
} from './core'

export { apiDiff } from './api'
export type {
  CompareResult,
  CompareOptions,
  ApiCompatibilityScopeFunction,
  ApiCompatibilityKind,
  DiffType,
  ActionType,
  Diff,
  DiffAdd,
  DiffRemove,
  DiffReplace,
  DiffRename,
  DiffMetaRecord,
} from './types'

export {
  isDiffAdd,
  isDiffRemove,
  isDiffRename,
  isDiffReplace,
} from './utils'

export {
  aggregateDiffsWithRollup,
  extractOperationBasePath,
  onlyExistedArrayIndexes
} from './utils'

