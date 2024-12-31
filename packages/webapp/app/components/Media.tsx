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
import { PlayState, useMediaContext } from "./MediaContext";
import {
  AlternateFileType,
  MediaRelations,
  MediaView,
  MediaViewFile,
} from "@/modules/types";
import { url } from "@/modules/util";

import "styles/components/Media.scss";
import Throbber from "./Throbber";

function Photo({
  media,
  file,
  onLoaded,
  onDisplayChange,
  visible,
}: {
  media: MediaView;
  file: MediaViewFile;
  onLoaded: () => void;
  onDisplayChange: () => void;
  visible: boolean;
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

  let onImageLoad = useCallback(() => {
    onLoaded();
  }, [onLoaded]);

  return (
    <picture>
      {Array.from(alternateTypes, (type) => (
        <source key={type} srcSet={source(type)} type={type} />
      ))}
      <img
        ref={imageElement}
        onLoad={onImageLoad}
        onTransitionEnd={onDisplayChange}
        srcSet={source("image/jpeg")}
        className={clsx("media", "photo", !visible && "hidden")}
      />
    </picture>
  );
}

function Video({
  media,
  file,
  onLoaded,
  onDisplayChange,
  visible,
}: {
  media: MediaView;
  file: MediaViewFile;
  onLoaded: () => void;
  onDisplayChange: () => void;
  visible: boolean;
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
      onTransitionEnd={onDisplayChange}
      onPlay={updateState}
      onPause={updateState}
      onProgress={updateState}
      onTimeUpdate={updateState}
      onCanPlayThrough={startPlaying}
      className={clsx("media", "video", !visible && "hidden")}
    >
      {Array.from(videoTypes, (type) => (
        <source key={type} src={source(type)} type={type} />
      ))}
    </video>
  );
}

function RenderMedia({
  media,
  onLoaded,
  onDisplayChange,
  visible,
}: {
  media: MediaView;
  onLoaded: (media: MediaView) => void;
  onDisplayChange: (media: MediaView) => void;
  visible: boolean;
}) {
  useEffect(() => {
    if (!media.file) {
      onLoaded(media);
    }
  }, [media, onLoaded]);

  let onMediaLoaded = useCallback(() => {
    onLoaded(media);
  }, [onLoaded, media]);

  let onMediaDisplayChange = useCallback(() => {
    onDisplayChange(media);
  }, [onDisplayChange, media]);

  let { file } = media;
  if (!file) {
    return (
      <div className="missing">
        <SlSpinner />
      </div>
    );
  }

  if (file.mimetype.startsWith("video/")) {
    return (
      <Video
        media={media}
        file={file}
        onLoaded={onMediaLoaded}
        onDisplayChange={onMediaDisplayChange}
        visible={visible}
      />
    );
  }

  return (
    <Photo
      media={media}
      file={file}
      onLoaded={onMediaLoaded}
      onDisplayChange={onMediaDisplayChange}
      visible={visible}
    />
  );
}

enum MediaState {
  Loading,
  Loaded,
}

export default function Media({
  media: mediaToDisplay,
  preload = [],
}: {
  media: MediaRelations;
  preload?: MediaView[];
}) {
  let [loadedMedia, setLoadedMedia] = useState<MediaRelations | null>(null);
  let mediaContext = useMediaContext();

  let [mediaStates, setMediaStates] = useState<Record<string, MediaState>>({});

  // Clear the current media when unmounting
  useEffect(() => () => mediaContext.setMedia(null), [mediaContext]);

  useEffect(() => {
    let oldIds = new Set<string>(Object.keys(mediaStates));

    oldIds.delete(mediaToDisplay.id);

    if (loadedMedia) {
      oldIds.delete(loadedMedia.id);
    }

    for (let p of preload) {
      oldIds.delete(p.id);
    }

    if (oldIds.size) {
      let newStates = { ...mediaStates };

      for (let id of oldIds) {
        delete newStates[id];
      }

      setMediaStates(newStates);
    }
  }, [mediaStates, loadedMedia, mediaToDisplay, preload]);

  useEffect(() => {
    if (mediaStates[mediaToDisplay.id] == MediaState.Loaded) {
      mediaContext.setMedia(mediaToDisplay);
    }
  }, [mediaContext, mediaStates, mediaToDisplay]);

  let [mediaList, wantsThrobber] = useMemo((): [
    [media: MediaView, visible: boolean][],
    boolean,
  ] => {
    let list: [media: MediaView, visible: boolean][] = [];
    let seenIds = new Set<string>();

    let toDisplayState = mediaStates[mediaToDisplay.id] ?? MediaState.Loading;

    if (loadedMedia && loadedMedia.id != mediaToDisplay.id) {
      seenIds.add(loadedMedia.id);

      list.unshift([loadedMedia, toDisplayState != MediaState.Loaded]);
    }

    seenIds.add(mediaToDisplay.id);
    list.unshift([mediaToDisplay, toDisplayState == MediaState.Loaded]);

    let missing = preload.filter((p) => !seenIds.has(p.id));
    // Keep the ordering stable
    missing.sort((a, b) => a.id.localeCompare(b.id));

    list.unshift(...missing.map((m): [MediaView, boolean] => [m, false]));

    return [list, toDisplayState != MediaState.Loaded];
  }, [mediaStates, loadedMedia, mediaToDisplay, preload]);

  let castManager = useCastManager();
  useEffect(() => {
    castManager.castMedia(mediaToDisplay);
  }, [mediaToDisplay, castManager]);

  let onMediaLoaded = useCallback((media: MediaView) => {
    setMediaStates((mediaStates) => {
      return {
        ...mediaStates,
        [media.id]: MediaState.Loaded,
      };
    });
  }, []);

  let onMediaDisplayChange = useCallback(
    (media: MediaView) => {
      if (media.id === mediaToDisplay.id || media.id === loadedMedia?.id) {
        setLoadedMedia(mediaToDisplay);
      }
    },

    [loadedMedia, mediaToDisplay],
  );

  return (
    <div className="c-media">
      {mediaList.map(([media, visible]) => (
        <RenderMedia
          key={media.id}
          media={media}
          onLoaded={onMediaLoaded}
          onDisplayChange={onMediaDisplayChange}
          visible={visible}
        />
      ))}

      {wantsThrobber && <Throbber />}
    </div>
  );
}
