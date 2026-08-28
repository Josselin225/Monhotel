from rest_framework.pagination import PageNumberPagination


class DefaultPagination(PageNumberPagination):
    """Pagination par défaut : accepte ?page_size=N pour ajuster le nombre de
    résultats par page (plafonné pour rester raisonnable)."""
    page_size_query_param = 'page_size'
    max_page_size = 500
