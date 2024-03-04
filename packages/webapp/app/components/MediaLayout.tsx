import { useLocation, useNavigate } from "@remix-run/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useCastManager } from "./CastManager";
import { IconButton, IconLink } from "./Icon";
import Media, { VideoState } from "./Media";
import { useGalleryMedia, useGetMediaUrl, useGalleryUrl } from "./MediaGallery";
import MediaInfo from "./MediaInfo";
import Overlay from "./Overlay";
import SlidePanel from "./SlidePanel";
import { useFullscreen } from "@/modules/client-util";
import { MediaRelations, MediaView } from "@/modules/types";
import { formatTime, mediaDate, url } from "@/modules/util";

function GalleryNavigation({
  media,
  children,
}: {
  media: MediaView;
  children: React.ReactNode;
}) {
  let gallery = useGalleryMedia();
  let fromGallery = !!useLocation().state?.fromGallery;
  let getMediaUrl = useGetMediaUrl();

  let mediaUrl = useCallback(
    (newMedia: MediaView | undefined) =>
      newMedia ? getMediaUrl(newMedia.id) : undefined,
    [getMediaUrl],
  );

  let [previousMedia, nextMedia] = useMemo((): [
    string | undefined,
    string | undefined,
  ] => {
    if (gallery) {
      let index = gallery.findIndex((m) => m.id == media.id) ?? -1;
      if (index >= 0) {
        return [mediaUrl(gallery[index - 1]), mediaUrl(gallery[index + 1])];
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
            to={previousMedia}
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
            to={nextMedia}
            replace={true}
            state={{ fromGallery }}
          />
        )}
      </div>
    </div>
  );
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

export default function MediaLayout({ media }: { media: MediaRelations }) {
  let [videoState, setVideoState] = useState<VideoState | null>(null);
  let [player, setPlayer] = useState<HTMLVideoElement | null>(null);
  let gallery = useGalleryUrl();
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
        navigate(gallery, { replace: true });
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

  let castManager = useCastManager();

  useEffect(() => {
    setVideoState((vs) => (vs?.media != media.id ? null : vs));
    castManager.castMedia(media);

    return () => castManager.castMedia(null);
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
            <IconLink to={gallery} onClick={loadGallery} icon="close" />
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
