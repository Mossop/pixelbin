use std::str::from_utf8;

use handlebars::{Context, Handlebars, Helper, HelperResult, Output, RenderContext, RenderError};
use pixelbin_store::models;
use rust_embed::RustEmbed;
use serde_json::Value;

use crate::ApiState;
use pixelbin_shared::Result;
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
            "unexpected null when expanding attributed",
        )),
        Value::Bool(_) => Err(RenderError::new(
            "unexpected boolean when expanding attributed",
        )),
        Value::Number(_) => Err(RenderError::new(
            "unexpected number when expanding attributed",
        )),
        Value::String(_) => Err(RenderError::new(
            "unexpected string when expanding attributed",
        )),
        Value::Array(_) => Err(RenderError::new(
            "unexpected array when expanding attributed",
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
                    Value::Array(_) => {
                        return Err(RenderError::new(
                            "unexpected array when expanding attributed",
                        ))
                    }
                    Value::Object(_) => {
                        return Err(RenderError::new(
                            "unexpected object when expanding attributed",
                        ))
                    }
                };

                out.write(&format!("{key}=\"{value}\""))?;
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
