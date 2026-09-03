import { DiffMetaKeys } from "@b41ex/qubership-apihub-api-data-model";
import { createContext, useContext } from "react";

export const DiffMetaKeysContext = createContext<DiffMetaKeys | undefined>(undefined)

export function useDiffMetaKeys(): DiffMetaKeys | undefined {
  return useContext(DiffMetaKeysContext)
}
