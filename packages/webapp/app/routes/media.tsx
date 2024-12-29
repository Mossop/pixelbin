import { MetaDescriptor, useLoaderData } from "react-router";

import MediaLayout from "@/components/MediaLayout";
import { getRequestContext } from "@/modules/RequestContext";
import { getMedia } from "@/modules/api";
import { AlternateFileType } from "@/modules/types";
import { deserializeMediaView, mediaTitle, url } from "@/modules/util";

import type { Route } from "./+types/media";

export async function loader({
  request,
  context,
  params: { media: mediaId },
}: Route.LoaderArgs) {
  let session = await getRequestContext(request, context);
  let pathParts = new URL(request.url).pathname.split("/");
  let search: string | null = null;
  if (pathParts[1] == "search") {
    search = pathParts[2];
  }

  return getMedia(session, mediaId, search);
}

function isTitleProvider(val: unknown): val is { title: string } {
  return (
    !!val &&
    typeof val === "object" &&
    "title" in val &&
    typeof val.title === "string"
  );
}

export function meta({ data, matches }: Route.MetaArgs) {
  let media = deserializeMediaView(data);
  let parentData = matches.at(-2)?.data;
  let parentTitle = isTitleProvider(parentData) ? parentData.title : undefined;

  let { serverConfig } = matches[0].data;

  let title: string | null | undefined = mediaTitle(media);

  if (title && parentTitle) {
    title = `${title} - ${parentTitle}`;
  } else if (!title) {
    title = parentTitle;
  }

  let metas: MetaDescriptor[] = [];

  if (title) {
    metas.push(
      { title },
      {
        property: "og:title",
        content: title,
      },
    );
  }

  if (media.description) {
    metas.push({ property: "og:description", content: media.description });
  }

  if (media.file?.alternates.some((a) => a.type == AlternateFileType.Social)) {
    metas.push({
      property: "og:image",
      content: `${serverConfig.apiUrl.slice(0, -1)}${url([
        "media",
        media.id,
        "social",
      ])}`,
    });
  }

  return metas;
}

export default function Media() {
  return (
    <MediaLayout media={deserializeMediaView(useLoaderData<typeof loader>())} />
  );
}
