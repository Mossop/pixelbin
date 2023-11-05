/* eslint-disable prefer-arrow-callback */

"use client";

import mime from "mime-types";
import Link from "next/link";
import { memo } from "react";

import Icon from "./Icon";
import { Group, useGalleryBase, useGalleryGroups } from "./MediaGallery";
import { MediaView } from "@/modules/types";
import { url } from "@/modules/util";

const THUMBNAILS = {
  alternateTypes: ["image/webp"],
  sizes: [150, 200, 250, 300, 350, 400, 450, 500],
};

const ThumbnailImage = memo(function ThumbnailImage({
  media,
}: {
  media: MediaView;
}) {
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
});

const Rating = memo(function Rating({ media }: { media: MediaView }) {
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
});

const FileType = memo(function FileType({ media }: { media: MediaView }) {
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
});

const MediaItem = memo(function MediaItem({
  base,
  media,
}: {
  base: string[];
  media: MediaView;
}) {
  return (
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
  );
});

const MediaGroup = memo(function MediaGroup({
  base,
  group,
}: {
  base: string[];
  group: Group;
}) {
  return (
    <section>
      <div className="p-2 position-sticky top-0 mediagroup">
        <h2 className="p-0 m-0 fw-normal">{group.title}</h2>
      </div>
      <div className="thumbnail-grid d-grid gap-2 px-2 pb-4">
        {group.media.map((m) => (
          <MediaItem key={m.id} base={base} media={m} />
        ))}
      </div>
    </section>
  );
});

export default function MediaGrid() {
  let base = useGalleryBase();
  let groups = useGalleryGroups();

  if (!groups) {
    return null;
  }

  return groups.map((group) => (
    <MediaGroup key={group.id} base={base} group={group} />
  ));
}
