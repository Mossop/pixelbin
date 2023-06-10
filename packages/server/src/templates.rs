use std::str::from_utf8;

use handlebars::{Context, Handlebars, Helper, HelperResult, Output, RenderContext, RenderError};
use pixelbin_store::models;
use rust_embed::RustEmbed;

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

#[derive(Serialize)]
pub(crate) struct Index {
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
}
