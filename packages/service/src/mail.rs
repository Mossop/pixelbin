use std::{error::Error, str::FromStr};

use askama::Template;
use mail_send::{
    mail_builder::{headers::address::Address, mime::MimePart, MessageBuilder},
    SmtpClientBuilder,
};
use mime::Mime;
use pixelbin_shared::{Config, MailServer};
use tracing::{error, trace, warn};

use crate::store::models::SavedSearch;

const LOGO_IMAGE: &[u8; 10913] = include_bytes!("../templates/logo.png");

mod filters {
    use crate::store::models::Batch;

    pub(super) fn batch<T>(slice: &[T], count: usize) -> ::askama::Result<Batch<T>> {
        Ok(Batch::new(slice, count))
    }
}

pub(crate) struct Media {
    pub(crate) id: String,
    pub(crate) cid: String,
    pub(crate) mime_type: Mime,
    pub(crate) data: Vec<u8>,
}

pub(crate) trait MessageTemplate: Template {
    fn address(&self) -> String;

    fn subject(&self) -> String;

    fn attachments(&self) -> Option<Vec<&Media>> {
        None
    }

    fn build_message(&self) -> MessageBuilder {
        let mut mimeparts = MimePart::new(
            "multipart/related",
            vec![
                MimePart::new("text/html", self.render().unwrap()),
                MimePart::new("image/png", LOGO_IMAGE.to_vec())
                    .inline()
                    .cid("logo_image"),
            ],
        );

        if let Some(attachments) = self.attachments() {
            for part in attachments {
                mimeparts.add_part(
                    MimePart::new(part.mime_type.to_string(), part.data.clone())
                        .inline()
                        .cid(&part.cid),
                );
            }
        }

        MessageBuilder::new()
            .subject(self.subject())
            .to(self.address())
            .body(mimeparts)
    }
}

#[derive(Template)]
#[template(path = "subscription_request.html")]
pub(crate) struct SubscriptionRequest<'a> {
    pub(crate) base_url: String,
    pub(crate) search: &'a SavedSearch,
    pub(crate) email: &'a str,
    pub(crate) token: &'a str,
}

impl<'a> MessageTemplate for SubscriptionRequest<'a> {
    fn address(&self) -> String {
        self.email.to_owned()
    }

    fn subject(&self) -> String {
        format!(
            "📷 PixelBin: Request to subscribe to \"{}\"",
            self.search.name
        )
    }
}

#[derive(Template)]
#[template(path = "subscribed.html")]
pub(crate) struct Subscribed<'a> {
    pub(crate) base_url: String,
    pub(crate) search: &'a SavedSearch,
    pub(crate) email: &'a str,
}

impl<'a> MessageTemplate for Subscribed<'a> {
    fn address(&self) -> String {
        self.email.to_owned()
    }

    fn subject(&self) -> String {
        format!(
            "📷 PixelBin: You are subscribed to \"{}\"",
            self.search.name
        )
    }
}

#[derive(Template)]
#[template(path = "search_update.html")]
pub(crate) struct SavedSearchUpdate<'a> {
    pub(crate) base_url: String,
    pub(crate) search: &'a SavedSearch,
    pub(crate) email: &'a str,
    pub(crate) media: Vec<&'a Media>,
}

impl<'a> MessageTemplate for SavedSearchUpdate<'a> {
    fn address(&self) -> String {
        self.email.to_owned()
    }

    fn subject(&self) -> String {
        format!("📷 PixelBin: New content in \"{}\"", self.search.name)
    }

    fn attachments(&self) -> Option<Vec<&Media>> {
        Some(self.media.clone())
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum TlsType {
    None,
    Implicit,
    StartTls,
}

impl From<u16> for TlsType {
    fn from(port: u16) -> Self {
        match port {
            25 | 587 => TlsType::StartTls,
            465 => TlsType::Implicit,
            _ => TlsType::None,
        }
    }
}

async fn build_and_send(
    config: &Config,
    messages: Vec<MessageBuilder<'_>>,
) -> Result<(), Box<dyn Error>> {
    if config.testing {
        return Ok(());
    }

    let (address, port, tls) = match &config.mail_server {
        MailServer::None => {
            warn!("No mailserver configured");
            return Ok(());
        }
        MailServer::Address(address) => {
            if let Some(pos) = address.find(':') {
                let port = u16::from_str(&address[pos + 1..])?;
                (address[0..pos].to_owned(), port, TlsType::from(port))
            } else {
                (address.clone(), 587, TlsType::from(587))
            }
        }
        MailServer::Options { address, port } => {
            let port = port.unwrap_or(587);
            (address.clone(), port, TlsType::from(port))
        }
    };

    trace!(address, port, "Connecting to mail server");
    let mut client = SmtpClientBuilder::new(address, port)
        .implicit_tls(tls == TlsType::Implicit)
        .connect()
        .await?;

    for message in messages {
        if let Err(e) = client.send(message).await {
            error!(error=%e, "Failed to send message");
        }
    }

    Ok(())
}

pub(crate) async fn send_messages<'a, T>(config: &Config, templates: &[T])
where
    T: 'a + MessageTemplate,
{
    let from = config.mail_address.as_ref().map(|addr| {
        if let (Some(lpos), Some(rpos)) = (addr.find('<'), addr.rfind('>')) {
            let name = addr[0..lpos].trim();
            let address = &addr[lpos + 1..rpos];
            if name.is_empty() {
                Address::new_address(Option::<String>::None, address.to_owned())
            } else {
                Address::new_address(Some(name.to_owned()), address.to_owned())
            }
        } else {
            Address::new_address(Option::<String>::None, addr.to_owned())
        }
    });

    let messages = templates
        .iter()
        .map(|template| {
            if let Some(ref addr) = from {
                template.build_message().from(addr.clone())
            } else {
                template.build_message()
            }
        })
        .collect();

    if let Err(e) = build_and_send(config, messages).await {
        error!(error=%e, "Error sendimg mail message.");
    }
}

pub enum TestMessage {
    SubscriptionRequest,
}

pub async fn send_test_message(config: &Config, address: &str, message: TestMessage) {
    match message {
        TestMessage::SubscriptionRequest => {
            let search = SavedSearch {
                id: "searchid".to_owned(),
                name: "5 Stars".to_owned(),
                shared: true,
                query: Default::default(),
                catalog: "catalog".to_owned(),
            };

            send_messages(
                config,
                &[SubscriptionRequest {
                    base_url: config.base_url.to_string(),
                    email: address,
                    search: &search,
                    token: "tokentokentoken",
                }],
            )
            .await;
        }
    }
}
