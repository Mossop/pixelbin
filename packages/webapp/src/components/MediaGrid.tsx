import { DateTime } from "luxon";
import mime from "mime-types";
import Link from "next/link";

import Icon from "./Icon";
import { MediaView } from "@/modules/types";
import { mediaDate, url } from "@/modules/util";

const THUMBNAILS = {
  alternateTypes: ["image/webp"],
  sizes: [150, 200, 250, 300, 350, 400, 450, 500],
};

interface MediaGroup {
  title: string;
  media: MediaView[];
}

function groupByTaken(mediaList: MediaView[]): MediaGroup[] {
  let sorted = mediaList.toSorted(
    (a, b) => mediaDate(b).toMillis() - mediaDate(a).toMillis(),
  );

  let titleFor = (dt: DateTime | null) =>
    dt ? `${dt.monthLong} ${dt.year}` : "";

  let indexFor = (dt: DateTime | null) =>
    dt ? dt.month - 1 + dt.year * 12 : null;

  let media = sorted.shift();
  if (!media) {
    return [];
  }

  let lastIndex = indexFor(mediaDate(media));
  let group: MediaGroup = {
    title: titleFor(mediaDate(media)),
    media: [media],
  };

  let groups = [group];

  // eslint-disable-next-line no-cond-assign
  while ((media = sorted.shift())) {
    let newIndex = indexFor(mediaDate(media));
    if (newIndex == lastIndex) {
      group.media.push(media);
    } else {
      group = { title: titleFor(mediaDate(media)), media: [media] };
      groups.push(group);
      lastIndex = newIndex;
    }
  }

  return groups;
}

function ThumbnailImage({ media }: { media: MediaView }) {
  let { file } = media;
  if (!file) {
    return (
      <div className="thumbnail d-flex align-items-center justify-content-center">
        <Icon icon="hourglass" />
      </div>
    );
  }

  let { filename } = media;
  if (filename) {
    let pos = filename.lastIndexOf(".");
    if (pos > 0) {
      filename = filename.substring(0, pos);
    }
  } else {
    filename = "image";
  }

  let sources = (mimetype: string) => {
    let extension = mime.extension(mimetype);
    let urlMimetype = mimetype.replace("/", "-");

    return THUMBNAILS.sizes
      .map(
        (size) =>
          `${url([
            "media",
            media.id,
            file!.id,
            "thumb",
            size.toString(),
            urlMimetype,
            `${filename}.${extension}`,
          ])} ${size}w`,
      )
      .join(",");
  };

  return (
    <picture>
      {THUMBNAILS.alternateTypes.map((type) => (
        <source key={type} sizes="150px" srcSet={sources(type)} type={type} />
      ))}
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <img
        loading="lazy"
        decoding="async"
        sizes="150px"
        srcSet={sources("image/jpeg")}
        className="thumbnail d-block object-fit-contain"
      />
    </picture>
  );
}

function Rating({ media }: { media: MediaView }) {
  let { rating } = media;
  if (rating === null) {
    return <div />;
  }

  return (
    <div className="rating d-flex justify-content-start align-items-center gap-1">
      <div className={rating >= 1 ? "filled" : "unfilled"}>
        <Icon icon="star-fill" />
      </div>
      <div className={rating >= 2 ? "filled" : "unfilled"}>
        <Icon icon="star-fill" />
      </div>
      <div className={rating >= 3 ? "filled" : "unfilled"}>
        <Icon icon="star-fill" />
      </div>
      <div className={rating >= 4 ? "filled" : "unfilled"}>
        <Icon icon="star-fill" />
      </div>
      <div className={rating >= 5 ? "filled" : "unfilled"}>
        <Icon icon="star-fill" />
      </div>
    </div>
  );
}

function FileType({ media }: { media: MediaView }) {
  if (!media.file) {
    return <div />;
  }

  let { mimetype } = media.file;
  let pos = mimetype.indexOf("/");
  if (pos >= 0) {
    mimetype = mimetype.substring(0, pos);
  }

  switch (mimetype) {
    case "image":
      return <Icon icon="image" />;
    case "video":
      return <Icon icon="film" />;
    default:
      return <Icon icon="file-earmark" />;
  }
}

export default function MediaGrid({
  base,
  media,
}: {
  base: string[];
  media: MediaView[];
}) {
  let groups = groupByTaken(media);

  return groups.map((group) => (
    <section key={group.title}>
      <div className="p-2 position-sticky top-0 mediagroup">
        <h2 className="p-0 m-0 fw-normal">{group.title}</h2>
      </div>
      <div className="thumbnail-grid d-grid gap-2 px-2 pb-4">
        {group.media.map((m) => (
          <Link
            key={m.id}
            href={url([...base, "media", m.id])}
            className="inner d-block border shadow text-body bg-body rounded-1 p-2 position-relative"
          >
            <ThumbnailImage media={m} />
            <div className="overlay position-absolute bottom-0 p-2 start-0 end-0 d-flex flex-row justify-content-between align-items-center">
              <Rating media={m} />
              <FileType media={m} />
            </div>
          </Link>
        ))}
      </div>
    </section>
  ));
}
