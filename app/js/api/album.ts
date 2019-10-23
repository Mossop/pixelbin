import { buildJSONBody, request, Patch } from "./api";
import { Album, AlbumDecoder } from "./types";
import { intoId, MapId } from "../utils/maps";

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
    url: "album/edit",
    method: "PATCH",
    body: buildJSONBody({
      id: album.id,
      parent: album.parent,
      name: album.name,
      stub: album.stub,
    }),
    decoder: AlbumDecoder,
  });
}
