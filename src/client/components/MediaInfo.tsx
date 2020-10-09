import { useLocalization } from "@fluent/react";
import Chip from "@material-ui/core/Chip";
import Link from "@material-ui/core/Link";
import { makeStyles, createStyles, Theme } from "@material-ui/core/styles";
import Rating from "@material-ui/lab/Rating/Rating";
import React, { useCallback, useMemo } from "react";

import { ObjectModel } from "../../model";
import { formatDateTime } from "../../utils";
import { Reference, Tag } from "../api/highlevel";
import { MediaPersonState, MediaState } from "../api/types";
import { useSelector } from "../store";
import { StoreState } from "../store/types";
import { ReactResult } from "../utils/types";

const FRACTION = /^(\d+)\/(\d+)$/;

function superscript(val: number): string {
  val = Math.ceil(val);

  let result: string[] = [];
  while (val > 0) {
    let digit = val % 10;

    switch (digit) {
      case 1:
        result.unshift("\u00B9");
        break;
      case 2:
      case 3:
        result.unshift(String.fromCharCode(0x00B0 + digit));
        break;
      default:
        result.unshift(String.fromCharCode(0x2070 + digit));
    }

    val = (val - digit) / 10;
  }

  return result.join("");
}

function subscript(val: number): string {
  val = Math.ceil(val);

  let result: string[] = [];
  while (val > 0) {
    let digit = val % 10;
    result.unshift(String.fromCharCode(0x2080 + digit));
    val = (val - digit) / 10;
  }

  return result.join("");
}

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
    multilineMetadataLabel: {
      fontWeight: "bold",
      textAlign: "right",
    },
    multilineMetadataContent: {
      margin: 0,
      gridColumn: "1 / 3",
    },
    tagList: {
      "display": "flex",
      "flexWrap": "wrap",
      "listStyle": "none",
      "padding": 0,
      "& > li": {
        paddingRight: theme.spacing(1),
        paddingBottom: theme.spacing(1),
      },
    },
  }));

function TagChip(props: { tag: Reference<Tag> }): ReactResult {
  let tag = useSelector((state: StoreState): Tag => props.tag.deref(state.serverState));

  return <li><Chip size="small" label={tag.name}/></li>;
}

interface PersonChipProps {
  state: MediaPersonState;
  onHighlighRegion?: (region: ObjectModel.Location | null) => void;
}

function PersonChip(props: PersonChipProps): ReactResult {
  let person = useSelector(({ serverState }: StoreState) => props.state.person.deref(serverState));

  let onEnter = useCallback(() => {
    if (props.onHighlighRegion) {
      props.onHighlighRegion(props.state.location);
    }
  }, [props]);

  let onLeave = useCallback(() => {
    if (props.onHighlighRegion) {
      props.onHighlighRegion(null);
    }
  }, [props]);

  return <li
    key={person.id}
    onMouseEnter={onEnter}
    onMouseLeave={onLeave}
  >
    <Chip size="small" label={person.name}/>
  </li>;
}

function Row(
  label: React.ReactNode,
  value: React.ReactNode,
  multiline: boolean = false,
): ReactResult {
  const classes = useStyles();

  if (multiline) {
    return <React.Fragment>
      <dt className={classes.multilineMetadataLabel}>{label}</dt>
      <dd className={classes.multilineMetadataContent}>{value}</dd>
    </React.Fragment>;
  }

  return <React.Fragment>
    <dt className={classes.metadataLabel}>{label}</dt>
    <dd className={classes.metadataContent}>{value}</dd>
  </React.Fragment>;
}

interface LocalizedRowProps {
  label: string;
  multiline?: boolean;
  children: React.ReactNode;
}

function LocalizedRow(props: LocalizedRowProps): ReactResult {
  const { l10n } = useLocalization();

  return Row(l10n.getString(props.label), props.children, props.multiline);
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
  onHighlightRegion?: (region: ObjectModel.Location | null) => void;
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

    return <LocalizedRow label="metadata-label-taken">
      {formatDateTime(media.taken)}
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
    {
      media.tags.length &&
      <LocalizedRow label="metadata-label-tags">
        <ul className={classes.tagList}>
          {media.tags.map((tag: Reference<Tag>) => <TagChip key={tag.id} tag={tag}/>)}
        </ul>
      </LocalizedRow>
    }
    {
      media.people.length &&
      <LocalizedRow label="metadata-label-people">
        <ul className={classes.tagList}>
          {
            media.people.map((state: MediaPersonState) => <PersonChip
              key={state.person.id}
              state={state}
              onHighlighRegion={props.onHighlightRegion}
            />)
          }
        </ul>
      </LocalizedRow>
    }
    {NormalMetadataItem(media, "photographer")}
    {
      format("shutterSpeed", (value: string): string => {
        let matches = FRACTION.exec(value);
        if (matches) {
          value = superscript(parseInt(matches[1])) + "\u2044" + subscript(parseInt(matches[2]));
        }
        return `${value} s`;
      })
    }
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
