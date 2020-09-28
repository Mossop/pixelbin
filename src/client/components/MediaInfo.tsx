import { useLocalization } from "@fluent/react";
import Link from "@material-ui/core/Link";
import { makeStyles, createStyles, Theme } from "@material-ui/core/styles";
import Rating from "@material-ui/lab/Rating/Rating";
import React, { useCallback, useMemo } from "react";

import { MediaState } from "../api/types";
import { ReactResult } from "../utils/types";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    metadataList: {
      display: "grid",
      gridTemplateColumns: "max-content 1fr",
      fontSize: "1.2rem",
      padding: theme.spacing(2),
      alignItems: "first baseline",
      gridGap: theme.spacing(1),
      gap: theme.spacing(1),
      maxWidth: 450,
    },
    metadataLabel: {
      fontWeight: "bold",
      textAlign: "right",
    },
    metadataContent: {
      margin: 0,
    },
  }));

function Row(
  label: React.ReactNode,
  value: React.ReactNode,
): ReactResult {
  const classes = useStyles();

  return <React.Fragment>
    <dt className={classes.metadataLabel}>{label}</dt>
    <dd className={classes.metadataContent}>{value}</dd>
  </React.Fragment>;
}

interface LocalizedRowProps {
  label: string;
  children: React.ReactNode;
}

function LocalizedRow(props: LocalizedRowProps): ReactResult {
  const { l10n } = useLocalization();

  return Row(l10n.getString(props.label), props.children);
}

function NormalMetadataItem(media: MediaState, item: keyof MediaState): ReactResult {
  if (!media[item]) {
    return null;
  }

  return <LocalizedRow label={`metadata-label-${item}`}>
    {media[item]}
  </LocalizedRow>;
}

export interface MediaInfoProps {
  media: MediaState;
}

export default function MediaInfo(props: MediaInfoProps): ReactResult {
  const classes = useStyles();
  const media = props.media;

  const format = useCallback(<T extends keyof MediaState>(
    metadata: T,
    cb: (item: NonNullable<MediaState[T]>) => React.ReactNode,
  ): ReactResult => {
    let item: MediaState[T] = media[metadata];

    if (item) {
      return <LocalizedRow label={`metadata-label-${metadata}`}>
        {
          // @ts-ignore: This is correct.
          cb(item)
        }
      </LocalizedRow>;
    }
    return null;
  }, [media]);

  const location = useMemo(() => {
    let location: string[] = [];

    if (media.location) {
      location.push(media.location);
    }
    if (media.city) {
      location.push(media.city);
    }
    if (media.state) {
      location.push(media.state);
    }
    if (media.country) {
      location.push(media.country);
    }

    if (location.length) {
      let target = media.longitude && media.latitude
        ? `https://www.google.com/maps/@${media.latitude},${media.longitude}`
        : `https://www.google.com/maps/search/${encodeURIComponent(location.join(", "))}`;

      return <LocalizedRow label="metadata-label-location">
        <Link
          target="_blank"
          rel="noreferrer"
          href={target}
        >
          {location.join(", ")}
        </Link>
      </LocalizedRow>;
    } else if (media.longitude && media.latitude) {
      return <LocalizedRow label="metadata-label-location">
        <Link
          target="_blank"
          rel="noreferrer"
          href={`https://www.google.com/maps/@${media.latitude},${media.longitude}`}
        >
          {media.latitude} {media.longitude}
        </Link>
      </LocalizedRow>;
    } else {
      return null;
    }
  }, [media]);

  const taken = useMemo(() => {
    if (media.taken === null) {
      return null;
    }

    let taken = media.taken;

    if (media.timeZone) {
      taken = taken.tz(media.timeZone);
    }

    return <LocalizedRow label="metadata-label-taken">
      {taken.local().format("HH:mm:ss MM/DD/YYYY")}
    </LocalizedRow>;
  }, [media]);

  return <dl className={classes.metadataList}>
    {NormalMetadataItem(media, "filename")}
    {NormalMetadataItem(media, "title")}
    {NormalMetadataItem(media, "description")}
    {NormalMetadataItem(media, "category")}
    {NormalMetadataItem(media, "label")}
    {taken}
    {
      media.rating !== null &&
      <LocalizedRow label="metadata-label-rating">
        <Rating value={media.rating} readOnly={true}/>
      </LocalizedRow>
    }
    {location}
    {NormalMetadataItem(media, "photographer")}
    {format("shutterSpeed", (value: string): string => `${value} s`)}
    {
      format("aperture", (value: number): React.ReactNode => {
        return <React.Fragment>
          <i>f</i>
          {`/${value.toFixed(1)}`}
        </React.Fragment>;
      })
    }
    {format("iso", (value: number): string => `ISO ${Math.round(value)}`)}
    {NormalMetadataItem(media, "make")}
    {NormalMetadataItem(media, "model")}
    {NormalMetadataItem(media, "lens")}
    {format("focalLength", (value: number): string => `${value.toFixed(1)} mm`)}
  </dl>;
}
