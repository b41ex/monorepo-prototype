import { type FC, memo, useState } from 'react'

import { ContractPreviewPanel } from '@b41ex/qubership-apihub-ui-shared/components/ContractPreviewPanel'
import { DdlTableTitleWithMeta } from '@b41ex/qubership-apihub-ui-shared/components/Ddl/DdlTableTitleWithMeta'
import { DdlTableViewModeToggler } from '@b41ex/qubership-apihub-ui-shared/components/Ddl/DdlTableViewModeToggler'
import type { SpecViewMode } from '@b41ex/qubership-apihub-ui-shared/components/SpecViewToggler'
import { DOC_SPEC_VIEW_MODE } from '@b41ex/qubership-apihub-ui-shared/components/SpecViewToggler'
import type {
  DdlContractEntity,
  DdlContractEntityDetails,
} from '@b41ex/qubership-apihub-ui-shared/entities/contracts-ddl'
import type { Key } from '@b41ex/qubership-apihub-ui-shared/entities/keys'

import { DdlTableContentView } from './DdlTableContentView'

export type DdlTablePreviewProps = {
  table: DdlContractEntity | undefined
  tableDetails: DdlContractEntityDetails | undefined
  isLoading: boolean
  maxWidthHeaderToolbar?: number
  noHeading?: boolean
  entityPackageKey?: Key
  entityVersionKey?: Key
}

export const DdlTablePreview: FC<DdlTablePreviewProps> = memo<DdlTablePreviewProps>((props) => {
  const {
    table,
    tableDetails,
    isLoading,
    maxWidthHeaderToolbar,
    noHeading = false,
    entityPackageKey,
    entityVersionKey,
  } = props

  const [viewMode, setViewMode] = useState<SpecViewMode>(DOC_SPEC_VIEW_MODE)

  return (
    <ContractPreviewPanel
      title={table && <DdlTableTitleWithMeta onlyTitle table={table} />}
      action={<DdlTableViewModeToggler mode={viewMode} onChange={setViewMode} />}
      isLoading={isLoading}
      hasContent={!!table}
      maxWidthHeaderToolbar={maxWidthHeaderToolbar}
      data-testid="DdlTablePreview"
    >
      <DdlTableContentView
        data={tableDetails}
        viewMode={viewMode}
        noHeading={noHeading}
        entityPackageKey={entityPackageKey}
        entityVersionKey={entityVersionKey}
      />
    </ContractPreviewPanel>
  )
})

DdlTablePreview.displayName = 'DdlTablePreview'
