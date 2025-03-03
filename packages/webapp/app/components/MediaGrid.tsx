import { Link } from "react-router";
import mime from "mime-types";
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SlSpinner } from "shoelace-react";

import Icon from "./Icon";
import {
  Group,
  useGalleryGroups,
  useGalleryUrl,
  useGetMediaUrl,
} from "./MediaGallery";
import { Rating } from "./Rating";
import Throbber from "./Throbber";
import { AlternateFileType, MediaView, MediaViewFile } from "@/modules/types";
import { url } from "@/modules/util";

import "styles/components/MediaGrid.scss";

const VisibilityContext = createContext<VisibilityObserver | null>(null);

const ThumbnailImage = memo(function ThumbnailImage({
  media,
  file,
}: {
  media: MediaView;
  file: MediaViewFile;
}) {
  let [loaded, setLoaded] = useState(false);
  let onLoad = useCallback(() => setLoaded(true), []);

  let { filename } = media;
  if (filename) {
    let pos = filename.lastIndexOf(".");
    if (pos > 0) {
      filename = filename.substring(0, pos);
    }
  } else {
    filename = "image";
  }

  let thumbnails = useMemo(
    () => file.alternates.filter((a) => a.type == AlternateFileType.Thumbnail),
    [file],
  );
  let alternateTypes = useMemo(
    () =>
      new Set(
        thumbnails
          .filter((a) => a.mimetype != "image/jpeg")
          .map((a) => a.mimetype),
      ),
    [thumbnails],
  );

  let sources = (mimetype: string) => {
    let extension = mime.extension(mimetype);
    let urlMimetype = mimetype.replace("/", "-");

    let sources = thumbnails.filter((t) => t.mimetype == mimetype);
    sources.sort((a, b) => a.width - b.width);

    return sources
      .map(
        (t) =>
          `${url([
            "media",
            "thumb",
            media.id,
            file.id,
            Math.max(t.width, t.height).toString(),
            urlMimetype,
            `${filename}.${extension}`,
          ])} ${t.width}w`,
      )
      .join(", ");
  };

  return (
    <picture>
      {Array.from(alternateTypes, (type) => (
        <source key={type} sizes="150px" srcSet={sources(type)} type={type} />
      ))}
      <img
        onLoad={onLoad}
        decoding="async"
        srcSet={sources("image/jpeg")}
        className={`thumbnail ${loaded ? "loaded" : "loading"}`}
      />
    </picture>
  );
});

const MissingThumbnail = memo(function MissingThumbnail() {
  return (
    <div className="thumbnail">
      <SlSpinner />
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
      return <Icon icon="photo" />;
    case "video":
      return <Icon icon="video" />;
    default:
      return <Icon icon="file" />;
  }
});

const MediaItem = memo(function MediaItem({ media }: { media: MediaView }) {
  let element = useRef(null);
  let [visible, setVisible] = useState(false);

  let observer = useContext(VisibilityContext);

  useEffect(() => {
    let el = element.current;

    if (el) {
      observer?.observe(el, (isVisible) => {
        if (isVisible) {
          setVisible(true);
        }
      });
    }

    return () => {
      if (el) {
        observer?.unobserve(el);
      }
    };
  }, [observer]);

  let mediaUrl = useGetMediaUrl()(media.id);

  return (
    <div ref={element} className="media-wrapper">
      {visible && (
        <Link to={mediaUrl} className="media" state={{ fromGallery: true }}>
          {media.file ? (
            <ThumbnailImage media={media} file={media.file} />
          ) : (
            <MissingThumbnail />
          )}
          <div className="overlay">
            <Rating media={media} />
            <FileType media={media} />
          </div>
        </Link>
      )}
    </div>
  );
});

const MediaGroup = memo(function MediaGroup({ group }: { group: Group }) {
  let element = useRef(null);

  return (
    <section className="c-mediagroup" ref={element}>
      <div className="title">
        <h2>{group.title}</h2>
      </div>
      <div className="grid">
        {group.media.map((m) => (
          <MediaItem key={m.id} media={m} />
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
  let groups = useGalleryGroups();
  let [observer, setObserver] = useState<VisibilityObserver | null>(null);
  let galleryUrl = useGalleryUrl();

  useEffect(() => {
    if (!observer) {
      setObserver(new VisibilityObserver());
    }
  }, [observer]);

  if (!groups) {
    return (
      <div key={galleryUrl} className="c-mediagrid">
        <Throbber />
      </div>
    );
  }

  return (
    <div key={galleryUrl} className="c-mediagrid">
      <VisibilityContext.Provider value={observer}>
        {groups.map((group) => (
          <MediaGroup key={group.id} group={group} />
        ))}
      </VisibilityContext.Provider>
    </div>
  );
}
