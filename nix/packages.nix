{ 
  self,
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

check-transformer = lib.trace
  (if lib.isDerivation self.packages.${system}.transformers then "Transformer package is a derivation." else "Transformer package is NOT a derivation or is missing!")
  self.packages.${system}.transformers;

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
    sourcePreference = "wheel";
  };

  pyproject-overrides = final: prev: {
    "transformers" = self.packages.${system}.transformers;
  };
  
  project-pythonSet = pythonBase.overrideScope (
    lib.composeManyExtensions [
        pyproject-build-systems.overlays.wheel
        project-overlay
        pyproject-overrides
      ]
  );

  project-env = project-pythonSet.mkVirtualEnv "label-tool-env" project-workspace.deps.default;
in
{
  packages.default = project-env;
  packages.test = check-transformer;
})
