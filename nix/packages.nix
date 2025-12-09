{ self, nixpkgs, flake-utils, ...}:
flake-utils.lib.eachDefaultSystem  (system:
let
  pkgs = import nixpkgs {
    inherit system;
  };

  libs-path = pkgs.lib.makeLibraryPath (self.common.${system}.libs ++ [ pkgs.addDriverRunpath.driverLink ] );
  core-packages = self.common.${system}.core-packages;

applicationScript = pkgs.writeShellScript "run-app-inner" ''
#!${pkgs.bash}/bin/bash

export XDG_CACHE_HOME="$TMPDIR/cache"

echo "--- Setting up Python environment via uv ---"

# Remove leading spaces from this block
if test ! -d ".venv"; then
  uv venv --clear
fi

uv sync
source .venv/bin/activate
uv pip install -e .
echo "--- Setup complete. Running application... ---"
    
server "$@"
  '';

  applicationPackage = pkgs.stdenv.mkDerivation rec {
    pname = "label-tool";
    version = "1.0.0";
    
    # 1. Add makeWrapper tool
    nativeBuildInputs = [ pkgs.makeWrapper ];
    
    # 2. Add the packages you need for the PATH/LD_LIBRARY_PATH
    buildInputs = core-packages; # core-packages must contain all runtime tools (python, uv, libc, etc.)

    # Skip unpack is no longer strictly needed if we use buildInputs
    # but let's keep it simple for now and define the src as a file list.
    dontUnpack = true; 
    dontConfigure = true;
    dontBuild = true;
    
    # Place the script in a temporary location where the build can find it
    installPhase = ''
      mkdir -p $out/bin 

      # Copy the simplified script to the output location
      cp ${applicationScript} $out/bin/label-tool-inner
      chmod +x $out/bin/label-tool-inner

      wrapProgram $out/bin/label-tool-inner \
        --prefix PATH : ${pkgs.lib.makeBinPath buildInputs} \
        --prefix LD_LIBRARY_PATH : ${pkgs.lib.makeLibraryPath buildInputs} \
        --prefix PYTHONPATH : "$out/${pkgs.python3.sitePackages}" \
        --set HOME "$HOME"

      mv $out/bin/label-tool-inner $out/bin/label-tool
    '';
  };
in
{
  apps.default = {
    type = "app";
    program = "${applicationScript}";
  };

  packages.default = applicationPackage;
})
