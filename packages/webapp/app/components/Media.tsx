import clsx from "clsx";
import mime from "mime-types";
import {
  Dispatch,
  SyntheticEvent,
  useCallback,
  useMemo,
  useState,
} from "react";

import Icon from "./Icon";
import Throbber from "./Throbber";
import { AlternateFileType, MediaView, MediaViewFile } from "@/modules/types";
import { url } from "@/modules/util";

function Photo({ media, file }: { media: MediaView; file: MediaViewFile }) {
  let [loaded, setLoaded] = useState<string | null>(null);
  let onLoaded = useCallback(() => {
    setLoaded(media.id);
  }, [media]);
  let isLoaded = loaded === media.id;

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
        <img
          onLoad={onLoaded}
          srcSet={source("image/jpeg")}
          className={clsx("c-media", "photo", isLoaded ? "loaded" : "loading")}
        />
      </picture>
      {loaded !== media.id && (
        <div className="loading-throbber">
          <Throbber />
        </div>
      )}
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
}: {
  media: MediaView;
  file: MediaViewFile;
  setVideoState: Dispatch<VideoState>;
  setPlayer: Dispatch<HTMLVideoElement | null>;
}) {
  let [loaded, setLoaded] = useState<string | null>(null);
  let isLoaded = loaded == media.id;

  let updateState = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      let video = event.currentTarget;

      setVideoState({
        media: media.id,
        playing: !video.paused && !video.ended,
        currentTime: video.currentTime,
        duration: video.duration,
      });
    },
    [media, setVideoState],
  );

  let onLoaded = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      setLoaded(media.id);
      updateState(event);
    },
    [media, updateState],
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
        className={clsx("c-media", "video", isLoaded ? "loaded" : "loading")}
      >
        {Array.from(videoTypes, (type) => (
          <source key={type} src={source(type)} type={type} />
        ))}
      </video>
      {!isLoaded && <Throbber />}
    </>
  );
}

export default function Media({
  media,
  setVideoState,
  setPlayer,
}: {
  media: MediaView;
  setVideoState: Dispatch<VideoState>;
  setPlayer: Dispatch<HTMLVideoElement | null>;
}) {
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
      />
    );
  }

  return <Photo media={media} file={file} />;
}
