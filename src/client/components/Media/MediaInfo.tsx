import { useLocalization } from "@fluent/react";
import Chip from "@material-ui/core/Chip";
import Link from "@material-ui/core/Link";
import type { Theme } from "@material-ui/core/styles";
import { makeStyles, createStyles } from "@material-ui/core/styles";
import Rating from "@material-ui/lab/Rating/Rating";
import clsx from "clsx";
import { useCallback, useMemo } from "react";
import { MapContainer, Marker, TileLayer } from "react-leaflet";

import type { ObjectModel } from "../../../model";
import { RelationType, Join, Operator } from "../../../model";
import { formatDateTime } from "../../../utils/datetime";
import type { Reference } from "../../api/highlevel";
import { refId, Tag, useReference, Album, Person } from "../../api/highlevel";
import type {
  MediaAlbumState,
  MediaPersonState,
  MediaRelations,
  MediaState,
  MediaTagState,
} from "../../api/types";
import { PageType } from "../../pages/types";
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
      gridColumn: "1 / 3",
      textAlign: "left",
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
    map: {
      paddingTop: "75%",
    },
  }));

function TagChip(props: { tag: Reference<Tag> }): ReactResult {
  let classes = useStyles();
  let tag = useReference(Tag, props.tag);

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
  let album = useReference(Album, props.album);

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
  let person = useReference(Person, state.person);

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

interface RowProps {
  id: string;
  multiline?: boolean;
  label: React.ReactNode;
  children: React.ReactNode;
}

function Row({
  id,
  label,
  children,
  multiline = false,
}: RowProps): ReactResult {
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
      {children}
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

  return <Row id={id} label={l10n.getString(label)} multiline={multiline}>{children}</Row>;
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
  let { l10n } = useLocalization();

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

    if (media.longitude && media.latitude) {
      let label = location.length
        ? l10n.getString("metadata-label-location-description", {
          location: location.join(", "),
        })
        : l10n.getString("metadata-label-location");

      return <Row id="location" label={label} multiline={true}>
        <MapContainer
          className={classes.map}
          center={[media.latitude, media.longitude]}
          zoom={13}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution="&copy; <a href='http://osm.org/copyright'>OpenStreetMap</a> contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[media.latitude, media.longitude]}/>
        </MapContainer>
      </Row>;
    } else if (location.length) {
      return <LocalizedRow id="location" label="metadata-label-location">
        <Link
          target="_blank"
          rel="noreferrer"
          href={`https://www.google.com/maps/search/${encodeURIComponent(location.join(", "))}`}
          color="secondary"
        >
          {location.join(", ")}
        </Link>
      </LocalizedRow>;
    } else {
      return null;
    }
  }, [media, l10n, classes]);

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
              (st: MediaAlbumState) => <AlbumChip key={refId(st.album)} album={st.album}/>,
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
          {relations.tags.map((st: MediaTagState) => <TagChip key={refId(st.tag)} tag={st.tag}/>)}
        </ul>
      </LocalizedRow>
    }
    {
      relations && relations.people.length > 0 &&
      <LocalizedRow id="people" label="metadata-label-people">
        <ul className={classes.fieldList}>
          {
            relations.people.map((st: MediaPersonState) => <PersonChip
              key={refId(st.person)}
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
