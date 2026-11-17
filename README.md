# Model Insights: passioninfinite.github.io

Research blog on AI model visibility and behaviour, using open-source models and interpretability tools. Built with [Quarto](https://quarto.org) and published to GitHub Pages.

Live site: https://passioninfinite.dev (custom domain via CNAME; also passioninfinite.github.io)

## How it works

- Each post is a `.qmd` file with Python code cells in `posts/<date>-<slug>/index.qmd`.
- You run posts **on your Mac**. Quarto saves the outputs into `_freeze/`, and you commit them.
- On every push, GitHub Actions renders the site from the frozen outputs (no models or GPU needed) and publishes it to the `gh-pages` branch.

## One-time setup (Mac)

```bash
brew install quarto uv
git clone https://github.com/passionInfinite/passioninfinite.github.io.git
cd passioninfinite.github.io

uv venv && source .venv/bin/activate
uv pip install -r requirements.txt
export PYTORCH_ENABLE_MPS_FALLBACK=1
hf auth login        # also accept the Gemma licence at huggingface.co/google/gemma-2-2b
```

GitHub Pages must serve from the `gh-pages` branch: **Settings → Pages → Deploy from a branch → `gh-pages` / root**, with the custom domain `passioninfinite.dev`.

## Writing a post

```bash
mkdir -p posts/2026-12-01-my-topic
cp _templates/post-template.qmd posts/2026-12-01-my-topic/index.qmd
quarto preview posts/2026-12-01-my-topic/index.qmd                        # live preview while writing
quarto render posts/2026-12-01-my-topic/index.qmd                         # runs the code, updates _freeze/
```

When it's ready, delete the `draft: true` line, then commit everything (including `_freeze/`) and push.

## Structure

```
_quarto.yml                 site config
index.qmd                   post listing (home page) + RSS feed
about.qmd
posts/                      one folder per post
_templates/post-template.qmd
.github/workflows/publish.yml
```
