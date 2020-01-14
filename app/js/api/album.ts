import { request } from "./api";
import { intoId, intoIds, MapId } from "../utils/maps";
import { Album } from "./highlevel";
import { AlbumCreateData, ApiMethod, AlbumData, Patch} from "./types";
import { MediaData } from "./media";

export function createAlbum(data: AlbumCreateData): Promise<AlbumData> {
  return request(ApiMethod.AlbumCreate, data);
}

export function editAlbum(album: Patch<AlbumCreateData>): Promise<AlbumData> {
  return request(ApiMethod.AlbumEdit, album);
}

export function addMediaToAlbum(album: MapId<Album | AlbumData>, media: MapId<MediaData>[]): Promise<void> {
  return request(ApiMethod.AlbumAddMedia, {
    id: intoId(album),
    media: intoIds(media),
  });
}

export function removeMediaFromAlbum(album: MapId<Album | AlbumData>, media: MapId<MediaData>[]): Promise<void> {
  return request(ApiMethod.AlbumRemoveMedia, {
    id: intoId(album),
    media: intoIds(media),
  });
}
