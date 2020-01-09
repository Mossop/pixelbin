import { buildJSONBody, request, Patch, baseRequest } from "./api";
import { AlbumData, AlbumDecoder, MediaData, CreateData } from "./types";
import { intoId, intoIds, MapId } from "../utils/maps";
import { Album } from "./highlevel";

export async function createAlbum(data: CreateData<AlbumData>): Promise<AlbumData> {
  return request({
    url: "album/create",
    method: "PUT",
    body: buildJSONBody(data),
    decoder: AlbumDecoder,
  });
}

export async function editAlbum(album: Patch<AlbumData>): Promise<AlbumData> {
  return await request({
    url: `album/edit/${album.id}`,
    method: "PATCH",
    body: buildJSONBody(album),
    decoder: AlbumDecoder,
  });
}

export async function addMediaToAlbum(album: MapId<Album | AlbumData>, media: MapId<MediaData>[]): Promise<void> {
  await baseRequest({
    url: `album/add_media/${intoId(album)}`,
    method: "PUT",
    body: buildJSONBody(intoIds(media)),
  });
}

export async function removeMediaFromAlbum(album: MapId<Album | AlbumData>, media: MapId<MediaData>[]): Promise<void> {
  await baseRequest({
    url: `album/remove_media/${intoId(album)}`,
    method: "DELETE",
    body: buildJSONBody(intoIds(media)),
  });
}
