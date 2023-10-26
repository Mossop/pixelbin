/* eslint-disable jsx-a11y/alt-text */
import mime from "mime-types";

import { MediaView } from "@/modules/types";
import Icon from "./Icon";
import Link from "next/link";
import { DateTime, FixedOffsetZone } from "luxon";

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
  let file = media.file!;

  let sources = (mimetype: string) => {
    let extension = mime.extension(mimetype);

    return THUMBNAILS.sizes
      .map(
        (size) =>
          `/media/${media.id}/${file.id}/thumb/${size}/${mimetype}/${media.filename}.${extension} ${size}w`,
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

function Rating({ rating }: { rating: number | null }) {
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
export default function MediaGrid({ media }: { media: MediaView[] }) {
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
            href={`media/${media.id}`}
            className="inner d-block border shadow text-body bg-body rounded-1 p-2 position-relative"
          >
            <ThumbnailImage media={media} />
            <div className="overlay position-absolute bottom-0 p-2 start-0 end-0 d-flex flex-row justify-content-between align-items-center">
              <Rating rating={media.rating} />
              <Icon icon="image" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  ));
}
