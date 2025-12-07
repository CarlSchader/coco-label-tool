{ 
  nixpkgs, 
  flake-utils, 
  pyproject-nix,
  uv2nix,
  pyproject-build-systems,
  ... 
}:
flake-utils.lib.eachDefaultSystem (system:
let
  inherit (nixpkgs) lib;
  pkgs = import nixpkgs { inherit system; };

  python = pkgs.python312;

  pythonBase = pkgs.callPackage pyproject-nix.build.packages {
    inherit python;
    stdenv = if pkgs.stdenv.isDarwin then pkgs.stdenv.override {
      targetPlatform = pkgs.stdenv.targetPlatform // {
        # Set macOS SDK version to 13.0 to match opencv-python wheel requirements
        darwinSdkVersion = "13.0";
      };
    } else pkgs.stdenv;
  };
  
  project-workspace = uv2nix.lib.workspace.loadWorkspace { workspaceRoot = ../.; };
  project-overlay = project-workspace.mkPyprojectOverlay {
    sourcePreference = "wheel";  # Prefer binary wheels (like opencv-python) to avoid building from source
  };
  
  project-pythonSet = pythonBase.overrideScope (
    lib.composeManyExtensions [
        pyproject-build-systems.overlays.wheel
        project-overlay
      ]
  );
  project-env = project-pythonSet.mkVirtualEnv "label-tool-env" project-workspace.deps.default;
in
{
  packages.default = project-env;
})
