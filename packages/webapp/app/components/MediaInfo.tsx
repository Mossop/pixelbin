import clsx from "clsx";
import { DateTime } from "luxon";
import { useMemo } from "react";

import Chip from "./Chip";
import { Rating } from "./Rating";
import {
  MediaRelations,
  MediaView,
  PersonField,
  PersonRelation,
  Relation,
  SearchQuery,
  TagField,
} from "@/modules/types";
import { url } from "@/modules/util";

import "styles/components/MediaInfo.scss";

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

function queryUrl(catalog: string, query: SearchQuery): string {
  let params = new URLSearchParams({ q: JSON.stringify(query) });
  return `${url(["catalog", catalog, "search"])}?${params}`;
}

function personUrl(catalog: string, person: PersonRelation): string {
  let query: SearchQuery = {
    queries: [
      {
        type: "person",
        queries: [
          {
            type: "field",
            field: PersonField.Id,
            operator: "equal",
            value: person.id,
          },
        ],
      },
    ],
  };

  return queryUrl(catalog, query);
}

function tagUrl(catalog: string, tag: Relation): string {
  let query: SearchQuery = {
    queries: [
      {
        type: "tag",
        queries: [
          {
            type: "field",
            field: TagField.Id,
            operator: "equal",
            value: tag.id,
          },
        ],
      },
    ],
  };

  return queryUrl(catalog, query);
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

export default function MediaInfo({ media }: { media: MediaRelations }) {
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
    <dl className="c-media-info">
      <Metadata media={media} property="filename" />
      <Metadata media={media} property="title" />
      <Metadata media={media} property="description" />
      <Metadata media={media} property="category" />
      {media.albums.length > 0 && (
        <Row label="albums">
          <ul className="relation-list">
            {media.albums.map((r) => (
              <Chip key={r.id} to={url(["album", r.id])} icon="album">
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
            {media.tags.map((t) => (
              <Chip key={t.id} to={tagUrl(media.catalog, t)} icon="tag">
                {t.name}
              </Chip>
            ))}
          </ul>
        </Row>
      )}
      {media.people.length > 0 && (
        <Row label="people">
          <ul className="relation-list">
            {media.people.map((p) => (
              <Chip key={p.id} to={personUrl(media.catalog, p)} icon="person">
                {p.name}
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
