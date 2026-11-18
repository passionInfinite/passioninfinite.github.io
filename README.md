# Model Insights: passioninfinite.github.io

Research blog on AI model visibility and behaviour, using open-source models and interpretability tools. Built with [Quarto](https://quarto.org) and published to GitHub Pages.

Live site: https://passioninfinite.com (custom domain via CNAME; also passioninfinite.github.io)

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

GitHub Pages must serve from the `gh-pages` branch: **Settings → Pages → Deploy from a branch → `gh-pages` / root**, with the custom domain `passioninfinite.com`.

## Writing a post

Unfinished posts live in `_drafts/`. Quarto skips folders starting with `_`, so GitHub never tries to run them.

```bash
mkdir -p _drafts/2026-12-01-my-topic
cp _templates/post-template.qmd _drafts/2026-12-01-my-topic/index.qmd
quarto preview _drafts/2026-12-01-my-topic/index.qmd      # live preview while writing
```

To publish, move it into `posts/`, run it once on your Mac, and commit the saved results in `_freeze/`:

```bash
git mv _drafts/2026-12-01-my-topic posts/            # or plain mv if never committed
quarto render posts/2026-12-01-my-topic/index.qmd    # runs the code, writes _freeze/
git add posts _freeze && git commit -m "Publish: my topic" && git push
```

GitHub Actions then rebuilds the site from the saved results (no Python or models needed there).

## Structure

```
_quarto.yml                 site config
index.qmd                   post listing (home page) + RSS feed
about.qmd
posts/                      published posts, one folder each
_drafts/                    work in progress (not built)
_freeze/                    saved code outputs from your Mac (commit this)
_templates/post-template.qmd
.github/workflows/publish.yml
```
