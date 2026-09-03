import { useMemo } from 'react'

import type { Key } from '@b41ex/qubership-apihub-ui-shared/entities/keys'
import type { ApiType } from '@b41ex/qubership-apihub-ui-shared/entities/api-types'
import type { ContractType } from '@b41ex/qubership-apihub-ui-shared/entities/contract-types'
import { getComparisonApiTypesFromSummary } from '@b41ex/qubership-apihub-ui-shared/entities/contracts-changes-summary'
import type { VersionChangesSummary } from '@b41ex/qubership-apihub-ui-shared/entities/version-changes-summary'
import {
  isDashboardComparisonSummary,
  isPackageComparisonSummary,
} from '@b41ex/qubership-apihub-ui-shared/entities/version-changes-summary'

export function useApiTypesFromChangesSummary(
  versionChangesSummary?: VersionChangesSummary,
  refPackageKey?: Key,
): Array<ApiType | ContractType> {
  return useMemo(
    () => {
      if (!versionChangesSummary) {
        return []
      }

      if (isDashboardComparisonSummary(versionChangesSummary)) {
        const refSummary = versionChangesSummary.find(summary => summary.refKey === refPackageKey)
        return getComparisonApiTypesFromSummary(
          refSummary?.operationTypes,
          refSummary?.contractsChangesSummary,
        )
      }

      if (isPackageComparisonSummary(versionChangesSummary)) {
        return getComparisonApiTypesFromSummary(
          versionChangesSummary.operationTypes,
          versionChangesSummary.contractsChangesSummary,
        )
      }

      return []
    },
    [refPackageKey, versionChangesSummary],
  )
}
