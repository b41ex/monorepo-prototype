import { ApihubApiCompatibilityKind } from '../../consts'
import { ApiCompatibilityScopeFunction } from '@b41ex/qubership-apihub-api-diff'

export type ApiCompatibilityScopeFunctionFactory = (
  prevDocumentApiKind?: ApihubApiCompatibilityKind,
  currDocumentApiKind?: ApihubApiCompatibilityKind,
) => ApiCompatibilityScopeFunction
