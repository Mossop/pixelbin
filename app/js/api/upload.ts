import { buildFormBody, request } from "./api";
import { Catalog } from "./types";

export interface UploadInfo {
  title: string;
  tags: string[][];
  people: string[];
  orientation: number;
  catalog: Catalog;
}

export async function upload(metadata: UploadInfo, file: Blob): Promise<void> {
  let data = {
    ...metadata,
    catalog: metadata.catalog.id,
  };

  let body = buildFormBody({
    metadata: JSON.stringify(data),
    file,
  });

  await request("media/upload", "PUT", body);
}
