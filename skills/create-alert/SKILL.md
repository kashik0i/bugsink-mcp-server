---
name: create-alert
description: Configure BugSink alert backends — email, Slack, Discord, and Mattermost. Use when the user wants to set up notifications or alerts for errors.
---

# BugSink: Set Up Alerts and Notifications

Configure BugSink to send notifications when errors occur. BugSink supports multiple alert backends that are configured at the instance level via Django settings.

## Available Alert Backends

### Email Alerts

Email is the default alert backend. Configure in BugSink's Django settings:

```python
# settings.py
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = "smtp.example.com"
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = "alerts@example.com"
EMAIL_HOST_PASSWORD = "your-password"
DEFAULT_FROM_EMAIL = "bugsink@example.com"
```

### Slack Alerts

BugSink can send alerts to Slack channels via incoming webhooks:

1. Create a Slack app at https://api.slack.com/apps
2. Enable "Incoming Webhooks" in the app settings
3. Add a webhook URL for the target channel
4. Configure in BugSink:

```python
# settings.py
BUGSINK_ALERT_BACKENDS = [
    {
        "backend": "bugsink.alert_backends.slack.SlackAlertBackend",
        "webhook_url": "https://hooks.slack.com/services/T.../B.../...",
    },
]
```

### Mattermost Alerts

Mattermost uses Slack-compatible webhooks:

1. In Mattermost, go to Integrations > Incoming Webhooks
2. Create a new webhook for your alerts channel
3. Configure the same way as Slack:

```python
# settings.py
BUGSINK_ALERT_BACKENDS = [
    {
        "backend": "bugsink.alert_backends.slack.SlackAlertBackend",
        "webhook_url": "https://your-mattermost.com/hooks/...",
    },
]
```

### Discord Alerts (v2.0.7+)

Discord alerts use Discord webhook URLs:

1. In Discord, go to Server Settings > Integrations > Webhooks
2. Create a new webhook for your alerts channel
3. Configure in BugSink:

```python
# settings.py
BUGSINK_ALERT_BACKENDS = [
    {
        "backend": "bugsink.alert_backends.discord.DiscordAlertBackend",
        "webhook_url": "https://discord.com/api/webhooks/...",
    },
]
```

## Multiple Backends

You can configure multiple alert backends simultaneously:

```python
BUGSINK_ALERT_BACKENDS = [
    {
        "backend": "bugsink.alert_backends.slack.SlackAlertBackend",
        "webhook_url": "https://hooks.slack.com/services/...",
    },
    {
        "backend": "bugsink.alert_backends.discord.DiscordAlertBackend",
        "webhook_url": "https://discord.com/api/webhooks/...",
    },
]
```

## Alert Conditions

BugSink triggers alerts based on:
- **New issues** — First occurrence of a new error type
- **Regression** — A previously-resolved issue reappears

Alert thresholds and conditions are configured per-project in the BugSink web UI.

## Troubleshooting

1. **No alerts received** — Check that the alert backend is configured and the webhook URL is correct
2. **Slack/Discord formatting issues** — Ensure you're using the correct backend class for your platform
3. **Email not sending** — Verify SMTP credentials and check Django's email logs
4. **Too many alerts** — Adjust alert thresholds in the BugSink project settings

## Notes

Alert backends are configured at the **instance level** (Django settings), not via the API. This means you typically need access to the BugSink server's configuration to set up alerts. If you don't have access, ask your BugSink administrator.
