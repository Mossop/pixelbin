"use client";

import clsx from "clsx";
import mime from "mime-types";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import Icon from "./Icon";
import { useGalleryBase, useGalleryMedia } from "./MediaGallery";
import Overlay from "./Overlay";
import Throbber from "./Throbber";
import { useFullscreen } from "@/modules/client-util";
import { ApiMediaView, MediaView } from "@/modules/types";
import { deserializeMediaView, mediaDate, url } from "@/modules/util";

const THUMBNAILS = {
  alternateTypes: ["image/webp"],
  sizes: [150, 200, 250, 300, 350, 400, 450, 500],
};

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
    <main className="c-medialayout" data-theme="dark" ref={fullscreenElement}>
      <Photo media={media} />
      <Overlay>
        <div className="infobar">
          <div>{mediaDate(media).toRelative()}</div>
          <div className="buttons">
            <Icon icon="x-circle-fill" />
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
          </div>
        </div>
      </Overlay>
    </main>
  );
}
