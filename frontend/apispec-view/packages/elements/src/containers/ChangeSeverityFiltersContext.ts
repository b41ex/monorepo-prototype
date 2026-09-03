import { createContext, useContext } from "react";
import { DiffType } from "@b41ex/qubership-apihub-api-diff";

export const ChangeSeverityFiltersContext = createContext<DiffType[]>([])

export function useChangeSeverityFilters(): DiffType[] {
  return useContext(ChangeSeverityFiltersContext)
}