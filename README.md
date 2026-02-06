# jupyter_autorun

[![Github Actions Status](https://github.com/hilaolu/jupyter_autorun/workflows/Build/badge.svg)](https://github.com/hilaolu/jupyter_autorun/actions/workflows/build.yml)

A JupyterLab extension.

## Requirements

- JupyterLab >= 4.0.0

## Install

To install the extension, execute:

```bash
pip install jupyter_autorun
```

## Uninstall

To remove the extension, execute:

```bash
pip uninstall jupyter_autorun
```

## Contributing

### Development install

Note: You will need NodeJS to build the extension package.

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Change directory to the jupyter_autorun directory

# Set up a virtual environment and install package in development mode
python -m venv .venv
source .venv/bin/activate
pip install --editable "."

# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite

# Rebuild extension Typescript source after making changes
# IMPORTANT: Unlike the steps above which are performed only once, do this step
# every time you make a change.
jlpm build
```

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
jlpm watch
# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

### Quick Start (Development Mode)

If you just want to test the extension without installing it system-wide:

```bash
# 1. Build the extension
jlpm build

# 2. Symlink to JupyterLab's labextensions directory (only needed once)
ln -s $(pwd)/jupyter_autorun/labextension ~/.local/share/jupyter/labextensions/jupyter_autorun

# 3. Start JupyterLab
jupyter lab
```

The extension will be loaded automatically. To verify it's active, check the Extensions panel in JupyterLab.

**Tip:** For iterative development, use `jlpm watch` in one terminal and `jupyter lab` in another. Changes to TypeScript files will be rebuilt automatically.

By default, the `jlpm build` command generates the source maps for this extension to make it easier to debug using the browser dev tools. To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
jupyter lab build --minimize=False
```

### Development uninstall

```bash
pip uninstall jupyter_autorun
```

In development mode, you will also need to remove the symlink created by `jupyter labextension develop`
command. To find its location, you can run `jupyter labextension list` to figure out where the `labextensions`
folder is located. Then you can remove the symlink named `jupyter_autorun` within that folder.

### Packaging the extension

See [RELEASE](RELEASE.md)
