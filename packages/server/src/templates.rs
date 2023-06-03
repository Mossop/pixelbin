use std::str::from_utf8;

use handlebars::Handlebars;
use rust_embed::RustEmbed;

use pixelbin_shared::Result;

#[derive(RustEmbed)]
#[folder = "../../target/web/templates/"]
struct TemplateAssets;

const NO_DATA: Option<String> = None;

pub(crate) struct Templates<'a> {
    handlebars: Handlebars<'a>,
}

impl<'a> Templates<'a> {
    pub(crate) fn new() -> Self {
        let mut handlebars = Handlebars::new();
        handlebars.set_strict_mode(true);

        for name in TemplateAssets::iter() {
            if name.ends_with(".hbs") {
                let template_name = &name[0..name.len() - 4];
                let embedded = TemplateAssets::get(&name).unwrap();
                handlebars
                    .register_template_string(template_name, from_utf8(&embedded.data).unwrap())
                    .unwrap();
            }
        }

        Templates { handlebars }
    }

    pub(crate) fn index(&self) -> Result<String> {
        Ok(self.handlebars.render("index", &NO_DATA)?)
    }
}
