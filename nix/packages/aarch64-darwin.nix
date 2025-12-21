{
  nixpkgs,
  pyproject-nix,
  uv2nix,
  pyproject-build-systems,
  ...
}:
let
  system = "aarch64-darwin";

  inherit (nixpkgs) lib;
  pkgs = import nixpkgs {
    inherit system;
    config = {
      allowUnfree = true;
      allowUnsupportedSystem = true;
    };
  };

  python = pkgs.python312;

  pythonBase = pkgs.callPackage pyproject-nix.build.packages {
    inherit python;
  };

  workspace = uv2nix.lib.workspace.loadWorkspace { workspaceRoot = ./../..; };

  overlay = workspace.mkPyprojectOverlay {
    sourcePreference = "wheel";
  };

  pythonSet = pythonBase.overrideScope (
    lib.composeManyExtensions [
      pyproject-build-systems.overlays.wheel
      overlay
    ]
  );

  venv = pythonSet.mkVirtualEnv "coco-label-tool" workspace.deps.default;
in
{
  packages.${system}.default = pkgs.runCommand "coco-label-tool" { } ''
    mkdir -p $out/bin
    ln -s ${venv}/bin/server $out/bin/coco-label-tool
  '';
}
