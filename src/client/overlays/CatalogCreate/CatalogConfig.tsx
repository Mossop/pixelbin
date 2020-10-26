import React from "react";

import FormFields from "../../components/FormFields";
import { FormStateSetter } from "../../utils/hooks";
import { ReactRef, ReactResult } from "../../utils/types";

export interface CatalogState {
  catalogName: string;
}

export interface CatalogConfigProps {
  disabled: boolean;
  catalogState: CatalogState;
  setCatalogState: FormStateSetter<CatalogState>;
  catalogNameRef: ReactRef;
}

export default function CatalogConfig({
  disabled,
  setCatalogState,
  catalogState,
  catalogNameRef,
}: CatalogConfigProps): ReactResult {
  return <FormFields
    id="stepped-dialog"
    state={catalogState}
    setState={setCatalogState}
    disabled={disabled}
    fields={
      [{
        type: "text",
        ref: catalogNameRef,
        key: "catalogName",
        label: "catalog-name",
        required: true,
      }]
    }
  />;
}
