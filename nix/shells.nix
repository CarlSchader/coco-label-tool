{ self, nixpkgs, flake-utils, personal-monorepo, ...}:
flake-utils.lib.eachDefaultSystem  (system:
let
  pkgs = import nixpkgs {
    inherit system;
  };

  sops-export = personal-monorepo.packages.${system}.sops-export;

  libs = with pkgs; [
    addDriverRunpath.driverLink
    stdenv.cc.cc.lib
    zlib
    libGL
    glib
  ];
  
  libs-path = pkgs.lib.makeLibraryPath libs;
in
{
  devShells.default = pkgs.mkShell {
      buildInputs =
        (with pkgs; [
          python312
          python312Packages.cmake
          self.packages.${system}.transformers
          uv
          nodejs_24
          sops
          sops-export
        ]);

      shellHook = ''
        export LD_LIBRARY_PATH="${libs-path}:$LD_LIBRARY_PATH"

        # check for .venv dir and create if it doesn't exist
        if [ ! -d ".venv" ]; then
          uv venv --clear
        fi

        uv sync
        source .venv/bin/activate

        uv pip install -e .
      '';
  };
})
