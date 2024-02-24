"use client";

import { Link, useLocation, useNavigate } from "@remix-run/react";
import clsx from "clsx";
import { DateTime, Duration } from "luxon";
import mime from "mime-types";
import {
  Dispatch,
  SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Icon, { IconButton, IconLink, IconName } from "./Icon";
import { useGalleryBase, useGalleryMedia } from "./MediaGallery";
import Overlay from "./Overlay";
import { Rating } from "./Rating";
import SlidePanel from "./SlidePanel";
import Throbber from "./Throbber";
import { useFullscreen } from "@/modules/client-util";
import {
  AlternateFileType,
  ApiMediaRelations,
  MediaRelations,
  MediaView,
  MediaViewFile,
} from "@/modules/types";
import {
  deserializeMediaView,
  mediaDate,
  mediaTitle,
  url,
} from "@/modules/util";

export function pageTitle(
  media: MediaRelations,
  parentTitle: string | undefined,
): string | undefined {
  let title = mediaTitle(media!);

  if (title && parentTitle) {
    return `${title} - ${parentTitle}`;
  }

  return title ?? parentTitle;
}

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

function Photo({ media, file }: { media: MediaView; file: MediaViewFile }) {
  let [loaded, setLoaded] = useState(false);
  let onLoaded = useCallback(() => {
    setLoaded(true);
  }, []);

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
      {!loaded && <Throbber />}
      <picture>
        {Array.from(alternateTypes, (type) => (
          <source key={type} srcSet={source(type)} type={type} />
        ))}
        <img
          onLoad={onLoaded}
          srcSet={source("image/jpeg")}
          className={clsx("photo", loaded ? "loaded" : "loading")}
        />
      </picture>
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
  let [loaded, setLoaded] = useState(false);

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
      setLoaded(true);
      updateState(event);
    },
    [updateState],
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
      {!loaded && <Throbber />}
      <video
        ref={setPlayer}
        poster={source("image/jpeg")}
        controls={false}
        onLoadedData={onLoaded}
        onPlay={updateState}
        onPause={updateState}
        onProgress={updateState}
        onTimeUpdate={updateState}
        className={clsx("video", loaded ? "loaded" : "loading")}
      >
        {Array.from(videoTypes, (type) => (
          <source key={type} src={source(type)} type={type} />
        ))}
      </video>
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

function Chip({
  icon,
  href,
  children,
}: {
  href?: string[];
  icon: IconName;
  children: React.ReactNode;
}) {
  if (href) {
    return (
      <li>
        <Link to={url(href)}>
          <Icon icon={icon} /> {children}
        </Link>
      </li>
    );
  }

  return (
    <li>
      <Icon icon={icon} /> {children}
    </li>
  );
}

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

function MediaInfo({ media }: { media: MediaRelations }) {
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

    let value = media.shutterSpeed.toString();

    if (media.shutterSpeed < 0.5) {
      let denominator = Math.round(1 / media.shutterSpeed);

      value = `${superscript(1)}\u2044${subscript(denominator)}`;
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
      {media.albums.length > 0 && (
        <Row label="albums">
          <ul className="relation-list">
            {media.albums.map((r) => (
              <Chip key={r.id} href={["album", r.id]} icon="album">
                {r.name}
              </Chip>
            ))}
          </ul>
        </Row>
      )}
      <Metadata media={media} property="label" />
      {taken}
      {media.rating !== null && (
        <Row label="rating">
          <Rating media={media} />
        </Row>
      )}
      {location}
      {media.tags.length > 0 && (
        <Row label="tags">
          <ul className="relation-list">
            {media.tags.map((r) => (
              <Chip key={r.id} icon="tag">
                {r.name}
              </Chip>
            ))}
          </ul>
        </Row>
      )}
      {media.people.length > 0 && (
        <Row label="people">
          <ul className="relation-list">
            {media.people.map((r) => (
              <Chip key={r.id} icon="person">
                {r.name}
              </Chip>
            ))}
          </ul>
        </Row>
      )}
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
    <main className="c-medialayout" data-theme="dark" ref={fullscreenElement}>
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
    </main>
  );
}
