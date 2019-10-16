import { buildFormBody, request } from "./api";

export interface UploadInfo {
  filename: string;
  title: string;
  tags: string[][];
  people: string[];
  orientation: number;
  catalog: string;
}

export async function upload(metadata: UploadInfo, file: Blob): Promise<void> {
  let body = buildFormBody({
    metadata: JSON.stringify(metadata),
    file,
  });

  await request("media/upload", "PUT", body);
}
