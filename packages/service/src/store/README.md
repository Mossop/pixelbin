# pixelbin-store

## Database Tables

* `user`
  * Represents a user that can log in.
* `storage`
  * Represents an AWS S3 bucket.
  * Owned by a `user` via the `owner` field.
* `catalog`
  * A catalog of media.
  * Stored on a `storage` via the `storage` field.
* `shared_catalog`
  * Grants a user read or write access to a catalog.
  * Links to a `user` via the `user` field.
  * Links to a `catalog` via the `catalog` field.
* `saved_search`
  * A dynamic media search.
  * Belongs to a `catalog` via the `catalog` field.
* `album`
  * An album of media.
  * Belongs to a `catalog` via the `catalog` field.
  * Can belong to a parent `album` via the `parent` field.
* `person`
  * A person.
  * Belongs to a `catalog` via the `catalog` field.
* `tag`
  * A tag.
  * Belongs to a `catalog` via the `catalog` field.
  * Can belong to a parent `tag` via the `parent` field.
* `media_item`
  * A media item.
  * Belongs to a `catalog` via the `catalog` field.
  * References the current `media_file` via the `mediaFile` field.
* `media_file`
  * A particular uploaded piece of media.
  * Belongs to a `media_item` via the `media` field.
* `alternate_file`
  * An alternative representation of an uploaded media file.
  * Belongs to a `media_file` via the `mediaFile` field.
* `media_album`
  * Links `media_item` to an `album` via the `media` and `album` fields.
* `media_person`
  * Links `media_item` to a `person` via the `media` and `person` fields.
* `media_tag`
  * Links `media_item` to a `tag` via the `media` and `tag` fields.
