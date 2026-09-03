import { useEffect } from 'react'
import { useParams } from 'react-router-dom'

import { getDefaultApiType } from '@portal/utils/operation-types'
import type { ApiType } from '@b41ex/qubership-apihub-ui-shared/entities/api-types'
import { type ContractType, toRouteApiType } from '@b41ex/qubership-apihub-ui-shared/entities/contract-types'
import { DEFAULT_API_TYPE } from '@b41ex/qubership-apihub-ui-shared/entities/operations'
import { isEmpty } from '@b41ex/qubership-apihub-ui-shared/utils/arrays'

import { useSetPathParam } from './useSetPathParam'

export function useEnsureValidRouteApiType(
  allowedApiTypes: ReadonlyArray<ApiType | ContractType>,
  isLoading: boolean,
): void {
  const { apiType = DEFAULT_API_TYPE } = useParams<{
    apiType?: ApiType | ContractType
  }>()
  const routeApiType = toRouteApiType(apiType)
  const setPathParam = useSetPathParam()

  useEffect(() => {
    if (isLoading || isEmpty(allowedApiTypes)) {
      return
    }
    if (!allowedApiTypes.includes(routeApiType)) {
      setPathParam(getDefaultApiType(allowedApiTypes))
    }
  }, [allowedApiTypes, isLoading, routeApiType, setPathParam])
}
