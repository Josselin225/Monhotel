import logging

from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger('django')


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        return response
    # Erreur non gérée (ni Http404, ni PermissionDenied, ni APIException) :
    # DRF ne la laisse pas remonter à Django, donc son middleware de logging
    # (django.request → console/mail_admins) ne la voit jamais. On la journalise
    # explicitement ici pour ne pas perdre la stacktrace, puis on renvoie un 500 propre.
    logger.exception('Exception non gérée dans une vue DRF', exc_info=exc)
    return Response(
        {'detail': 'Une erreur interne est survenue.'},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
