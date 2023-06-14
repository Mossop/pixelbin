use std::str::from_utf8;

use handlebars::{
    html_escape, Context, Handlebars, Helper, HelperResult, Output, RenderContext, RenderError,
};
use pixelbin_store::models;
use rust_embed::RustEmbed;
use serde_json::Value;
use tracing::instrument;

use crate::util::{ApiState, MediaGroup};
use pixelbin_shared::{Result, ThumbnailConfig};
use serde::Serialize;

#[derive(RustEmbed)]
#[folder = "../../target/web/templates/"]
struct TemplateAssets;

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

fn concat_helper(
    h: &Helper,
    _: &Handlebars,
    _: &Context,
    _: &mut RenderContext,
    out: &mut dyn Output,
) -> HelperResult {
    let mut strs: Vec<String> = Vec::new();

    for param in h.params() {
        match param.value() {
            Value::String(s) => strs.push(s.clone()),
            Value::Number(n) => strs.push(n.to_string()),
            _ => return Err(RenderError::new("unexpected type in concat")),
        }
    }

    out.write(&strs.join(""))?;

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
    let str = match param.value().as_str() {
        Some(s) => s.to_owned(),
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
    match param.value().as_object() {
        None => Err(RenderError::new(
            "unexpected value when expanding attributes",
        )),
        Some(obj) => {
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
#[serde(rename_all = "camelCase")]
pub(crate) struct Album {
    #[serde(flatten)]
    pub(crate) state: ApiState,
    pub(crate) album: models::Album,
    pub(crate) media_groups: Vec<MediaGroup>,
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
        handlebars.register_helper("concat", Box::new(concat_helper));

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

    #[instrument(skip_all)]
    pub(crate) fn index(&self, data: Index) -> Result<String> {
        Ok(self.handlebars.render("index", &data)?)
    }

    #[instrument(skip_all)]
    pub(crate) fn album(&self, data: Album) -> Result<String> {
        Ok(self.handlebars.render("album", &data)?)
    }

    #[instrument(skip_all)]
    pub(crate) fn not_found(&self, data: NotFound) -> Result<String> {
        Ok(self.handlebars.render("notfound", &data)?)
    }
}
