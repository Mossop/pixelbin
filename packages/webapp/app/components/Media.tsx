import clsx from "clsx";
import mime from "mime-types";
import {
  SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useCastManager } from "./CastManager";
import Icon from "./Icon";
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
}: {
  media: MediaRelations;
  file: MediaViewFile;
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

  let mediaContext = useMediaContext();
  let onLoad = useCallback(() => {
    mediaContext.setMedia(media);
  }, [mediaContext, media]);

  return (
    <picture>
      {Array.from(alternateTypes, (type) => (
        <source key={type} srcSet={source(type)} type={type} />
      ))}
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <img onLoad={onLoad} srcSet={source("image/jpeg")} className="photo" />
    </picture>
  );
}

function Video({
  media,
  file,
}: {
  media: MediaRelations;
  file: MediaViewFile;
}) {
  let mediaContext = useMediaContext();

  let updateState = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      let video = event.currentTarget;
      let playState: PlayState;
      if (video.paused) {
        playState = PlayState.Paused;
      } else if (video.ended) {
        playState = PlayState.Ended;
      } else {
        playState = PlayState.Playing;
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
    [media, mediaContext],
  );

  let onLoad = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      mediaContext.setMedia(media);
      updateState(event);
    },
    [mediaContext, media, updateState],
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

  let startPlaying = useCallback((event: SyntheticEvent<HTMLVideoElement>) => {
    event.currentTarget.play();
  }, []);

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video
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

export function RenderMedia({ media }: { media: MediaRelations }) {
  let mediaContext = useMediaContext();

  useEffect(() => {
    if (!media.file) {
      mediaContext.setMedia(media);
    }
  }, [mediaContext, media]);

  let { file } = media;
  if (!file) {
    return (
      <div className="media missing">
        <Icon icon="hourglass" />
      </div>
    );
  }

  if (file.mimetype.startsWith("video/")) {
    return <Video media={media} file={file} />;
  }

  return <Photo media={media} file={file} />;
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
          <RenderMedia media={loadedMedia} />
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
          <RenderMedia media={loadingMedia} />
        </div>
      )}
    </div>
  );
}
