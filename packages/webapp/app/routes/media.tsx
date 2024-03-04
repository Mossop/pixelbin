import { LoaderFunctionArgs, MetaFunction, json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import MediaLayout from "@/components/MediaLayout";
import { getMedia } from "@/modules/api";
import { getSession } from "@/modules/session";
import { deserializeMediaView, mediaTitle } from "@/modules/util";

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

  let title: string | null | undefined = mediaTitle(media!);

  if (title && parentTitle) {
    title = `${title} - ${parentTitle}`;
  } else if (!title) {
    title = parentTitle;
  }

  return title ? [{ title }] : [];
};

export default function Media() {
  return (
    <MediaLayout media={deserializeMediaView(useLoaderData<typeof loader>())} />
  );
}
