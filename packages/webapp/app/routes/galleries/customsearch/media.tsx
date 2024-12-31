import MediaLayout, { mediaMeta } from "@/components/MediaLayout";
import { getRequestContext } from "@/modules/RequestContext";
import { getMedia } from "@/modules/api";
import { deserializeMediaView } from "@/modules/util";

import type { Route } from "./+types/media";

export async function loader({
  request,
  context,
  params: { media: mediaId },
}: Route.LoaderArgs) {
  let session = await getRequestContext(request, context);
  return getMedia(session, mediaId, null);
}

export function meta({ data, matches }: Route.MetaArgs) {
  let media = deserializeMediaView(data);
  let parentTitle = matches[1].data.title;
  let { serverConfig } = matches[0].data;

  return mediaMeta(media, parentTitle, serverConfig);
}

export default function Media({ loaderData }: Route.ComponentProps) {
  return <MediaLayout media={deserializeMediaView(loaderData)} />;
}
