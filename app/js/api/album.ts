import { buildJSONBody, request } from "./api";
import { Album, AlbumDecoder, Catalog } from "./types";

export async function createAlbum(catalog: Catalog, name: string, parent: string): Promise<Album> {
  let response = await request("album/create", "PUT", buildJSONBody({
    catalog: catalog.id,
    name,
    stub: null,
    parent: parent || null,
  }));

  if (response.ok) {
    return AlbumDecoder.decodePromise(await response.json());
  } else {
    throw new Error("Failed to create album.");
  }
}

export async function editAlbum(album: Album, catalog: Catalog, name: string, parent: string): Promise<Album> {
  let response = await request("album/edit", "POST", buildJSONBody({
    id: album.id,
    catalog: catalog.id,
    name,
    stub: album.stub,
    parent: parent || null,
  }));

  if (response.ok) {
    return AlbumDecoder.decodePromise(await response.json());
  } else {
    throw new Error("Failed to edit album.");
  }
}
