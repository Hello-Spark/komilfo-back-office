# Audit du formulaire devis-komilfo.fr

Source : https://devis-komilfo.fr/ (audit DOM réel, avril 2026)

Type : **formulaire multi-étapes SPA** (HTML/JS côté client), `<form class="funnel">`, `method=GET`, `action=https://devis-komilfo.fr/`. Les champs sont affichés par `fieldset[data-order]`, certains conditionnés par `data-if="form.<field> == '<value>'"`.

---

## 1. Architecture et branchement

La première question (`demande`) conditionne le reste du parcours.

```
Étape 0 : demande ─┬─ "Devis" ──→ produit[] → echeance → travaux → habitat → message (texte libre) ─┐
                   │                                                                                 ├─→ codepostal + ville → coordonnées finales
                   └─ "SAV"  ──→ message (texte libre) ───────────────────────────────────────────┘
```

Progression (barre visible dans le formulaire) :
- Étape 0 : 15%
- Produits : 25%
- Échéance : 37%
- Travaux : 50% (aussi 50% côté SAV)
- Habitation : 62%
- Description : 75%
- Localisation : 87%
- Coordonnées : 100%

---

## 2. Champs et valeurs possibles

### Étape 0 — Objet de la demande *(toujours affichée)*

| Attribut | Valeur |
|---|---|
| `name` | `demande` |
| Type HTML | `radio` (obligatoire) |
| Libellé | « Quel est l'objet de votre demande ? » |

**Valeurs possibles :**

| Valeur envoyée | Libellé affiché |
|---|---|
| `Devis` | Demander un devis |
| `SAV` | Suivre un projet en cours |

---

### Étape 1 — Produits recherchés *(si `demande == Devis`)*

| Attribut | Valeur |
|---|---|
| `name` | `produit[]` |
| Type HTML | `checkbox` (multi-sélection, au moins 1 requis pour activer « Suivant ») |
| Libellé | « Quel(s) produit(s) recherchez-vous ? » |

**Valeurs possibles (9 options) :**

| Valeur envoyée | Libellé affiché |
|---|---|
| `Pergola` | Pergola |
| `Store` | Store |
| `Fenêtre / Baie Vitrée` | Fenêtre / Baie Vitrée |
| `Volet` | Volet |
| `Porte d'entrée` | Porte d'entrée |
| `Porte de garage` | Porte de garage |
| `Carport / Abris de voiture` | Carport / Abris de voiture |
| `Portail / Clôture` | Portail / Clôture |
| `Maison Connectée` | Maison Connectée |

> Les valeurs sont envoyées telles quelles (avec accents, apostrophes, espaces). Coté CRM, prévoir le décodage URL (`%C3%A9` pour `é`, etc.).

---

### Étape 2 — Date estimée du projet *(si `demande == Devis`)*

| Attribut | Valeur |
|---|---|
| `name` | `echeance` |
| Type HTML | `radio` (obligatoire) |
| Libellé | « Date estimée du projet : » |

**Valeurs possibles :**

| Valeur envoyée | Libellé affiché |
|---|---|
| `Dans les 3 mois` | Dans les 3 mois |
| `Dans l'année` | Dans l'année |
| `Pas de date fixée` | Pas de date fixée |

---

### Étape 3 — Type de travaux *(si `demande == Devis`)*

| Attribut | Valeur |
|---|---|
| `name` | `travaux` |
| Type HTML | `radio` (obligatoire) |
| Libellé | « Quel type de travaux réalisez-vous ? » |

**Valeurs possibles :**

| Valeur envoyée | Libellé affiché |
|---|---|
| `Neuf` | Neuf |
| `Rénovation` | Rénovation |

---

### Étape 4 — Type d'habitation *(si `demande == Devis`)*

| Attribut | Valeur |
|---|---|
| `name` | `habitat` |
| Type HTML | `radio` (obligatoire) |
| Libellé | « Quel type d'habitation est concerné ? » |

**Valeurs possibles :**

| Valeur envoyée | Libellé affiché |
|---|---|
| `Maison` | Maison |
| `Appartement` | Appartement |
| `Autres` | Autres |

---

### Étape 5 — Description du projet *(si `demande == Devis`)*

| Attribut | Valeur |
|---|---|
| `name` | `message` |
| Type HTML | `textarea` (facultatif) |
| `maxlength` | 2000 caractères |
| `rows` | 4 |
| Libellé | « Si vous le souhaitez, décrivez-nous votre projet ! » / « Parlez-nous de votre projet » |

Texte libre — peut être vide.

---

### Étape 1 alternative — Commentaire SAV *(si `demande == SAV`)*

| Attribut | Valeur |
|---|---|
| `name` | `message` |
| Type HTML | `textarea` |
| `rows` | 5 / `cols` | 40 |
| Libellé | « Merci de décrire votre demande » / « Votre commentaire » |

Même nom de champ que l'étape 5 Devis : côté réception, le contexte est donné par `demande=SAV`.

---

### Étape Localisation *(commune Devis + SAV)*

| Champ | `name` | Type | Obligatoire | Libellé |
|---|---|---|---|---|
| Code postal | `codepostal` | `text` | ✅ | « Code postal » |
| Ville | `ville` | `text` | ✅ | « Ville » |

Aucune validation spécifique côté HTML (pas de `pattern`). Prévoir une normalisation côté CRM (5 chiffres pour la France métropolitaine + DOM, casse titre pour la ville).

