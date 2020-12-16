import { useLocalization } from "@fluent/react";
import Chip from "@material-ui/core/Chip";
import Link from "@material-ui/core/Link";
import type { Theme } from "@material-ui/core/styles";
import { makeStyles, createStyles } from "@material-ui/core/styles";
import Rating from "@material-ui/lab/Rating/Rating";
import clsx from "clsx";
import { useCallback, useMemo } from "react";

import type { ObjectModel } from "../../../model";
import { RelationType, Join, Operator } from "../../../model";
import { formatDateTime } from "../../../utils/datetime";
import type { Reference, Album, Tag, Person } from "../../api/highlevel";
import type {
  MediaAlbumState,
  MediaPersonState,
  MediaRelations,
  MediaState,
  MediaTagState,
} from "../../api/types";
import { PageType } from "../../pages/types";
import { useSelector } from "../../store";
import type { StoreState } from "../../store/types";
import type { ReactResult } from "../../utils/types";
import UILink from "../Link";

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
    },
    multilineMetadataContent: {
      gridColumn: "1 / 3",
    },
    fieldList: {
      display: "flex",
      flexWrap: "wrap",
      listStyle: "none",
      padding: 0,
    },
    fieldListItem: {
      paddingRight: theme.spacing(1),
      paddingBottom: theme.spacing(1),
    },
    chipLink: {
      cursor: "pointer",
    },
  }));

function TagChip(props: { tag: Reference<Tag> }): ReactResult {
  let classes = useStyles();
  let tag = useSelector((state: StoreState): Tag => props.tag.deref(state.serverState));

  return <li id={`tag-${tag.id}`} className={classes.fieldListItem}>
    <UILink
      to={
        {
          page: {
            type: PageType.Search,
            catalog: tag.catalog.ref(),
            query: {
              invert: false,
              type: "compound",
              join: Join.And,
              relation: RelationType.Tag,
              recursive: false,
              queries: [{
                invert: false,
                type: "field",
                field: "id",
                modifier: null,
                operator: Operator.Equal,
                value: tag.id,
              }],
            },
          },
        }
      }
    >
      <Chip className={classes.chipLink} size="small" label={tag.name}/>
    </UILink>
  </li>;
}

function AlbumChip(props: { album: Reference<Album> }): ReactResult {
  let classes = useStyles();
  let album = useSelector((state: StoreState): Album => props.album.deref(state.serverState));

  return <li id={`album-${album.id}`} className={classes.fieldListItem}>
    <UILink
      to={
        {
          page: {
            type: PageType.Album,
            album: props.album,
          },
        }
      }
    >
      <Chip className={classes.chipLink} size="small" label={album.name}/>
    </UILink>
  </li>;
}

interface PersonChipProps {
  state: MediaPersonState;
  onHighlightPerson?: (person: Reference<Person> | null) => void;
}

function PersonChip({
  state,
  onHighlightPerson,
}: PersonChipProps): ReactResult {
  let classes = useStyles();
  let person = useSelector(({ serverState }: StoreState) => state.person.deref(serverState));

  let onEnter = useCallback(() => {
    if (onHighlightPerson) {
      onHighlightPerson(state.person);
    }
  }, [onHighlightPerson, state]);

  let onLeave = useCallback(() => {
    if (onHighlightPerson) {
      onHighlightPerson(null);
    }
  }, [onHighlightPerson]);

  return <li
    id={`person-${person.id}`}
    onMouseEnter={onEnter}
    onMouseLeave={onLeave}
    className={classes.fieldListItem}
  >
    <UILink
      to={
        {
          page: {
            type: PageType.Search,
            catalog: person.catalog.ref(),
            query: {
              invert: false,
              type: "compound",
              join: Join.And,
              relation: RelationType.Person,
              recursive: false,
              queries: [{
                invert: false,
                type: "field",
                field: "id",
                modifier: null,
                operator: Operator.Equal,
                value: person.id,
              }],
            },
          },
        }
      }
    >
      <Chip className={classes.chipLink} size="small" label={person.name}/>
    </UILink>
  </li>;
}

function Row(
  id: string,
  label: React.ReactNode,
  value: React.ReactNode,
  multiline: boolean = false,
): ReactResult {
  let classes = useStyles();

  let labelClasses = clsx(
    classes.metadataLabel,
    multiline && classes.multilineMetadataLabel,
    `metadata-${id}`,
    "metadata-label",
  );
  let contentClasses = clsx(
    classes.metadataContent,
    multiline && classes.multilineMetadataContent,
    `metadata-${id}`,
    "metadata-value",
  );

  return <>
    <dt
      className={labelClasses}
    >
      {label}
    </dt>
    <dd
      className={contentClasses}
    >
      {value}
    </dd>
  </>;
}

