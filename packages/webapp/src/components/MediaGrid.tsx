/* eslint-disable prefer-arrow-callback */

"use client";

import mime from "mime-types";
import Link from "next/link";
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { useConfig } from "./Config";
import Icon from "./Icon";
import { Group, useGalleryBase, useGalleryGroups } from "./MediaGallery";
import { Rating } from "./Rating";
import Throbber from "./Throbber";
import { MediaView } from "@/modules/types";
import { url } from "@/modules/util";

// @ts-ignore
const VisibilityContext = createContext<VisibilityObserver>(null);

const ThumbnailImage = memo(function ThumbnailImage({
  media,
}: {
  media: MediaView;
}) {
  let [loaded, setLoaded] = useState(false);
  let onLoad = useCallback(() => setLoaded(true), []);

  let thumbnailConfig = useConfig().thumbnails;

  let { file } = media;
  if (!file) {
    return (
      <div className="thumbnail">
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

    return thumbnailConfig.sizes
      .map(
        (size) =>
          `${url([
            "media",
            "thumb",
            media.id,
            file!.id,
            size.toString(),
            urlMimetype,
            `${filename}.${extension}`,
          ])} ${size}w`,
      )
      .join(",");
  };

  return (
    <picture>
      {thumbnailConfig.alternateTypes.map((type) => (
        <source key={type} sizes="150px" srcSet={sources(type)} type={type} />
      ))}
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <img
        onLoad={onLoad}
        decoding="async"
        sizes="150px"
        srcSet={sources("image/jpeg")}
        className={`thumbnail ${loaded ? "loaded" : "loading"}`}
      />
    </picture>
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
      return <Icon icon="photo" />;
    case "video":
      return <Icon icon="video" />;
    default:
      return <Icon icon="file" />;
  }
});

const MediaItem = memo(function MediaItem({
  base,
  media,
}: {
  base: string[];
  media: MediaView;
}) {
  let element = useRef(null);
  let [visible, setVisible] = useState(false);

  let observer = useContext(VisibilityContext);

  useEffect(() => {
    let el = element.current;

    if (el) {
      observer.observe(el, setVisible);
    }

    return () => {
      if (el) {
        observer.unobserve(el);
      }
    };
  }, [observer]);

  return (
    <div ref={element} className="media-wrapper">
      {visible && (
        <Link
          prefetch={false}
          href={url([...base, "media", media.id])}
          className="media"
        >
          <ThumbnailImage media={media} />
          <div className="overlay">
            <Rating media={media} />
            <FileType media={media} />
          </div>
        </Link>
      )}
    </div>
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
    <section className="c-mediagroup">
      <div className="title">
        <h2>{group.title}</h2>
      </div>
      <div className="grid">
        {group.media.map((m) => (
          <MediaItem key={m.id} base={base} media={m} />
        ))}
      </div>
    </section>
  );
});

class VisibilityObserver {
  elements: WeakMap<Element, (visible: boolean) => void>;

  observer: IntersectionObserver;

  constructor() {
    this.elements = new WeakMap();
    this.observer = new IntersectionObserver(
      (entries) => this.processEntries(entries),
      {
        rootMargin: "50px",
      },
    );
  }

  processEntries(entries: IntersectionObserverEntry[]) {
    for (let entry of entries) {
      let cb = this.elements.get(entry.target);
      if (cb) {
        cb(entry.isIntersecting);
      }
    }
  }

  observe(element: Element, cb: (visible: boolean) => void) {
    this.elements.set(element, cb);
    this.observer.observe(element);
  }

  unobserve(element: Element) {
    this.elements.delete(element);
    this.observer.unobserve(element);
  }
}

export default function MediaGrid() {
  let base = useGalleryBase();
  let groups = useGalleryGroups();

  if (!groups) {
    return <Throbber />;
  }

  let observer = new VisibilityObserver();

  return (
    <VisibilityContext.Provider value={observer}>
      {groups.map((group) => (
        <MediaGroup key={group.id} base={base} group={group} />
      ))}
    </VisibilityContext.Provider>
  );
}
