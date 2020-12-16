import { useEffect, useRef } from "react";

import { TextField } from "../../components/Forms";
import type { FieldState } from "../../utils/state";
import type { ReactResult } from "../../utils/types";

export interface CatalogConfigProps {
  visible: boolean;
  state: FieldState<string>;
}

export default function CatalogConfig({
  visible,
  state,
}: CatalogConfigProps): ReactResult {
  let nameRef = useRef<HTMLElement>();

  useEffect(() => {
    if (visible) {
      nameRef.current?.focus();
    }
  }, [nameRef, visible]);

  return <TextField
    id="catalog-name"
    state={state}
    labelId="catalog-name"
    required={true}
    ref={nameRef}
  />;
}
