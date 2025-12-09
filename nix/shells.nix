{ self, nixpkgs, flake-utils, ...}:
flake-utils.lib.eachDefaultSystem  (system:
let
  pkgs = import nixpkgs {
    inherit system;
  };

  libs-path = pkgs.lib.makeLibraryPath (self.common.${system}.libs ++ [ pkgs.addDriverRunpath.driverLink ] );
  core-packages = self.common.${system}.core-packages;
in
{
  devShells.default = pkgs.mkShell {
      buildInputs = core-packages;

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
