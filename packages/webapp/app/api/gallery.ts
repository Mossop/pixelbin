import { LoaderFunctionArgs } from "@remix-run/node";

import { listMedia, searchMedia } from "@/modules/api";
import { getSession } from "@/modules/session";
import { ApiMediaView } from "@/modules/types";

const encoder = new TextEncoder();

function encodeMediaViews(media: ApiMediaView[]): Uint8Array {
  return encoder.encode(`${JSON.stringify(media)}\n`);
}

export async function loader({
  request,
  params: { container, id, type },
}: LoaderFunctionArgs) {
  if (!["catalog", "album", "search"].includes(container!)) {
    throw new Error(`Unknown container: ${container}`);
  }

  let session = await getSession(request);

  let mediaViewIterator: AsyncGenerator<ApiMediaView[], void, unknown>;

  if (type == "media") {
    mediaViewIterator = listMedia(
      session,
      // @ts-ignore
      container!,
      id!,
    );
  } else if (type == "search") {
    let url = new URL(request.url);
    let param = url.searchParams.get("q");
    if (!param) {
      throw new Error("No search query specified");
    }

    let query = JSON.parse(param);
    mediaViewIterator = searchMedia(session, id!, query);
  } else {
    throw new Error(`Unknown lookup type: ${type}`);
  }

  let stream = new ReadableStream({
    async pull(controller) {
      let { value, done } = await mediaViewIterator.next();

      if (done) {
        controller.close();
      } else {
        controller.enqueue(encodeMediaViews(value!));
      }
    },
  });

  return new Response(stream);
}
