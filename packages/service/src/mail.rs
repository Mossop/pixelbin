use mail_send::{mail_builder::MessageBuilder, SmtpClientBuilder};
use pixelbin_shared::{Config, MailServer};
use std::{error::Error, str::FromStr};
use tracing::error;

async fn build_and_send(
    config: &Config,
    message: MessageBuilder<'_>,
) -> Result<(), Box<dyn Error>> {
    let builder = match &config.mail_server {
        MailServer::None => return Ok(()),
        MailServer::Address(address) => {
            if let Some(pos) = address.find(':') {
                let port = u16::from_str(&address[pos + 1..])?;
                SmtpClientBuilder::new(address[0..pos].to_owned(), port)
            } else {
                SmtpClientBuilder::new(address.to_string(), 587)
            }
        }
        MailServer::Options { address, port } => {
            SmtpClientBuilder::new(address.to_string(), port.unwrap_or(587))
        }
    };

    builder.connect().await?.send(message).await?;

    Ok(())
}

pub(crate) async fn send_messages(config: &Config, message: MessageBuilder<'_>) {
    if let Err(e) = build_and_send(config, message).await {
        error!(error=%e, "Error sendimg mail message.");
    }
}
