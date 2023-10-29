/* eslint-disable jsx-a11y/alt-text */
import mime from "mime-types";

import { MediaView } from "@/modules/types";
import Icon from "./Icon";
import Link from "next/link";
import { DateTime } from "luxon";
import { url } from "@/modules/util";

const THUMBNAILS = {
  alternateTypes: ["image/webp"],
  sizes: [150, 200, 250, 300, 350, 400, 450, 500],
};

interface MediaGroup {
  title: string;
  media: MediaView[];
}

function groupByTaken(mediaList: MediaView[]): MediaGroup[] {
  let sorted = mediaList.toSorted((a, b) => {
    if (!a.taken && !b.taken) {
      return b.created.toMillis() - a.created.toMillis();
    }

    if (!a.taken) {
      return 1;
    }

    if (!b.taken) {
      return -1;
    }

    return b.taken.toMillis() - a.taken.toMillis();
  });

  let titleFor = (dt: DateTime | null) =>
    dt ? `${dt.monthLong} ${dt.year}` : "";

  let indexFor = (dt: DateTime | null) =>
    dt ? dt.month - 1 + dt.year * 12 : null;

  let media = sorted.shift();
  if (!media) {
    return [];
  }

  let lastIndex = indexFor(media.taken);
  let group: MediaGroup = {
    title: titleFor(media.taken),
    media: [media],
  };

  let groups = [group];

  while ((media = sorted.shift())) {
    let newIndex = indexFor(media.taken);
    if (newIndex == lastIndex) {
      group.media.push(media);
    } else {
      group = { title: titleFor(media.taken), media: [media] };
      groups.push(group);
      lastIndex = newIndex;
    }
  }

  return groups;
}

function ThumbnailImage({ media }: { media: MediaView }) {
  let file = media.file;
  if (!file) {
    return (
      <div
        style={{ width: "100%", height: "100%" }}
        className="d-flex align-items-center justify-content-center"
      >
        <Icon icon="hourglass" />
      </div>
    );
  }

  let filename = media.filename;
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
      <img
        loading="lazy"
        decoding="async"
        sizes="150px"
        srcSet={sources("image/jpeg")}
        className="d-block object-fit-contain"
        style={{
          width: "100%",
          aspectRatio: 1,
          objectPosition: "center center",
        }}
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
        {group.media.map((media) => (
          <Link
            key={media.id}
            href={url([...base, "media", media.id])}
            className="inner d-block border shadow text-body bg-body rounded-1 p-2 position-relative"
          >
            <ThumbnailImage media={media} />
            <div className="overlay position-absolute bottom-0 p-2 start-0 end-0 d-flex flex-row justify-content-between align-items-center">
              <Rating media={media} />
              <FileType media={media} />
            </div>
          </Link>
        ))}
      </div>
    </section>
  ));
}
