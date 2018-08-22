import { postRequest } from "./api";

export async function upload(file, tags, date, gps) {
  let params = {
    file,
    tags,
    date: date.format("YYYY-MM-DDTHH:mm:ss"),
  };

  if (gps) {
    params.latitude = gps.latitude;
    params.longitude = gps.longitude;
  }

  let request = await postRequest("upload", params);

  if (request.ok) {
    return request.json();
  } else {
    throw new Error("Upload failed");
  }
}
