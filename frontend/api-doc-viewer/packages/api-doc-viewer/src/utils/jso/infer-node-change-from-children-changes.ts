import { ActionType } from "@b41ex/qubership-apihub-api-diff";
import { JsoTreeNodeWithDiffs } from "@b41ex/qubership-apihub-next-data-model/model/jso/types/aliases";

export function isSameDiffActionForAll(jsoProperties: JsoTreeNodeWithDiffs[]): boolean {
  let diffAction: ActionType | undefined
  for (const jsoProperty of jsoProperties) {
    const childNodeValueDiff = jsoProperty.diffs['']
    if (!childNodeValueDiff) {
      return false
    }
    if (!diffAction) {
      diffAction = childNodeValueDiff.data.action
      continue
    }
    if (diffAction !== childNodeValueDiff.data.action) {
      return false
    }
  }
  return true
}
