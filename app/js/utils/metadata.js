import fileType from "file-type";
import { parseBuffer } from "media-metadata";
import moment from "moment";

function loadBlob(blob) {
  return new Promise((resolve) => {
    let reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.readAsArrayBuffer(blob);
  });
}

export async function detectMimeType(blobOrBuffer) {
  let buffer = (blobOrBuffer instanceof Blob) ? await loadBlob(blobOrBuffer) : blobOrBuffer;
  let type = fileType(buffer);
  if (!type) {
    return null;
  }

  return type.mime;
}

const EXIF_DATE_FORMAT = "YYYY:MM:DD HH:mm:ss";

function parseExifDate(datestr) {
  return moment(datestr, EXIF_DATE_FORMAT);
}

function buildMetadata(buffer, mimetype) {
  let mediadata = parseBuffer(buffer);
  console.log(mediadata);

  let metadata = {
    mimetype,
  };

  if ("exif" in mediadata) {
    if ("DateTimeOriginal" in mediadata.exif) {
      metadata.date = parseExifDate(mediadata.exif.DateTimeOriginal);
    } else if ("CreateDate" in mediadata.exif) {
      metadata.date = parseExifDate(mediadata.exif.CreateDate);
    }
  }

  if ("gps" in mediadata) {
    if (["GPSLatitude", "GPSLatitudeRef", "GPSLongitude", "GPSLongitudeRef"].every(p => p in mediadata.gps)) {
      let [deg, min, sec] = mediadata.gps.GPSLatitude;
      deg += min/60 + sec/3600;
      if (mediadata.gps.GPSLatitudeRef == "S") {
        deg = -deg;
      }
      metadata.latitude = deg;

      [deg, min, sec] = mediadata.gps.GPSLongitude;
      deg += min/60 + sec/3600;
      if (mediadata.gps.GPSLongitudeRef == "W") {
        deg = -deg;
      }
      metadata.longitude = deg;
    }
  }

  // Prefer xmp/iptc data when available
  if ("xmp" in mediadata) {
    if ("http://ns.adobe.com/xap/1.0/CreateDate" in mediadata.xmp) {
      metadata.date = moment(mediadata.xmp["http://ns.adobe.com/xap/1.0/CreateDate"]);
    }

    if ("http://ns.adobe.com/lightroom/1.0/hierarchicalSubject" in mediadata.xmp) {
      metadata.hierarchicalTags = mediadata.xmp["http://ns.adobe.com/lightroom/1.0/hierarchicalSubject"];
    }

    if ("http://purl.org/dc/elements/1.1/subject" in mediadata.xmp) {
      metadata.tags = mediadata.xmp["http://purl.org/dc/elements/1.1/subject"];
    }
  }

  console.log(metadata);

  return metadata;
}

export async function parseMetadata(blob) {
  try {
    let buffer = await loadBlob(blob);

    let type = await detectMimeType(buffer);
    switch (type) {
      case "image/jpeg":
        return buildMetadata(buffer, type);
      case "video/mp4":
        return { mimetype: "video/mp4" };
      default:
        throw new Error("Unknown file type");
    }
  } catch (e) {
    console.error("Failed to parse metadata", e);
    return {
      mimetype: null,
    };
  }
}

function loadVideo(video, url) {
  return new Promise((resolve, reject) => {
    video.addEventListener("canplay", resolve, { once: true });
    video.addEventListener("error", reject, { once: true });
    video.src = url;
  });
}

export async function createThumbnail(blob) {
  let type = await detectMimeType(blob);
  switch (type) {
    case "image/jpeg":
      return createImageBitmap(blob);
    case "video/mp4": {
      let video = document.createElement("video");
      let url = URL.createObjectURL(blob);
      await loadVideo(video, url);
      let bitmap = await createImageBitmap(video);
      URL.revokeObjectURL(url);
      return bitmap;
    }
    default:
      console.error(new Error("Unknown file type"));
  }
  return null;
}
