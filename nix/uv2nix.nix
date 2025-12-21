{
  self,
  nixpkgs,
  flake-utils,
  pyproject-nix,
  uv2nix,
  pyproject-build-systems,
  ...
}:
flake-utils.lib.eachDefaultSystem ( system:
let
  inherit (nixpkgs) lib;
  pkgs = import nixpkgs {
    inherit system;
  };
  
  python = pkgs.python312;

  pythonBase = pkgs.callPackage pyproject-nix.build.packages {
    inherit python;
  };
 
  workspace = uv2nix.lib.workspace.loadWorkspace { workspaceRoot = ./..; };

  overlay = workspace.mkPyprojectOverlay {
    sourcePreference = "wheel";
  };

  pythonSet = pythonBase.overrideScope (
    lib.composeManyExtensions [
      pyproject-build-systems.overlays.wheel
      overlay
    ]
  );
in 
{
  packages.uv2nix = pythonSet."coco-label-tool";
})
