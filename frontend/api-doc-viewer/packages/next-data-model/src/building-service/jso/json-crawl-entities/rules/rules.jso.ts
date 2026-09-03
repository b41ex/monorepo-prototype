import { JsoTreeNodeKinds } from "@apihub/next-data-model/model/jso/types/node-kind";
import { CrawlRules } from "@b41ex/qubership-apihub-json-crawl";
import { JsoCrawlRule } from "./types";

export function getJsoCrawlRules(): CrawlRules<JsoCrawlRule> {
  return {
    '/*': () => getJsoCrawlRules(),
    kind: JsoTreeNodeKinds.PROPERTY,
  }
}
