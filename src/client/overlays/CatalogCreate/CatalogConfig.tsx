import React from "react";

import { TextField } from "../../components/Forms";
import { FieldState } from "../../utils/state";
import { ReactRef, ReactResult } from "../../utils/types";

export interface CatalogConfigProps {
  state: FieldState<string>;
  catalogNameRef: ReactRef;
}

export default function CatalogConfig({
  state,
  catalogNameRef,
}: CatalogConfigProps): ReactResult {
  return <TextField
    id="catalog-name"
    state={state}
    labelId="catalog-name"
    ref={catalogNameRef}
  />;
}
