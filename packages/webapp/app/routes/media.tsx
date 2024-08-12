import { LoaderFunctionArgs, MetaFunction, json } from "@remix-run/node";
import { MetaDescriptor, useLoaderData } from "@remix-run/react";

import MediaLayout from "@/components/MediaLayout";
import { ApiConfig, getMedia } from "@/modules/api";
import { getSession } from "@/modules/session";
import { deserializeMediaView, mediaTitle, url } from "@/modules/util";

export async function loader({
  request,
  params: { media: mediaId },
}: LoaderFunctionArgs) {
  let session = await getSession(request);
  let media = await getMedia(session, mediaId!);

  return json(media);
}

export const meta: MetaFunction<typeof loader> = ({ data, matches }) => {
  let media = deserializeMediaView(data!);
  // @ts-ignore
  let parentTitle = matches.at(-2)?.data?.title as unknown as
    | string
    | undefined;

  let serverConfig: ApiConfig;
  // @ts-ignore
  serverConfig = matches.find((m) => m.id == "root").data.serverConfig;

  let title: string | null | undefined = mediaTitle(media!);

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

  metas.push({
    property: "og:image",
    content: `${serverConfig.apiUrl.slice(0, -1)}${url([
      "media",
      media.id,
      "social",
    ])}`,
  });

  return metas;
};

export default function Media() {
  return (
    <MediaLayout media={deserializeMediaView(useLoaderData<typeof loader>())} />
  );
}
