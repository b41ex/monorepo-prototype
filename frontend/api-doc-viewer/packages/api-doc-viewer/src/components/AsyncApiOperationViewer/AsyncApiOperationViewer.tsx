import { DEFAULT_DISPLAY_MODE } from "../../consts/configuration";
import { DisplayModeContext } from "../../contexts/DisplayModeContext";
import { LayoutModeContext } from "../../contexts/LayoutModeContext";
import { LevelContext } from "../../contexts/LevelContext";
import { DisplayMode } from "../../types/DisplayMode";
import { DOCUMENT_LAYOUT_MODE } from "../../types/LayoutMode";
import { AsyncApiTreeBuilder, createAsyncApiLogger } from "@netcracker/qubership-apihub-next-data-model";
import { FC, memo, useMemo } from "react";
import { ErrorBoundary } from "../services/ErrorBoundary";
import { ErrorBoundaryFallback } from "../services/ErrorBoundaryFallback";
import { AsyncApiDevModeContext } from "./AsyncApiDevModeContext";
import { MessageNodeViewer } from "./MessageNodeViewer";

import { OperationKeys } from "@apihub/next-data-model/shared/async-api/types/operation-keys";
import { isMessageNode } from "../../utils/async-api/node-type-checkers";
import '../../index.css';

export type AsyncApiOperationViewerProps = {
  source: unknown
  operationKeys?: OperationKeys
  displayMode?: DisplayMode
  devMode?: boolean
  noHeading?: boolean
  referenceNamePropertyKey: symbol
}

export const AsyncApiOperationViewer: FC<AsyncApiOperationViewerProps> =
  memo<AsyncApiOperationViewerProps>(props => {
    if (props.source === null) {
      return null
    }

    return (
      <ErrorBoundary fallback={<ErrorBoundaryFallback componentName="Async API Operation Viewer" />}>
        <AsyncApiOperationViewerInner {...props} />
      </ErrorBoundary>
    )
  })

const AsyncApiOperationViewerInner: FC<AsyncApiOperationViewerProps> =
  memo<AsyncApiOperationViewerProps>(props => {
    const {
      source,
      operationKeys,
      displayMode = DEFAULT_DISPLAY_MODE,
      devMode = false,
      noHeading = false,
      referenceNamePropertyKey,
    } = props

    const logger = useMemo(() => createAsyncApiLogger(devMode), [devMode])

    const treeBuilder = useMemo(
      () => new AsyncApiTreeBuilder({
        source,
        referenceNamePropertyKey,
        operationKeys,
        logger,
      }),
      [source, operationKeys, referenceNamePropertyKey, logger]
    )
    const tree = useMemo(() => treeBuilder?.build() ?? null, [treeBuilder])

    logger.debug('[AsyncAPI] Original Source:', source)
    logger.debug('[AsyncAPI] Tree:', tree)

    const messageNode = tree?.root
    if (!messageNode || !isMessageNode(messageNode)) {
      return null
    }

    return (
      <AsyncApiDevModeContext.Provider value={devMode}>
        <DisplayModeContext.Provider value={displayMode}>
          <LayoutModeContext.Provider value={DOCUMENT_LAYOUT_MODE}> {/* Now only 1 layout mode is supported */}
            <LevelContext.Provider value={0}>
              <MessageNodeViewer
                node={messageNode}
                noHeading={noHeading}
              />
            </LevelContext.Provider>
          </LayoutModeContext.Provider>
        </DisplayModeContext.Provider>
      </AsyncApiDevModeContext.Provider>
    )
  })
