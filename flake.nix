{
  description = "Development environment";

  inputs = {
    nixpkgs.url = "github:hilaolu/nixpkgs/alphagenome";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };
        pythonPackages = p: with p; [
          pkgs.python312Packages.ipython
          pkgs.python312Packages.ipykernel
          pkgs.python312Packages.matplotlib
          pkgs.python312Packages.jupyter
          pkgs.python312Packages.pixcat
          pkgs.python312Packages.imgcat
          pkgs.python312Packages.numpy
          pkgs.python312Packages.pandas
          pkgs.python312Packages.pipe-operator
          pkgs.python312Packages.python-dotenv
          pkgs.python312Packages.alphagenome
          pkgs.python312Packages.jupytext
          pkgs.python312Packages.jupyter-collaboration
          pkgs.python312Packages.copier
          pkgs.python312Packages.jinja2
          pkgs.python312Packages.jinja2-time
        ];
        pythonEnv = pkgs.python312.withPackages pythonPackages;
      in {
        # set environment variable for Zed to detect the python path
        devShells.default = pkgs.mkShell {
          packages = [
            pythonEnv
            pkgs.basedpyright
            pkgs.marksman
            pkgs.ruff
            pkgs.pyright
            pkgs.bc
            pkgs.samtools
            pkgs.prettier
            pkgs.nodejs
          ];

          MY_PYTHON_PATH = "${pythonEnv}/bin/python";
          JUPYTER_PATH="${pythonEnv}/share/jupyter";

        };
      });
}
