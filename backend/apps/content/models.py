from django.db import models

DEFAULT_CONTENT = {
    "hotel": {
        "name": "Mon Hôtel",
        "tagline": "Système de gestion",
        "logo_url": "",
        "location": "Abidjan · Côte d'Ivoire",
        "address": "123 Avenue de l'Indépendance, Rue du Commerce, Plateau",
        "city": "Abidjan",
        "phone": "+225 27 22 00 00 00",
        "email": "contact@monhotel.ci",
        "stars": 5,
        "since": "2012",
        "lat": 5.3190,
        "lng": -4.0170,
        "google_review_url": "",
        "tripadvisor_review_url": "",
        "bank_name": "",
        "bank_account_holder": "",
        "bank_iban": "",
        "bank_bic": "",
    },
    "hero": {
        "eyebrow": "★ Hôtel 5 étoiles — Abidjan, Côte d'Ivoire ★",
        "title1": "L'art de l'accueil",
        "title2": "à son sommet",
        "subtitle": "Découvrez un havre de luxe et de sérénité au cœur d'Abidjan. Chaque séjour est une expérience unique.",
        "image": "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=1920&q=85",
    },
    "stats": [
        {"value": "12+", "label": "Ans d'excellence"},
        {"value": "48",  "label": "Chambres"},
        {"value": "98%", "label": "Clients satisfaits"},
        {"value": "24/7","label": "Service disponible"},
    ],
    "rooms": [
        {
            "name": "Chambre Standard", "price": "25 000", "badge": "Confort",
            "features": ["Vue jardin", "25 m²", "2 personnes"],
            "image": "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&q=80",
        },
        {
            "name": "Chambre Supérieure", "price": "40 000", "badge": "Populaire",
            "features": ["Vue panoramique", "35 m²", "2 personnes"],
            "image": "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=600&q=80",
        },
        {
            "name": "Suite Présidentielle", "price": "80 000", "badge": "Luxe",
            "features": ["Jacuzzi privatif", "65 m²", "4 personnes"],
            "image": "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=600&q=80",
        },
    ],
    "services": [
        {
            "icon": "bi-egg-fried", "title": "Restaurant gastronomique",
            "desc": "Cuisine africaine et internationale préparée par nos chefs étoilés, dans un cadre raffiné.",
            "image": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80",
        },
        {
            "icon": "bi-flower1", "title": "Spa & Bien-être",
            "desc": "Massages, soins du corps et thérapies relaxantes dans notre spa de 500 m².",
            "image": "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=600&q=80",
        },
        {
            "icon": "bi-water", "title": "Piscine extérieure",
            "desc": "Piscine chauffée avec bar à fleur d'eau, vue panoramique et transats privatifs.",
            "image": "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80",
        },
        {
            "icon": "bi-building", "title": "Centre de conférences",
            "desc": "Espaces modulables équipés pour vos séminaires, conférences et événements d'entreprise.",
            "image": "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=600&q=80",
        },
    ],
    "gallery": [
        {"image": "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=600&q=80",  "label": "Lobby"},
        {"image": "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&q=80",  "label": "Chambre"},
        {"image": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80",  "label": "Restaurant"},
        {"image": "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80",  "label": "Piscine"},
        {"image": "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=600&q=80",  "label": "Spa"},
        {"image": "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=600&q=80",  "label": "Suite"},
    ],
    "testimonials": [
        {
            "author": "Adjoua Brou", "role": "Cliente fidèle",
            "text": "Un séjour absolument merveilleux. Le personnel est aux petits soins et les chambres sont somptueuses. Je recommande vivement !",
        },
        {
            "author": "Pierre Dupont", "role": "Voyage d'affaires",
            "text": "Idéal pour les voyages professionnels. La salle de conférence est parfaitement équipée et le service est impeccable.",
        },
        {
            "author": "Amina Diallo", "role": "Lune de miel",
            "text": "Notre lune de miel a été magique grâce à cet hôtel. La suite présidentielle est un bijou. Merci pour ces moments inoubliables.",
        },
    ],
    "cta": {
        "title": "Prêt pour une expérience inoubliable ?",
        "subtitle": "Réservez dès maintenant et profitez de nos offres exclusives.",
        "button_text": "Réserver maintenant",
    },
    "emergency_contact": {
        "name": "",
        "phone": "",
        "email": "",
        "whatsapp": "",
    },
    "footer": {
        "about": "Une expérience hôtelière d'exception au cœur d'Abidjan depuis 2012.",
        "schedule_week": "Lun – Ven : 06h00 – 23h00",
        "schedule_weekend": "Sam – Dim : 07h00 – 22h00",
        "checkin": "À partir de 14h00",
        "checkout": "Avant 12h00",
    },
}


class SiteContent(models.Model):
    data = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Contenu du site"

    @classmethod
    def get_content(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        if created or not obj.data:
            obj.data = DEFAULT_CONTENT
            obj.save()
            return obj
        # Merge any new top-level sections and new keys within existing sections
        changed = False
        for section, defaults in DEFAULT_CONTENT.items():
            if section not in obj.data:
                obj.data[section] = defaults
                changed = True
            elif isinstance(defaults, dict) and isinstance(obj.data[section], dict):
                for key, val in defaults.items():
                    if key not in obj.data[section]:
                        obj.data[section][key] = val
                        changed = True
        if changed:
            obj.save()
        return obj
