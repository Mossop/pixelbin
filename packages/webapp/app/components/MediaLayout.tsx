import { useLocation, useNavigate } from "@remix-run/react";
import clsx from "clsx";
import { Duration } from "luxon";
import mime from "mime-types";
import {
  Dispatch,
  SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Icon, { IconButton, IconLink } from "./Icon";
import { useGalleryBase, useGalleryMedia } from "./MediaGallery";
import MediaInfo from "./MediaInfo";
import Overlay from "./Overlay";
import SlidePanel from "./SlidePanel";
import Throbber from "./Throbber";
import { useFullscreen } from "@/modules/client-util";
import {
  AlternateFileType,
  ApiMediaRelations,
  MediaView,
  MediaViewFile,
} from "@/modules/types";
import { deserializeMediaView, mediaDate, url } from "@/modules/util";

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
          className={clsx("photo", isLoaded ? "loaded" : "loading")}
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

interface VideoState {
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
    filename = "image";
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
        className={clsx("video", isLoaded ? "loaded" : "loading")}
      >
        {Array.from(videoTypes, (type) => (
          <source key={type} src={source(type)} type={type} />
        ))}
      </video>
      {!isLoaded && <Throbber />}
    </>
  );
}

function Media({
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

function GalleryNavigation({
  media,
  children,
}: {
  media: MediaView;
  children: React.ReactNode;
}) {
  let base = useGalleryBase();
  let gallery = useGalleryMedia();
  let fromGallery = !!useLocation().state?.fromGallery;

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
          <IconLink
            icon="previous"
            to={url([...base, "media", previousMedia.id])}
            replace={true}
            state={{ fromGallery }}
          />
        )}
      </div>
      <div className="center">{children}</div>
      <div>
        {nextMedia && (
          <IconLink
            icon="next"
            to={url([...base, "media", nextMedia.id])}
            replace={true}
            state={{ fromGallery }}
          />
        )}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  if (Number.isNaN(seconds)) {
    return "-:--";
  }

  let duration = Duration.fromMillis(seconds * 1000);

  return duration.toFormat("m:ss");
}

function VideoInfo({
  videoState,
  player,
}: {
  videoState: VideoState;
  player: HTMLVideoElement;
}) {
  let play = useCallback(() => player.play(), [player]);
  let pause = useCallback(() => player.pause(), [player]);

  let percentPlayed = Math.floor(
    (100 * videoState.currentTime) / videoState.duration,
  );

  let currentTime = formatTime(videoState.currentTime);
  let duration = formatTime(videoState.duration);

  return (
    <div className="video-info">
      <div className="buttons">
        {videoState.playing ? (
          <IconButton onClick={pause} icon="pause" />
        ) : (
          <IconButton onClick={play} icon="play" />
        )}
      </div>
      <div className="scrubber">
        <div className="played" style={{ width: `${percentPlayed}%` }}></div>
      </div>
      <div>
        {currentTime} / {duration}
      </div>
    </div>
  );
}

export default function MediaLayout({
  media: apiMedia,
}: {
  media: ApiMediaRelations;
}) {
  let media = deserializeMediaView(apiMedia);
  let [videoState, setVideoState] = useState<VideoState | null>(null);
  let [player, setPlayer] = useState<HTMLVideoElement | null>(null);
  let gallery = useGalleryBase();
  let fromGallery = !!useLocation().state?.fromGallery;

  let { fullscreenElement, enterFullscreen, exitFullscreen, isFullscreen } =
    useFullscreen();

  let downloadUrl = media.file
    ? url(["media", "download", media.id, media.file.id, media.file.fileName])
    : null;

  let [infoPanelShown, setInfoPanelShown] = useState(false);
  let showInfoPanel = useCallback(() => setInfoPanelShown(true), []);
  let closeInfoPanel = useCallback(() => setInfoPanelShown(false), []);

  let navigate = useNavigate();
  let loadGallery = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();

      if (fromGallery) {
        navigate(-1);
      } else {
        navigate(url(gallery), { replace: true });
      }
    },
    [navigate, fromGallery],
  );

  let play = useMemo(() => {
    if (videoState && !videoState.playing && player) {
      return () => player!.play();
    }

    return null;
  }, [videoState, player]);

  let togglePlayback = useCallback(() => {
    if (player) {
      if (player.paused || player.ended) {
        player.play();
      } else {
        player.pause();
      }
    }
  }, [player]);

  useEffect(() => {
    setVideoState((vs) => (vs?.media != media.id ? null : vs));
  }, [media]);

  return (
    <div className="c-medialayout" data-theme="dark" ref={fullscreenElement}>
      <Media
        media={media}
        setPlayer={setPlayer}
        setVideoState={setVideoState}
      />
      <Overlay onClick={togglePlayback}>
        <div className="infobar">
          <div>{mediaDate(media).toRelative()}</div>
          <div className="buttons">
            <IconLink to={url(gallery)} onClick={loadGallery} icon="close" />
          </div>
        </div>
        <GalleryNavigation media={media}>
          {play && <IconButton onClick={play} icon="play" />}
        </GalleryNavigation>
        <div className="infobar">
          {videoState && player && (
            <VideoInfo videoState={videoState} player={player} />
          )}
          <div className="buttons">
            {downloadUrl && (
              <>
                <IconLink
                  download={media.file!.fileName}
                  to={downloadUrl}
                  icon="download"
                />
                {isFullscreen ? (
                  <IconButton onClick={exitFullscreen} icon="fullscreen-exit" />
                ) : (
                  <IconButton
                    onClick={enterFullscreen}
                    icon="fullscreen-enter"
                  />
                )}
              </>
            )}
            <IconButton onClick={showInfoPanel} icon="info" />
          </div>
        </div>
      </Overlay>
      <SlidePanel
        show={infoPanelShown}
        position="right"
        onClose={closeInfoPanel}
        theme="dark"
        className="media-info"
      >
        <MediaInfo media={media} />
      </SlidePanel>
    </div>
  );
}
