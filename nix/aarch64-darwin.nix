{ self, nixpkgs, ...}:
let
  pkgs = import nixpkgs {
    system = "aarch64-darwin";
  };
in
{
  devShells.aarch64-darwin.default = pkgs.mkShell {
      buildInputs =
        (with pkgs; [
          python312
          uv
          nodejs_24
        ]);

      shellHook = ''
        # check for .venv dir and create if it doesn't exist
        if [ ! -d ".venv" ]; then
          uv venv --clear
        fi

        uv sync
        source .venv/bin/activate

        uv pip install -e .
      '';
    };
}
