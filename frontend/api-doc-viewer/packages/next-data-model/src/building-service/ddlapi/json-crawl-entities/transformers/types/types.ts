import { JsonPath } from "@b41ex/qubership-apihub-json-crawl";

export type DdlApiTransformFunc<S> =
  (
    key: PropertyKey,
    value: unknown,
    source: unknown,
    path: JsonPath,
    state: S,
  ) => unknown;
