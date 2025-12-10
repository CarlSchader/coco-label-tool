{ self, nixpkgs, flake-utils, ...}:
flake-utils.lib.eachDefaultSystem  (system:
let
  pkgs = import nixpkgs {
    inherit system;
  };

  libs = self.common.${system}.libs;
  core-packages = self.common.${system}.core-packages;
  # Filter out driverLink from buildInputs (it's a runtime symlink, not a build input)
  libs-without-driverlink = builtins.filter (pkg: pkg != pkgs.addDriverRunpath.driverLink) libs;
  all-packages = core-packages ++ libs-without-driverlink;

  # Filter source to only include what we need
  src = pkgs.lib.cleanSourceWith {
    src = ../.;
    filter = path: type:
      let
        baseName = baseNameOf path;
      in
        # Exclude common build artifacts and caches
        baseName != ".venv" &&
        baseName != "node_modules" &&
        baseName != ".direnv" &&
        baseName != "result" &&
        baseName != "result-bin" &&
        baseName != "__pycache__" &&
        baseName != ".cache" &&
        baseName != "models" &&
        baseName != "data";
  };

  applicationPackage = pkgs.stdenv.mkDerivation rec {
    pname = "label-tool";
    version = "1.0.0";
    
    inherit src;
    
    # Add makeWrapper tool
    nativeBuildInputs = [ pkgs.makeWrapper ];
    
    # Add the packages you need for the PATH/LD_LIBRARY_PATH
    buildInputs = all-packages;

    dontConfigure = true;
    dontBuild = true;
    
    installPhase = ''
      mkdir -p $out/share/label-tool
      mkdir -p $out/bin
      
      # Copy the entire source to the output
      cp -r . $out/share/label-tool/
      chmod -R u+w $out/share/label-tool
      
      # Create a wrapper script that changes to the source directory
      cat > $out/bin/label-tool <<'EOF'
#!/usr/bin/env bash
set -e

# Create a temporary working directory with proper permissions
WORK_DIR=$(mktemp -d -t label-tool.XXXXXX)
trap "rm -rf '$WORK_DIR' 2>/dev/null || true" EXIT

# Copy source to working directory
cp -r @out@/share/label-tool/. "$WORK_DIR/"
cd "$WORK_DIR"

# Make all files writable (source files from nix store are read-only)
chmod -R u+w .

export XDG_CACHE_HOME="''${TMPDIR:-/tmp}/cache"

# Preserve LD_LIBRARY_PATH from the wrapper
SAVED_LD_LIBRARY_PATH="$LD_LIBRARY_PATH"

echo "--- Setting up Python environment via uv ---"

if test ! -d ".venv"; then
  uv venv --clear
fi

uv sync
source .venv/bin/activate
uv pip install -e .

# Restore LD_LIBRARY_PATH after venv activation (venv might override it)
export LD_LIBRARY_PATH="$SAVED_LD_LIBRARY_PATH:$LD_LIBRARY_PATH"

echo "--- Setup complete. Running application... ---"

server "$@"
EOF
      
      chmod +x $out/bin/label-tool
      
      # Substitute the @out@ placeholder with actual path
      substituteInPlace $out/bin/label-tool \
        --replace-warn '@out@' "$out"
      
      # Wrap the script to set up environment
      wrapProgram $out/bin/label-tool \
        --prefix PATH : ${pkgs.lib.makeBinPath buildInputs} \
        --prefix LD_LIBRARY_PATH : ${pkgs.lib.makeLibraryPath buildInputs} \
        --prefix LD_LIBRARY_PATH : ${pkgs.addDriverRunpath.driverLink}/lib
    '';
  };
in
{
  apps.default = {
    type = "app";
    program = "${applicationPackage}/bin/label-tool";
  };

  packages.default = applicationPackage;
})
