"use client";

import mime from "mime-types";
import Link from "next/link";
import { useMemo } from "react";

import Icon from "./Icon";
import { useGalleryBase, useGalleryMedia } from "./MediaGallery";
import Overlay from "./Overlay";
import { useFullscreen } from "@/modules/client-util";
import { ApiMediaView, MediaView } from "@/modules/types";
import { deserializeMediaView, mediaDate, url } from "@/modules/util";

const THUMBNAILS = {
  alternateTypes: ["image/webp"],
  sizes: [150, 200, 250, 300, 350, 400, 450, 500],
};

function Photo({ media }: { media: MediaView }) {
  let { file } = media;
  if (!file) {
    return (
      <div className="photo d-flex align-items-center justify-content-center">
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
    <picture>
      {THUMBNAILS.alternateTypes.map((type) => (
        <source key={type} srcSet={source(type)} type={type} />
      ))}
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <img srcSet={source("image/jpeg")} className="photo object-fit-contain" />
    </picture>
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
    <div className="flex-grow-1 d-flex align-items-center justify-content-between p-4 fs-1">
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

export default function MediaLayout({
  media: apiMedia,
}: {
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

  return (
    <main
      className="flex-grow-1 flex-shrink-1 overflow-hidden position-relative"
      data-bs-theme="dark"
      ref={fullscreenElement}
    >
      <Photo media={media} />
      <Overlay
        className="position-absolute top-0 start-0 end-0 bottom-0"
        innerClass="d-flex flex-column"
      >
        <div className="infobar d-flex align-items-center justify-content-between p-4 bg-body-secondary">
          <div className="fs-6">{mediaDate(media).toRelative()}</div>
          <div className="fs-1">
            <Icon icon="x-circle-fill" />
          </div>
        </div>
        <GalleryNavigation media={media} />
        <div className="infobar d-flex align-items-center justify-content-end p-4 bg-body-secondary fs-4 gap-4">
          <a download={media.file!.fileName} href={downloadUrl}>
            <Icon icon="download" />
          </a>
          {isFullscreen ? (
            <Icon onClick={exitFullscreen} icon="fullscreen-exit" />
          ) : (
            <Icon onClick={enterFullscreen} icon="arrows-fullscreen" />
          )}
        </div>
      </Overlay>
    </main>
  );
}
