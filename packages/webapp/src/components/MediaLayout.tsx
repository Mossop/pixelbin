"use client";

import clsx from "clsx";
import { DateTime } from "luxon";
import mime from "mime-types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import Icon from "./Icon";
import { useGalleryBase, useGalleryMedia } from "./MediaGallery";
import Overlay from "./Overlay";
import { Rating } from "./Rating";
import SlidePanel from "./SlidePanel";
import Throbber from "./Throbber";
import { useFullscreen } from "@/modules/client-util";
import { ApiMediaView, MediaView } from "@/modules/types";
import { deserializeMediaView, mediaDate, url } from "@/modules/util";

const FRACTION = /^(\d+)\/(\d+)$/;

const THUMBNAILS = {
  alternateTypes: ["image/webp"],
  sizes: [150, 200, 250, 300, 350, 400, 450, 500],
};

function superscript(value: number): string {
  let val = Math.ceil(value);

  let result: string[] = [];
  while (val > 0) {
    let digit = val % 10;

    switch (digit) {
      case 1:
        result.unshift("\u00B9");
        break;
      case 2:
      case 3:
        result.unshift(String.fromCharCode(0x00b0 + digit));
        break;
      default:
        result.unshift(String.fromCharCode(0x2070 + digit));
    }

    val = (val - digit) / 10;
  }

  return result.join("");
}

function subscript(value: number): string {
  let val = Math.ceil(value);

  let result: string[] = [];
  while (val > 0) {
    let digit = val % 10;
    result.unshift(String.fromCharCode(0x2080 + digit));
    val = (val - digit) / 10;
  }

  return result.join("");
}

