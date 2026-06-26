# Rapport PFE — AegisWeb

Rapport de Projet de Fin d'Études au format tunisien, structuré selon le modèle Jiwar (mise en page, chapitres, annexes).

## Fichiers

| Fichier | Contenu |
|---------|---------|
| `rapport_pfe_aegisweb.tex` | Document principal (préambule, page de garde, résumé, TDM) |
| `rapport_pfe_aegisweb_ch1.tex` | Chapitre 1 — Cadre du projet |
| `rapport_pfe_aegisweb_ch2.tex` | Chapitre 2 — Analyse des besoins |
| `rapport_pfe_aegisweb_ch3.tex` | Chapitre 3 — Conception |
| `rapport_pfe_aegisweb_ch4.tex` | Chapitre 4 — Réalisation |
| `rapport_pfe_aegisweb_conclusion.tex` | Conclusion + bibliographie |
| `rapport_pfe_aegisweb_annexes.tex` | Annexes (arborescence, API, env) |
| `assets/` | Logos AegisWeb |

## Personnalisation obligatoire

Avant soumission, remplacer les placeholders dans la page de garde et les en-têtes :

- `[NOM DE L'UNIVERSITÉ / ÉCOLE]`
- `[Diplôme ...]`
- `[Prénom Nom Étudiant]`
- `[Titre. Prénom Nom Encadreur]`
- `[Nom de l'entreprise]`
- Logo établissement (remplacer le cadre placeholder par `\includegraphics`)

## Compilation

### Overleaf

1. Créer un projet Overleaf (pdfLaTeX).
2. Uploader tous les fichiers `.tex` et le dossier `assets/`.
3. Définir le document principal : `rapport_pfe_aegisweb.tex`.
4. Compiler.

### Local

```bash
cd docs/pfe
pdflatex rapport_pfe_aegisweb.tex
pdflatex rapport_pfe_aegisweb.tex   # 2e passe pour la TDM
```

Packages requis : `geometry`, `fancyhdr`, `titlesec`, `tocloft`, `booktabs`, `tabularx`, `longtable`, `listings`, `tcolorbox`, `pgfgantt`, `hyperref`, etc. (distribution TeX Live complète).

## Captures d'écran

Les emplacements « Espace réservé » dans le chapitre 4 et les diagrammes UML peuvent être remplacés par de vraies captures du dashboard (`localhost:3000`) et des diagrammes draw.io.
