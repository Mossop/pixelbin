import { listMedia } from "@/modules/api";
import { ApiMediaView } from "@/modules/types";

const encoder = new TextEncoder();

function encodeMediaViews(media: ApiMediaView[]): Uint8Array {
  return encoder.encode(`${JSON.stringify(media)}\n`);
}

export async function GET(
  request: Request,
  { params: { type, id } }: { params: { type: string; id: string } },
) {
  if (!["catalog", "album", "search"].includes(type)) {
    throw new Error("Unknown type");
  }

  // @ts-ignore
  let mediaViewIterator = listMedia(type, id);
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
