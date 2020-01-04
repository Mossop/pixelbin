import { intoId, MapId, intoIds } from "../utils/maps";
import { buildJSONBody, request, Patch, baseRequest } from "./api";
import { Album, AlbumDecoder, Media } from "./types";

export async function createAlbum(name: string, parentAlbum: MapId<Album>): Promise<Album> {
  return request({
    url: "album/create",
    method: "PUT",
    body: buildJSONBody({
      parent: intoId(parentAlbum),
      name,
      stub: null,
    }),
    decoder: AlbumDecoder,
  });
}

export async function editAlbum(album: Patch<Album>): Promise<Album> {
  return await request({
    url: `album/edit/${album.id}`,
    method: "PATCH",
    body: buildJSONBody({
      parent: album.parent,
      name: album.name,
      stub: album.stub,
    }),
    decoder: AlbumDecoder,
  });
}

export async function addMediaToAlbum(album: MapId<Album>, media: MapId<Media>[]): Promise<void> {
  await baseRequest({
    url: `album/add_media/${intoId(album)}`,
    method: "PUT",
    body: buildJSONBody(intoIds(media)),
  });
}

export async function removeMediaFromAlbum(album: MapId<Album>, media: MapId<Media>[]): Promise<void> {
  await baseRequest({
    url: `album/remove_media/${intoId(album)}`,
    method: "DELETE",
    body: buildJSONBody(intoIds(media)),
  });
}