function Photo({ media }: { media: MediaView }) {
  let [loaded, setLoaded] = useState(false);
  let onLoaded = useCallback(() => {
    setLoaded(true);
  }, []);

  let { file } = media;
  if (!file) {
    return (
      <div className="photo">
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

  let source = (mimetype: string) => {
    let extension = mime.extension(mimetype);
    let urlMimetype = mimetype.replace("/", "-");

    return url([
      "media",
      "encoding",
      media.id,
      file!.id,
      urlMimetype,
      `${filename}.${extension}`,
    ]);
  };

  return (
    <>
      {!loaded && <Throbber />}
      <picture>
        {THUMBNAILS.alternateTypes.map((type) => (
          <source key={type} srcSet={source(type)} type={type} />
        ))}
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <img
          onLoad={onLoaded}
          srcSet={source("image/jpeg")}
          className={clsx("photo", loaded ? "loaded" : "loading")}
        />
      </picture>
    </>
  );
}

function GalleryNavigation({ media }: { media: MediaView }) {
  let base = useGalleryBase();
  let gallery = useGalleryMedia();

  let [previousMedia, nextMedia] = useMemo((): [
    MediaView | undefined,
    MediaView | undefined,
  ] => {
    if (gallery) {
      let index = gallery.findIndex((m) => m.id == media.id) ?? -1;
      if (index >= 0) {
        return [gallery[index - 1], gallery[index + 1]];
      }
    }

    return [undefined, undefined];
  }, [media.id, gallery]);

  return (
    <div className="navbar">
      <div>
        {previousMedia && (
          <Link href={url([...base, "media", previousMedia.id])} replace={true}>
            <Icon icon="arrow-left-circle-fill" />
          </Link>
        )}
      </div>
      <div>
        {nextMedia && (
          <Link href={url([...base, "media", nextMedia.id])} replace={true}>
            <Icon icon="arrow-right-circle-fill" />
          </Link>
        )}
      </div>
    </div>
  );
}

const LABELS = {
  filename: "Filename:",
  title: "Title:",
  description: "Description:",
  category: "Category:",
  label: "Label:",
  taken: "Taken at:",
  photographer: "Taken by:",
  albums: "In albums:",
  location: "Location:",
  make: "Camera make:",
  model: "Camera model:",
  lens: "Lens:",
  aperture: "Aperture:",
  shutterSpeed: "Shutter speed:",
  iso: "ISO:",
  focalLength: "Focal length:",
  rating: "Rating:",
  tags: "Tags:",
  people: "People:",
};

function Row({
  label,
  children,
  multiline = false,
}: {
  multiline?: boolean;
  label: keyof typeof LABELS;
  children: React.ReactNode;
}) {
  let labelClasses = clsx(
    "metadata-label",
    multiline && "multiline",
    // `metadata-${id}`,
  );
  let contentClasses = clsx(
    "metadata-value",
    multiline && "multiline",
    // `metadata-${id}`,
  );

  return (
    <>
      <dt className={labelClasses}>{LABELS[label]}</dt>
      <dd className={contentClasses}>{children}</dd>
    </>
  );
}

function Metadata<P extends keyof MediaView & keyof typeof LABELS>({
  media,
  property,
}: {
  media: MediaView;
  property: P;
}) {
  if (!media[property]) {
    return null;
  }

  return (
    <Row label={property}>
      {/* @ts-ignore */}
      {media[property]}
    </Row>
  );
}

function MediaInfo({ media }: { media: MediaView }) {
  let taken = useMemo(() => {
    if (media.taken === null) {
      return null;
    }

    return (
      <Row label="taken">
        {media.taken.toLocaleString(DateTime.DATETIME_SHORT)}
      </Row>
    );
  }, [media]);

  let shutterSpeed = useMemo(() => {
    if (media.shutterSpeed === null) {
      return null;
    }
    let value = media.shutterSpeed;
    let matches = FRACTION.exec(value);
    if (matches) {
      value = `${superscript(parseInt(matches[1], 10))}\u2044${subscript(
        parseInt(matches[2], 10),
      )}`;
    }
    return <Row label="shutterSpeed">{value} s</Row>;
  }, [media]);

  let aperture = useMemo(() => {
    if (media.aperture === null) {
      return null;
    }

    return (
      <Row label="aperture">
        <i>f</i>
        {` / ${media.aperture.toFixed(1)}`}
      </Row>
    );
  }, [media]);

  let iso = useMemo(() => {
    if (media.iso === null) {
      return null;
    }

    return <Row label="iso">ISO {Math.round(media.iso)}</Row>;
  }, [media]);

  let focalLength = useMemo(() => {
    if (media.focalLength === null) {
      return null;
    }

    return <Row label="focalLength">{media.focalLength.toFixed(1)} mm</Row>;
  }, [media]);

  let location = useMemo(() => {
    let locationParts: string[] = [];

    if (media.location) {
      locationParts.push(media.location);
    }
    if (media.city) {
      locationParts.push(media.city);
    }
    if (media.state) {
      locationParts.push(media.state);
    }
    if (media.country) {
      locationParts.push(media.country);
    }

    if (locationParts.length) {
      return (
        <Row label="location">
          <a
            target="_blank"
            rel="noreferrer"
            href={`https://www.google.com/maps/search/${encodeURIComponent(
              locationParts.join(", "),
            )}`}
            color="secondary"
          >
            {locationParts.join(", ")}
          </a>
        </Row>
      );
    }
    return null;
  }, [media]);

  return (
    <dl>
      <Metadata media={media} property="filename" />
      <Metadata media={media} property="title" />
      <Metadata media={media} property="description" />
      <Metadata media={media} property="category" />
      {/* Albums */}
      <Metadata media={media} property="label" />
      {taken}
      {media.rating !== null && (
        <Row label="rating">
          <Rating media={media} />
        </Row>
      )}
      {location}
      {/* Tags */}
      {/* People */}
      <Metadata media={media} property="photographer" />
      {shutterSpeed}
      {aperture}
      {iso}
      <Metadata media={media} property="make" />
      <Metadata media={media} property="model" />
      <Metadata media={media} property="lens" />
      {focalLength}
    </dl>
  );
}

export default function MediaLayout({
  media: apiMedia,
  fromGallery = false,
  gallery,
}: {
  fromGallery?: boolean;
  gallery: string[];
  media: ApiMediaView;
}) {
  let media = useMemo(() => deserializeMediaView(apiMedia), [apiMedia]);

  let { fullscreenElement, enterFullscreen, exitFullscreen, isFullscreen } =
    useFullscreen();

  let downloadUrl = url([
    "media",
    "download",
    media.id,
    media.file!.id,
    media.file!.fileName,
  ]);

  let [infoPanelShown, setInfoPanelShown] = useState(false);
  let showInfoPanel = useCallback(() => setInfoPanelShown(true), []);
  let closeInfoPanel = useCallback(() => setInfoPanelShown(false), []);

  let router = useRouter();
  let loadGallery = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();

      if (fromGallery) {
        router.back();
      } else {
        router.replace(url(gallery));
      }
    },
    [router, gallery, fromGallery],
  );

  return (
    <main className="c-medialayout" data-theme="dark" ref={fullscreenElement}>
      <Photo media={media} />
      <Overlay>
        <div className="infobar">
          <div>{mediaDate(media).toRelative()}</div>
          <div className="buttons">
            <a href={url(gallery)} onClick={loadGallery}>
              <Icon icon="x-circle-fill" />
            </a>
          </div>
        </div>
        <GalleryNavigation media={media} />
        <div className="infobar">
          <div className="buttons">
            <a download={media.file!.fileName} href={downloadUrl}>
              <Icon icon="download" />
            </a>
            {isFullscreen ? (
              <Icon onClick={exitFullscreen} icon="fullscreen-exit" />
            ) : (
              <Icon onClick={enterFullscreen} icon="arrows-fullscreen" />
            )}
            <Icon onClick={showInfoPanel} icon="info-circle" />
          </div>
        </div>
      </Overlay>
      <SlidePanel
        show={infoPanelShown}
        position="right"
        onClose={closeInfoPanel}
        className="media-info"
      >
        <MediaInfo media={media} />
      </SlidePanel>
    </main>
  );
}
