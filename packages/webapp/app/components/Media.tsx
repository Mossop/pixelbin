import clsx from "clsx";
import mime from "mime-types";
import {
  SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SlSpinner } from "shoelace-react";

import { useCastManager } from "./CastManager";
import { PlayState, useCurrentMedia, useMediaContext } from "./MediaContext";
import {
  AlternateFileType,
  MediaRelations,
  MediaViewFile,
} from "@/modules/types";
import { url } from "@/modules/util";

import "styles/components/Media.scss";

function Photo({
  media,
  file,
  onLoaded,
}: {
  media: MediaRelations;
  file: MediaViewFile;
  onLoaded: () => void;
}) {
  let imageElement = useRef<HTMLImageElement>(null);

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
      file.id,
      urlMimetype,
      `${filename}.${extension}`,
    ]);
  };

  useEffect(() => {
    if (imageElement.current?.complete) {
      onLoaded();
    }
  }, [onLoaded]);

  return (
    <picture>
      {Array.from(alternateTypes, (type) => (
        <source key={type} srcSet={source(type)} type={type} />
      ))}
      <img
        ref={imageElement}
        onLoad={onLoaded}
        srcSet={source("image/jpeg")}
        className="photo"
      />
    </picture>
  );
}

function Video({
  media,
  file,
  onLoaded,
}: {
  media: MediaRelations;
  file: MediaViewFile;
  onLoaded: () => void;
}) {
  let mediaContext = useMediaContext();
  let videoElement = useRef<HTMLVideoElement>(null);

  let updateVideoState = useCallback(
    (video: HTMLVideoElement) => {
      let playState: PlayState;
      if (video.paused) {
        playState = PlayState.Paused;
      } else if (video.ended) {
        playState = PlayState.Ended;
      } else {
        playState = PlayState.Playing;
      }

      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        onLoaded();
      }

      mediaContext.updateVideoState(
        media,
        {
          playState,
          currentTime: video.currentTime,
          duration: video.duration,
        },
        video,
      );
    },
    [onLoaded, media, mediaContext],
  );

  let updateState = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      updateVideoState(event.currentTarget);
    },
    [updateVideoState],
  );

  let onLoad = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      onLoaded();
      updateState(event);
    },
    [onLoaded, updateState],
  );

  useEffect(() => {
    console.log(videoElement.current!.readyState);
    updateVideoState(videoElement.current!);
  }, [updateVideoState]);

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
      file.id,
      urlMimetype,
      `${filename}.${extension}`,
    ]);
  };

  let startPlaying = useCallback((event: SyntheticEvent<HTMLVideoElement>) => {
    void event.currentTarget.play();
  }, []);

  return (
    <video
      ref={videoElement}
      poster={source("image/jpeg")}
      controls={false}
      onLoadedData={onLoad}
      onPlay={updateState}
      onPause={updateState}
      onProgress={updateState}
      onTimeUpdate={updateState}
      onCanPlayThrough={startPlaying}
      className="video"
    >
      {Array.from(videoTypes, (type) => (
        <source key={type} src={source(type)} type={type} />
      ))}
    </video>
  );
}

export function RenderMedia({
  media,
  isCurrent,
}: {
  media: MediaRelations;
  isCurrent: boolean;
}) {
  let mediaContext = useMediaContext();

  let onLoaded = useCallback(() => {
    if (isCurrent) {
      mediaContext.setMedia(media);
    }
  }, [isCurrent, mediaContext, media]);

  useEffect(() => {
    if (!media.file) {
      onLoaded();
    }
  }, [media, onLoaded]);

  let { file } = media;
  if (!file) {
    return (
      <div className="missing">
        <SlSpinner />
      </div>
    );
  }

  if (file.mimetype.startsWith("video/")) {
    return <Video media={media} file={file} onLoaded={onLoaded} />;
  }

  return <Photo media={media} file={file} onLoaded={onLoaded} />;
}

export default function Media({ media }: { media: MediaRelations }) {
  let [loadedMedia, setLoadedMedia] = useState<MediaRelations | null>(null);
  let currentMedia = useCurrentMedia();
  let mediaContext = useMediaContext();

  let onLoadComplete = useCallback(() => {
    setLoadedMedia(media);
  }, [media]);

  let loadingMedia = media.id !== loadedMedia?.id ? media : null;

  useEffect(() => () => mediaContext.setMedia(null), [mediaContext]);

  let castManager = useCastManager();
  useEffect(() => {
    castManager.castMedia(media);
  }, [media, castManager]);

  return (
    <div className="c-media">
      {loadedMedia && (
        <div key={loadedMedia.id} className="media">
          <RenderMedia media={loadedMedia} isCurrent={!loadingMedia} />
        </div>
      )}
      {loadingMedia && (
        <div
          key={loadingMedia.id}
          className={clsx(
            "media",
            currentMedia?.id !== loadingMedia.id && "loading",
          )}
          onTransitionEnd={onLoadComplete}
        >
          <RenderMedia media={loadingMedia} isCurrent />
        </div>
      )}
    </div>
  );
}
