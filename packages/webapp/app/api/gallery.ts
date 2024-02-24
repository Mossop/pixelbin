import { LoaderFunctionArgs } from "@remix-run/node";

import { listMedia } from "@/modules/api";
import { getSession } from "@/modules/session";
import { ApiMediaView } from "@/modules/types";

const encoder = new TextEncoder();

function encodeMediaViews(media: ApiMediaView[]): Uint8Array {
  return encoder.encode(`${JSON.stringify(media)}\n`);
}

export async function loader({
  request,
  params: { type, id },
}: LoaderFunctionArgs) {
  if (!["catalog", "album", "search"].includes(type!)) {
    throw new Error("Unknown type");
  }

  let session = await getSession(request);

  let mediaViewIterator = listMedia(
    session,
    // @ts-ignore
    type!,
    id!,
  );

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
