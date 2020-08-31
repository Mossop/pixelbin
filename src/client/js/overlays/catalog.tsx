import React, { useCallback, useRef, useState } from "react";

import { createCatalog } from "../api/catalog";
import { UserState } from "../api/types";
import FormDialog from "../components/FormDialog";
import { useActions } from "../store/actions";
import { AppError } from "../utils/exception";
import { useFormState } from "../utils/hooks";
import { ReactResult } from "../utils/types";

export interface CatalogOverlapProps {
  user: UserState;
}

export default function CatalogOverlay(props: CatalogOverlapProps): ReactResult {
  let [state, setState] = useFormState({
    catalogName: "",
    storageName: "",
    accessKeyId: "",
    secretAccessKey: "",
    region: "",
    bucket: "",
    path: "",
    endpoint: "",
    publicUrl: "",
  });
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const actions = useActions();
  const nameInput = useRef<HTMLElement>(null);

  const onSubmit = useCallback(async () => {
    if (!state.catalogName || !state.storageName || !state.accessKeyId || !state.secretAccessKey ||
      !state.region || !state.bucket) {
      return;
    }

    setDisabled(true);
    setError(null);

    let storage = {
      name: state.storageName,
      accessKeyId: state.accessKeyId,
      secretAccessKey: state.secretAccessKey,
      region: state.region,
      bucket: state.bucket,
      path: state.path ? state.path : null,
      endpoint: state.endpoint ? state.endpoint : null,
      publicUrl: state.publicUrl ? state.publicUrl : null,
    };

    try {
      let catalog = await createCatalog(state.catalogName, storage);
      actions.catalogCreated(catalog);
    } catch (e) {
      setError(e);
      nameInput.current?.focus();
    } finally {
      setDisabled(false);
    }
  }, [actions, state]);

  return <FormDialog
    state={state}
    setState={setState}
    error={error}
    disabled={disabled}
    titleId={props.user.hadCatalog ? "catalog-create-title" : "catalog-create-title-first"}
    submitId="catalog-create-submit"
    onSubmit={onSubmit}
    onClose={actions.closeOverlay}
    fields={
      [{
        type: "text",
        key: "catalogName",
        label: "catalog-name",
        props: {
          inputRef: nameInput,
          autoFocus: true,
        },
      }, {
        type: "text",
        key: "storageName",
        label: "storage-name",
      }, {
        type: "text",
        key: "accessKeyId",
        label: "storage-access-key",
      }, {
        type: "text",
        key: "secretAccessKey",
        label: "storage-secret-key",
      }, {
        type: "text",
        key: "region",
        label: "storage-region",
      }, {
        type: "text",
        key: "bucket",
        label: "storage-bucket",
      }, {
        type: "text",
        key: "path",
        label: "storage-path",
      }, {
        type: "text",
        key: "endpoint",
        label: "storage-endpoint",
      }, {
        type: "text",
        key: "publicUrl",
        label: "storage-public-url",
      }]
    }
  />;
}
