import type { ApiType } from '@b41ex/qubership-apihub-ui-shared/entities/api-types'
import type { ContractType } from '@b41ex/qubership-apihub-ui-shared/entities/contract-types'
import type { Key } from '@b41ex/qubership-apihub-ui-shared/entities/keys'
import type { VersionChangesSummary } from '@b41ex/qubership-apihub-ui-shared/entities/version-changes-summary'

import { useApiTypesFromChangesSummary } from './useApiTypesFromChangesSummary'

export function useCompareAllowedApiTypes(
  versionChangesSummary?: VersionChangesSummary,
  refPackageKey?: Key,
): Array<ApiType | ContractType> {
  return useApiTypesFromChangesSummary(versionChangesSummary, refPackageKey)
}
