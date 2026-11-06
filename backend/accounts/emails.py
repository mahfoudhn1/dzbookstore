"""Account-related transactional emails.

The project uses Django's email backend.  In development the console backend
is configured in settings, so verification and reset links appear in the
server log without needing an external provider.  Setting EMAIL_HOST etc. in
the environment switches it to real SMTP without touching this module.
"""
from django.conf import settings
from django.core.mail import send_mail


def _send(subject, body, recipient):
    if not recipient:
        return 0
    return send_mail(
        subject,
        body,
        getattr(settings, 'DEFAULT_FROM_EMAIL', 'BookstoreDZ <noreply@bookstoredz.dz>'),
        [recipient],
        fail_silently=True,
    )


def send_email_verification(user, token):
    link = f"{settings.FRONTEND_URL.rstrip('/')}/verifier-email?token={token}"
    return _send(
        "Confirmez votre adresse email · BookstoreDZ",
        (
            f"Bonjour {user.first_name or user.username},\n\n"
            "Merci d'avoir rejoint BookstoreDZ, la librairie en ligne de la scène "
            "littéraire algérienne.\n\n"
            f"Confirmez votre adresse en ouvrant ce lien :\n{link}\n\n"
            "Ce lien expire dans 24 heures. Si vous n'êtes pas à l'origine de cette "
            "inscription, ignorez simplement ce message.\n"
        ),
        user.email,
    )


def send_password_reset(user, token):
    link = f"{settings.FRONTEND_URL.rstrip('/')}/reinitialiser-mot-de-passe?token={token}"
    return _send(
        "Réinitialisation de votre mot de passe · BookstoreDZ",
        (
            f"Bonjour {user.first_name or user.username},\n\n"
            "Une demande de réinitialisation du mot de passe a été faite pour ce compte.\n\n"
            f"Choisissez un nouveau mot de passe ici :\n{link}\n\n"
            "Ce lien expire dans 2 heures. Si vous n'avez rien demandé, aucune action "
            "n'est nécessaire : votre mot de passe reste inchangé.\n"
        ),
        user.email,
    )


def send_password_changed(user):
    return _send(
        "Votre mot de passe a été modifié · BookstoreDZ",
        (
            f"Bonjour {user.first_name or user.username},\n\n"
            "Le mot de passe de votre compte vient d'être modifié. Si vous n'êtes pas "
            "à l'origine de ce changement, contactez immédiatement notre équipe.\n"
        ),
        user.email,
    )
