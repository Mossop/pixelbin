use std::str::from_utf8;

use handlebars::{
    html_escape, Context, Handlebars, Helper, HelperResult, Output, RenderContext, RenderError,
};
use pixelbin_store::models;
use rust_embed::RustEmbed;
use serde_json::Value;

use crate::ApiState;
use pixelbin_shared::{Result, ThumbnailConfig};
use serde::Serialize;

#[derive(RustEmbed)]
#[folder = "../../target/web/templates/"]
struct TemplateAssets;

#[derive(Serialize)]
pub(crate) struct AlbumNav {
    #[serde(flatten)]
    pub(crate) album: models::Album,
    pub(crate) children: Vec<AlbumNav>,
}

#[derive(Serialize)]
pub(crate) struct CatalogNav {
    #[serde(flatten)]
    pub(crate) catalog: models::Catalog,
    pub(crate) searches: Vec<models::SavedSearch>,
    pub(crate) albums: Vec<AlbumNav>,
}

#[derive(Serialize)]
pub(crate) struct UserNav {
    pub(crate) catalogs: Vec<CatalogNav>,
}

fn mime_ext_helper(
    h: &Helper,
    _: &Handlebars,
    _: &Context,
    _: &mut RenderContext,
    out: &mut dyn Output,
) -> HelperResult {
    let param = h.param(0).ok_or(RenderError::new("param not found"))?;
    let mimetype = match param.value() {
        Value::String(s) => s.clone(),
        _ => return Err(RenderError::new("unexpected type when stripping extension")),
    };

    match mimetype.as_str() {
        "image/webp" => out.write("webp")?,
        "image/jpeg" => out.write("jpg")?,
        _ => out.write("bin")?,
    }

    Ok(())
}

fn strip_ext_helper(
    h: &Helper,
    _: &Handlebars,
    _: &Context,
    _: &mut RenderContext,
    out: &mut dyn Output,
) -> HelperResult {
    let param = h.param(0).ok_or(RenderError::new("param not found"))?;
    let str = match param.value() {
        Value::String(s) => s.clone(),
        _ => return Err(RenderError::new("unexpected type when stripping extension")),
    };

    if let Some(index) = str.rfind('.') {
        out.write(&str[0..index])?;
    } else {
        out.write(&str)?;
    }
    Ok(())
}

fn json_helper(
    h: &Helper,
    _: &Handlebars,
    _: &Context,
    _: &mut RenderContext,
    out: &mut dyn Output,
) -> HelperResult {
    let param = h.param(0).ok_or(RenderError::new("param not found"))?;
    out.write(serde_json::to_string(param.value()).unwrap().as_ref())?;
    Ok(())
}

fn attrs_helper(
    h: &Helper,
    _: &Handlebars,
    _: &Context,
    _: &mut RenderContext,
    out: &mut dyn Output,
) -> HelperResult {
    let param = h.param(0).ok_or(RenderError::new("param not found"))?;
    match param.value() {
        Value::Null => Err(RenderError::new(
            "unexpected null when expanding attributes",
        )),
        Value::Bool(_) => Err(RenderError::new(
            "unexpected boolean when expanding attributes",
        )),
        Value::Number(_) => Err(RenderError::new(
            "unexpected number when expanding attributes",
        )),
        Value::String(_) => Err(RenderError::new(
            "unexpected string when expanding attributes",
        )),
        Value::Array(_) => Err(RenderError::new(
            "unexpected array when expanding attributes",
        )),
        Value::Object(obj) => {
            for (key, v) in obj {
                let value = match v {
                    Value::Null => {
                        continue;
                    }
                    Value::Bool(b) => b.to_string(),
                    Value::Number(n) => n.to_string(),
                    Value::String(s) => s.clone(),
                    Value::Array(a) => serde_json::to_string(a).unwrap(),
                    Value::Object(o) => serde_json::to_string(o).unwrap(),
                };

                out.write(&format!("{key}=\"{}\" ", html_escape(&value)))?;
            }
            Ok(())
        }
    }
}

#[derive(Serialize)]
pub(crate) struct Index {
    #[serde(flatten)]
    pub(crate) state: ApiState,
}

#[derive(Serialize)]
pub(crate) struct Album {
    #[serde(flatten)]
    pub(crate) state: ApiState,
    pub(crate) album: models::Album,
    pub(crate) media: Vec<models::MediaView>,
    pub(crate) thumbnails: ThumbnailConfig,
}

#[derive(Serialize)]
pub(crate) struct NotFound {
    #[serde(flatten)]
    pub(crate) state: ApiState,
}

pub(crate) struct Templates<'a> {
    handlebars: Handlebars<'a>,
}

impl<'a> Templates<'a> {
    pub(crate) fn new() -> Self {
        let mut handlebars = Handlebars::new();
        handlebars.set_strict_mode(true);
        handlebars.register_helper("json", Box::new(json_helper));
        handlebars.register_helper("attrs", Box::new(attrs_helper));
        handlebars.register_helper("strip_ext", Box::new(strip_ext_helper));
        handlebars.register_helper("mime_ext", Box::new(mime_ext_helper));

        for name in TemplateAssets::iter() {
            if name.ends_with(".hbs") {
                let embedded = TemplateAssets::get(&name).unwrap();

                if name.starts_with("partials/") {
                    let template_name = &name[9..name.len() - 4];
                    handlebars
                        .register_partial(template_name, from_utf8(&embedded.data).unwrap())
                        .unwrap();
                } else {
                    let template_name = &name[0..name.len() - 4];
                    handlebars
                        .register_template_string(template_name, from_utf8(&embedded.data).unwrap())
                        .unwrap();
                }
            }
        }

        Templates { handlebars }
    }

    pub(crate) fn index(&self, data: Index) -> Result<String> {
        Ok(self.handlebars.render("index", &data)?)
    }

    pub(crate) fn album(&self, data: Album) -> Result<String> {
        Ok(self.handlebars.render("album", &data)?)
    }

    pub(crate) fn not_found(&self, data: NotFound) -> Result<String> {
        Ok(self.handlebars.render("notfound", &data)?)
    }
}
