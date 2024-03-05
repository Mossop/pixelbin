import clsx from "clsx";
import mime from "mime-types";
import {
  Dispatch,
  SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Icon from "./Icon";
import { AlternateFileType, MediaView, MediaViewFile } from "@/modules/types";
import { url } from "@/modules/util";

function Photo({
  media,
  file,
  onLoad,
}: {
  media: MediaView;
  file: MediaViewFile;
  onLoad?: () => void;
}) {
  let { filename } = media;
  if (filename) {
    let pos = filename.lastIndexOf(".");
    if (pos > 0) {
      filename = filename.substring(0, pos);
    }
  } else {
    filename = "image";
  }

  let alternateTypes = useMemo(
    () =>
      new Set(
        file.alternates
          .filter(
            (a) =>
              a.type == AlternateFileType.Reencode &&
              a.mimetype != "image/jpeg",
          )
          .map((a) => a.mimetype),
      ),
    [file],
  );

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
      <picture>
        {Array.from(alternateTypes, (type) => (
          <source key={type} srcSet={source(type)} type={type} />
        ))}
        <img onLoad={onLoad} srcSet={source("image/jpeg")} className="photo" />
      </picture>
    </>
  );
}

export interface VideoState {
  media: string;
  playing: boolean;
  currentTime: number;
  duration: number;
}

function Video({
  media,
  file,
  setVideoState,
  setPlayer,
  onLoad,
}: {
  media: MediaView;
  file: MediaViewFile;
  setVideoState?: Dispatch<VideoState>;
  setPlayer?: Dispatch<HTMLVideoElement | null>;
  onLoad?: () => void;
}) {
  let updateState = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      let video = event.currentTarget;

      if (setVideoState) {
        setVideoState({
          media: media.id,
          playing: !video.paused && !video.ended,
          currentTime: video.currentTime,
          duration: video.duration,
        });
      }
    },
    [media, setVideoState],
  );

  let onLoaded = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      if (onLoad) {
        onLoad();
      }
      updateState(event);
    },
    [onLoad, updateState],
  );

  let { filename } = media;
  if (filename) {
    let pos = filename.lastIndexOf(".");
    if (pos > 0) {
      filename = filename.substring(0, pos);
    }
  } else {
    filename = "video";
  }

  let videoTypes = useMemo(
    () =>
      new Set(
        file.alternates
          .filter(
            (a) =>
              a.type == AlternateFileType.Reencode &&
              a.mimetype.startsWith("video/"),
          )
          .map((a) => a.mimetype),
      ),
    [file],
  );

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
      <video
        ref={setPlayer}
        poster={source("image/jpeg")}
        controls={false}
        onLoadedData={onLoaded}
        onPlay={updateState}
        onPause={updateState}
        onProgress={updateState}
        onTimeUpdate={updateState}
        className="video"
      >
        {Array.from(videoTypes, (type) => (
          <source key={type} src={source(type)} type={type} />
        ))}
      </video>
    </>
  );
}

export function RenderMedia({
  media,
  setVideoState,
  setPlayer,
  onLoad,
}: {
  media: MediaView;
  setVideoState?: Dispatch<VideoState>;
  setPlayer?: Dispatch<HTMLVideoElement | null>;
  onLoad?: () => void;
}) {
  useEffect(() => {
    if (!media.file && onLoad) {
      onLoad();
    }
  }, [media, onLoad]);

  let { file } = media;
  if (!file) {
    return (
      <div className="media missing">
        <Icon icon="hourglass" />
      </div>
    );
  }

  if (file.mimetype.startsWith("video/")) {
    return (
      <Video
        media={media}
        file={file}
        setVideoState={setVideoState}
        setPlayer={setPlayer}
        onLoad={onLoad}
      />
    );
  }

  return <Photo media={media} file={file} onLoad={onLoad} />;
}

export default function Media({
  media,
  setVideoState,
  setPlayer,
  onLoad,
}: {
  media: MediaView;
  setVideoState: Dispatch<VideoState>;
  setPlayer: Dispatch<HTMLVideoElement | null>;
  onLoad?: () => void;
}) {
  let [loadedMedia, setLoadedMedia] = useState<MediaView | null>(null);
  let [renderedMedia, setRenderedMedia] = useState<MediaView | null>(null);

  let onLoadComplete = useCallback(() => {
    setLoadedMedia(media);

    if (onLoad) {
      onLoad();
    }
  }, [media]);

  let onLoaded = useCallback(() => {
    setRenderedMedia(media);
  }, [media]);

  let loadingMedia = media.id !== loadedMedia?.id ? media : null;

  return (
    <div className="c-media">
      {loadedMedia && (
        <div key={loadedMedia.id} className="media">
          <RenderMedia
            media={loadedMedia}
            setVideoState={setVideoState}
            setPlayer={setPlayer}
          />
        </div>
      )}
      {loadingMedia && (
        <div
          key={loadingMedia.id}
          className={clsx(
            "media",
            renderedMedia?.id !== loadingMedia.id && "loading",
          )}
          onTransitionEnd={onLoadComplete}
        >
          <RenderMedia media={loadingMedia} onLoad={onLoaded} />
        </div>
      )}
    </div>
  );
}
