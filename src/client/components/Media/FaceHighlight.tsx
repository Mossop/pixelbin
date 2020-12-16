import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import clsx from "clsx";
import alpha from "color-alpha";

import type { Api } from "../../../model";
import { weakUpsert } from "../../../utils/utility";
import type { Person, Reference } from "../../api/highlevel";
import type { MediaFileState, MediaRelations } from "../../api/types";
import type { ReactResult } from "../../utils/types";
import FixedAspect from "../FixedAspect";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    bounds: {
      height: "100%",
      width: "100%",
    },
    viewport: {
      height: "100%",
      width: "100%",
      position: "relative",
    },
    area: {
      borderSize: 2,
      borderColor: alpha(theme.palette.primary.dark, 0.8),
      borderStyle: "solid",
      borderRadius: 2,
      position: "absolute",
    },
  }));

const LocationKeys = new WeakMap<Api.Location, number>();
let nextKey = 1;
function locationKey(location: Api.Location): number {
  return weakUpsert(LocationKeys, location, () => nextKey++);
}

export interface FaceHighlightProps {
  mediaFile: MediaFileState;
  relations?: MediaRelations | null;
  people: Reference<Person>[];
}

export default function FaceHighlight({
  mediaFile,
  relations,
  people,
}: FaceHighlightProps): ReactResult {
  let classes = useStyles();

  if (!relations) {
    return null;
  }

  let locations: Api.Location[] = [];

  let ids = new Set(people.map((person: Reference<Person>): string => person.id));
  for (let person of relations.people) {
    if (ids.has(person.person.id) && person.location) {
      locations.push(person.location);
    }
  }

  return <FixedAspect
    className={classes.bounds}
    aspectRatio={mediaFile.width / mediaFile.height}
  >
    <div className={classes.viewport}>
      {
        locations.map((location: Api.Location) => <div
          key={`${locationKey(location)}`}
          className={clsx(classes.area, "face-highlight")}
          style={
            {
              left: `${location.left * 100}%`,
              top: `${location.top * 100}%`,
              right: `${100 - location.right * 100}%`,
              bottom: `${100 - location.bottom * 100}%`,
            }
          }
        />)
      }
    </div>
  </FixedAspect>;
}
