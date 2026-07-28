# AegisWeb demo tester guide (LaTeX)

Public walkthrough for people testing the seeded **Northstar Labs** demo.

| File | Purpose |
| --- | --- |
| `aegisweb-demo-tester-guide.tex` | Source |
| `aegisweb-demo-tester-guide.pdf` | Built PDF |

## Live demo (current VPS)

| Surface | URL |
| --- | --- |
| Dashboard | http://80.240.27.4 |
| API | http://80.240.27.4/v1/health/ready |
| Sandbox | http://80.240.27.4/sandbox/ |
| Mailpit | http://80.240.27.4/mail/ |

Demo password: `Password123!`  
Accounts: `founder@` / `finance@` / `auditor@` / `dev@` `northstarlabs.dev`

## Rebuild PDF

```bash
cd docs/guides
pdflatex aegisweb-demo-tester-guide.tex
pdflatex aegisweb-demo-tester-guide.tex
```
