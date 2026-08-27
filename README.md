# Mon Hôtel — Système de gestion

## Stack technique
- **Backend** : Django 5 + Django REST Framework + JWT (Python 3.14)
- **Frontend** : React 18 + Vite + TypeScript + Tailwind CSS (nécessite Node.js)

## Démarrage

### Backend Django

```bash
cd backend

# Installer les dépendances (déjà fait)
pip install -r requirements.txt

# Lancer le serveur (port 8000)
python manage.py runserver

# Créer les données de démo (déjà fait)
python create_demo_data.py
```

### Frontend React

> Prérequis : installer [Node.js](https://nodejs.org) (version 18+)

```bash
cd frontend

# Installer les dépendances
npm install

# Lancer le serveur de développement (port 5173)
npm run dev
```

## Accès

| URL | Description |
|-----|-------------|
| http://localhost:5173 | Application React (frontend) |
| http://localhost:8000/admin | Admin Django |
| http://localhost:8000/api/docs/ | Documentation API Swagger |

## Comptes de démo

| Utilisateur | Mot de passe | Rôle |
|-------------|--------------|------|
| admin | admin1234 | Administrateur |
| reception | recep1234 | Réceptionniste |

## Fonctionnalités

- **Page vitrine** : présentation de l'hôtel, chambres, services, contact
- **Tableau de bord** : KPIs en temps réel (arrivées, départs, revenus)
- **Chambres** : gestion du parc, statuts, types et tarifs
- **Réservations** : création, check-in/check-out, suivi des statuts
- **Clients** : fiche client avec historique de séjours
- **Facturation** : création, émission et encaissement des factures
