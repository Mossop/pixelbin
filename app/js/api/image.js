import { postRequest } from "./api";

export async function upload(file, tags, date) {
  let request = await postRequest("upload", {
    file,
    tags,
    date: date.format("YYYY-MM-DDTHH:mm:ss"),
  });

  if (request.ok) {
    return request.json();
  } else {
    throw new Error("Upload failed");
  }
}
