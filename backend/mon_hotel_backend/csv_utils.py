"""Utilitaires CSV partagés."""


def sanitize_csv_cell(value) -> str:
    """
    Préfixe d'une apostrophe les valeurs commençant par =, -, +, @, tabulation ou retour
    chariot pour bloquer l'injection de formules Excel/LibreOffice (CSV Injection).
    """
    s = str(value) if value is not None else ''
    if s and s[0] in ('=', '-', '+', '@', '\t', '\r'):
        return "'" + s
    return s