---

### Étape finale — Coordonnées *(commune Devis + SAV)*

| Champ | `name` | Type | Obligatoire | Validation |
|---|---|---|---|---|
| Nom | `nom` | `text` | ✅ | — |
| Prénom | `prenom` | `text` | ✅ | — |
| Email | `email` | `email` | ✅ | classe `emailRule` |
| Téléphone | `tel` | `tel` | ✅ | classe `tel_telephone_phoneRule` (format téléphone) |
| Créneau de rappel | `contact[]` | `checkbox` (multi) | non | cf. valeurs ci-dessous |
| Consentement RGPD | `optin` | `checkbox` | ✅ | cf. ci-dessous |

**Valeurs possibles pour `contact[]` :**

| Valeur envoyée | Libellé affiché |
|---|---|
| `Matin` | Matin |
| `Après-midi` | Après-midi |
| `Soirée` | Soirée |

**Consentement `optin` :**
- `true` si coché (obligatoire pour soumettre)
- Un champ caché `<input type="hidden" value="false" name="optin">` garantit qu'une valeur `false` est envoyée si l'utilisateur ne coche pas (fallback pattern showempty)
- Libellé : « J'accepte que ces données soient utilisées pour traiter ma demande * »

---

## 3. Champs cachés (tracking)

Envoyés automatiquement avec chaque soumission :

| `name` | Source / valeur typique | Usage |
|---|---|---|
| `location_host` | `devis-komilfo.fr` | domaine d'origine |
| `location_href` | URL complète (`https://devis-komilfo.fr/?utm_…`) | page d'origine + paramètres UTM |
| `src` | `direct`, ou valeur extraite des UTM | source d'acquisition |
| `campaign` | valeur extraite des UTM (vide si visite directe) | campagne marketing |

> Ces champs sont précieux pour l'attribution marketing dans le CRM. Ils contiennent toute la granularité UTM si l'utilisateur arrive d'une campagne.

---

## 4. Mentions RGPD affichées

Avant soumission, le formulaire affiche :

> Les informations de ce formulaire font l'objet d'un traitement après recueil de votre consentement destiné à : **KOMILFO SAS**.
> Finalité : gestion de la relation commerciale et du service après-vente.
> Responsable : KOMILFO SAS, 18 Rue du Bourg Nouveau, 35000 RENNES — rgpd@komilfo.fr
> Politique complète : https://www.komilfo.fr/politique-protection-donnees-confidentialite

À répliquer côté CRM dans les écrans de consultation de la fiche prospect (traçabilité consentement).

---

## 5. Schéma synthétique pour mapping CRM

```json
{
  "demande": "Devis | SAV",
  "produit": ["Pergola", "Store", "Fenêtre / Baie Vitrée", "Volet", "Porte d'entrée", "Porte de garage", "Carport / Abris de voiture", "Portail / Clôture", "Maison Connectée"],
  "echeance": "Dans les 3 mois | Dans l'année | Pas de date fixée",
  "travaux": "Neuf | Rénovation",
  "habitat": "Maison | Appartement | Autres",
  "message": "string (≤ 2000 car.)",
  "codepostal": "string (obligatoire)",
  "ville": "string (obligatoire)",
  "nom": "string (obligatoire)",
  "prenom": "string (obligatoire)",
  "email": "string (obligatoire, format email)",
  "tel": "string (obligatoire, format téléphone)",
  "contact": ["Matin", "Après-midi", "Soirée"],
  "optin": "true | false (obligatoire = true)",
  "location_host": "string",
  "location_href": "string",
  "src": "string",
  "campaign": "string"
}
```

---

## 6. Règles métier observées

1. **Branchement conditionnel** : si `demande = SAV`, les étapes Produits / Échéance / Travaux / Habitation sont **désactivées** (seuls message + localisation + coordonnées sont demandés).
2. **Produits multi-sélection** : un prospect peut cocher plusieurs catégories (ex. fenêtre + volet) → prévoir un modèle CRM un-à-plusieurs ou tableau de lignes de devis.
3. **`message` polyvalent** : même nom de champ pour description de projet (Devis) et commentaire SAV — toujours lire en conjonction de `demande`.
4. **`optin` obligatoire à `true`** : aucun lead ne peut être créé sans consentement explicite.
5. **`contact[]` facultatif** : si vide, ne rien supposer sur la préférence de rappel.
6. **Pas de validation serveur visible** : toute la validation est côté client (HTML5 + classes de validation personnalisées `emailRule`, `tel_telephone_phoneRule`). Le serveur de réception doit revérifier format email et téléphone.

---

## 7. Suggestions pour l'intégration CRM

- **Type de lead** : créer deux pipelines distincts — `Devis` (parcours commercial complet) et `SAV` (ticket support).
- **Qualification automatique** : un lead Devis avec `echeance = "Dans les 3 mois"` + produit `Pergola` ou `Store` peut être priorisé (chiffre d'affaires + saisonnalité).
- **Attribution** : indexer sur `src` + `campaign` pour reporting marketing.
- **Géographie** : `codepostal` permet un routage automatique vers le magasin Komilfo le plus proche (réseau 100+ magasins).
- **Données perso** : stocker `nom`, `prenom`, `email`, `tel` séparément (pas de concaténation). Conserver la date de consentement (`optin`) et le texte exact des mentions affichées au moment du recueil (traçabilité RGPD).