interface LocalizedRowProps {
  id: string,
  label: string;
  multiline?: boolean;
  children: React.ReactNode;
}

function LocalizedRow({
  id,
  label,
  multiline,
  children,
}: LocalizedRowProps): ReactResult {
  let { l10n } = useLocalization();

  return Row(id, l10n.getString(label), children, multiline);
}

function NormalMetadataItem(
  media: ObjectModel.Metadata,
  item: keyof ObjectModel.Metadata,
): ReactResult {
  if (!media[item]) {
    return null;
  }

  return <LocalizedRow id={item} label={`metadata-label-${item}`}>
    {media[item]}
  </LocalizedRow>;
}

export interface MediaInfoProps {
  media: ObjectModel.Metadata;
  relations?: MediaRelations | null;
  onHighlightPerson: (person: Reference<Person> | null) => void;
}

export default function MediaInfo({
  media,
  relations,
  onHighlightPerson,
}: MediaInfoProps): ReactResult {
  let classes = useStyles();

  let format = useCallback(<T extends keyof ObjectModel.Metadata>(
    metadata: T,
    cb: (item: NonNullable<MediaState[T]>) => React.ReactNode,
  ): ReactResult => {
    let item: ObjectModel.Metadata[T] = media[metadata];

    if (item) {
      return <LocalizedRow id={metadata} label={`metadata-label-${metadata}`}>
        {
          // @ts-ignore
          cb(item)
        }
      </LocalizedRow>;
    }
    return null;
  }, [media]);

  let location = useMemo(() => {
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

      return <LocalizedRow id="location" label="metadata-label-location">
        <Link
          target="_blank"
          rel="noreferrer"
          href={target}
          color="secondary"
        >
          {location.join(", ")}
        </Link>
      </LocalizedRow>;
    } else if (media.longitude && media.latitude) {
      return <LocalizedRow id="location" label="metadata-label-location">
        <Link
          target="_blank"
          rel="noreferrer"
          href={`https://www.google.com/maps/@${media.latitude},${media.longitude}`}
          color="secondary"
        >
          {media.latitude} {media.longitude}
        </Link>
      </LocalizedRow>;
    } else {
      return null;
    }
  }, [media]);

  let taken = useMemo(() => {
    if (media.taken === null) {
      return null;
    }

    return <LocalizedRow id="taken" label="metadata-label-taken">
      {formatDateTime(media.taken)}
    </LocalizedRow>;
  }, [media]);

  return <dl className={classes.metadataList}>
    {NormalMetadataItem(media, "filename")}
    {NormalMetadataItem(media, "title")}
    {NormalMetadataItem(media, "description")}
    {NormalMetadataItem(media, "category")}
    {
      relations && relations.albums.length > 0 &&
      <LocalizedRow id="albums" label="metadata-label-albums">
        <ul className={classes.fieldList}>
          {
            relations.albums.map(
              (st: MediaAlbumState) => <AlbumChip key={st.album.id} album={st.album}/>,
            )
          }
        </ul>
      </LocalizedRow>
    }
    {NormalMetadataItem(media, "label")}
    {taken}
    {
      media.rating !== null &&
      <LocalizedRow id="rating" label="metadata-label-rating">
        <Rating value={media.rating} readOnly={true}/>
      </LocalizedRow>
    }
    {location}
    {
      relations && relations.tags.length > 0 &&
      <LocalizedRow id="tags" label="metadata-label-tags">
        <ul className={classes.fieldList}>
          {relations.tags.map((st: MediaTagState) => <TagChip key={st.tag.id} tag={st.tag}/>)}
        </ul>
      </LocalizedRow>
    }
    {
      relations && relations.people.length > 0 &&
      <LocalizedRow id="people" label="metadata-label-people">
        <ul className={classes.fieldList}>
          {
            relations.people.map((st: MediaPersonState) => <PersonChip
              key={st.person.id}
              state={st}
              onHighlightPerson={onHighlightPerson}
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
        return <>
          <i>f</i>
          {`/${value.toFixed(1)}`}
        </>;
      })
    }
    {format("iso", (value: number): string => `ISO ${Math.round(value)}`)}
    {NormalMetadataItem(media, "make")}
    {NormalMetadataItem(media, "model")}
    {NormalMetadataItem(media, "lens")}
    {format("focalLength", (value: number): string => `${value.toFixed(1)} mm`)}
  </dl>;
}
