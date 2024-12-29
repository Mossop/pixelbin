import { useFetcher, useNavigate } from "react-router";
import { useCallback, useMemo, useState } from "react";
import { SlTooltip } from "shoelace-react";

import { IconButton, IconLink, IconName } from "./Icon";
import Media from "./Media";
import {
  PlayState,
  VideoState,
  useCurrentMedia,
  useMediaContext,
  useVideoState,
} from "./MediaContext";
import {
  useGalleryMedia,
  useGetMediaUrl,
  useGalleryUrl,
  useGalleryType,
} from "./MediaGallery";
import MediaInfo from "./MediaInfo";
import Overlay from "./Overlay";
import SlidePanel from "./SlidePanel";
import Throbber from "./Throbber";
import { useFullscreen, useHistoryState } from "@/modules/hooks";
import { MediaRelations, MediaView } from "@/modules/types";
import { formatTime, mediaDate, url } from "@/modules/util";

import "styles/components/MediaLayout.scss";

function GalleryNavigation({
  media,
  children,
}: {
  media: MediaView;
  children: React.ReactNode;
}) {
  let gallery = useGalleryMedia();
  let fromGallery = !!useHistoryState()?.fromGallery;
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
  }, [media.id, mediaUrl, gallery]);

  return (
    <div className="navbar">
      <div className="inner">
        <div>
          {previousMedia && (
            <IconLink
              icon="previous"
              to={previousMedia}
              replace
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
              replace
              state={{ fromGallery }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function VideoInfo({ videoState }: { videoState: VideoState }) {
  let mediaContext = useMediaContext();

  let togglePlayback = useCallback(
    () => mediaContext.togglePlayback(),
    [mediaContext],
  );

  let percentPlayed = (100 * videoState.currentTime) / videoState.duration;

  let currentTime = formatTime(videoState.currentTime);
  let duration = formatTime(videoState.duration);

  let icon: IconName =
    videoState.playState === PlayState.Playing ? "pause" : "play";

  return (
    <div className="video-info">
      <div className="buttons">
        <IconButton onClick={togglePlayback} icon={icon} />
      </div>
      <div className="scrubber">
        <div className="played" style={{ width: `${percentPlayed}%` }} />
      </div>
      <div>
        {currentTime} / {duration}
      </div>
    </div>
  );
}

export default function MediaLayout({ media }: { media: MediaRelations }) {
  let gallery = useGalleryUrl();
  let fromGallery = !!useHistoryState()?.fromGallery;
  let currentMedia = useCurrentMedia();
  let galleryType = useGalleryType();
  let displayingMedia = currentMedia ?? media;
  let fetcher = useFetcher();

  let { fullscreenElement, enterFullscreen, exitFullscreen, isFullscreen } =
    useFullscreen();

  let downloadUrl =
    galleryType && displayingMedia.file
      ? url([
          "media",
          "download",
          displayingMedia.id,
          displayingMedia.file.id,
          displayingMedia.file.fileName,
        ])
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
    [navigate, gallery, fromGallery],
  );

  let mediaContext = useMediaContext();
  let videoState = useVideoState();

  let togglePlayback = useCallback(
    () => mediaContext.togglePlayback(),
    [mediaContext],
  );

  let [shareTooltipOpen, setShareTooltipOpen] = useState(false);

  let share = useCallback(() => {
    if (
      !displayingMedia.public &&
      displayingMedia.access == "writableCatalog"
    ) {
      fetcher.submit(
        { id: displayingMedia.id },
        {
          action: "/markPublic",
          method: "POST",
        },
      );
    }

    let shareUrl = document.documentURI;

    if (displayingMedia.public || displayingMedia.access == "writableCatalog") {
      shareUrl = new URL(
        url(["catalog", displayingMedia.catalog, "media", displayingMedia.id]),
        document.documentURI,
      ).toString();
    }

    navigator.clipboard
      .writeText(shareUrl)
      .then(() => setShareTooltipOpen(true))
      .catch((e) => console.error(e));
  }, [fetcher, displayingMedia]);

  return (
    <div
      className="c-medialayout sl-theme-dark apply-theme"
      ref={fullscreenElement}
    >
      <Media media={media} />
      {currentMedia?.id !== media.id && (
        <div className="loading-throbber">
          <Throbber />
        </div>
      )}
      <Overlay onClick={togglePlayback}>
        <div className="infobars">
          <div className="infobar">
            <div>{mediaDate(media).toRelative()}</div>
            <div className="buttons">
              <IconLink to={gallery} onClick={loadGallery} icon="close" />
            </div>
          </div>
          <div className="infobar">
            {videoState && <VideoInfo videoState={videoState} />}
            <div className="buttons">
              {downloadUrl && (
                <IconLink
                  download={displayingMedia.file!.fileName}
                  to={downloadUrl}
                  icon="download"
                />
              )}
              {(displayingMedia.access == "writableCatalog" ||
                displayingMedia.public) && (
                <SlTooltip
                  open={shareTooltipOpen}
                  trigger="manual"
                  content="Address copied to clipboard"
                >
                  <IconButton
                    onClick={share}
                    onMouseLeave={() => setShareTooltipOpen(false)}
                    icon="share"
                  />
                </SlTooltip>
              )}
              {isFullscreen ? (
                <IconButton onClick={exitFullscreen} icon="fullscreen-exit" />
              ) : (
                <IconButton onClick={enterFullscreen} icon="fullscreen-enter" />
              )}
              <IconButton onClick={showInfoPanel} icon="info" />
            </div>
          </div>
        </div>
        <GalleryNavigation media={currentMedia ?? media}>
          {videoState && videoState.playState != PlayState.Playing && (
            <IconButton onClick={togglePlayback} icon="play" />
          )}
        </GalleryNavigation>
      </Overlay>
      <SlidePanel
        label="Metadata"
        show={infoPanelShown}
        position="right"
        onClosed={closeInfoPanel}
      >
        <MediaInfo media={displayingMedia} />
      </SlidePanel>
    </div>
  );
}
